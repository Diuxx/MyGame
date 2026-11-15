import {
  Color3, MeshBuilder, StandardMaterial, TransformNode, type AbstractMesh, type Scene,
  type ShadowGenerator,
} from "@babylonjs/core";
import type { GroundStep } from "../../combat/bodyCollision";
import { buildMapObstacles, mapBounds, resolveMapMovement } from "./mapCollision";
import { createEditableModel } from "./editableModel";
import { createWorldInteractionScene } from "./worldInteractionScene";
import { createNavigationData } from "./navigationData";
import type { VisualOverride } from "./editorSchema";
import { MissingMapVisuals } from "./missingVisuals";
import { MapModelRegistry } from "./modelRegistry";
import { tileCenter } from "./validation";
import type { MapAssets, MapCollider, MapDefinition, MapObject, MapPosition } from "./types";

function placeNode(scene: Scene, parent: TransformNode, id: string,
                   position: MapPosition, rotationY = 0): TransformNode {
  const node = new TransformNode(id, scene);
  node.parent = parent;
  node.position.set(...position);
  node.rotation.y = rotationY * Math.PI / 180;
  return node;
}

function colliderDebug(scene: Scene, parent: TransformNode, shape: MapCollider,
                       material: StandardMaterial): AbstractMesh {
  const mesh = shape.type === "box"
    ? MeshBuilder.CreateBox("map-collider-box", {
      width: shape.size[0], height: shape.size[1], depth: shape.size[2],
    }, scene)
    : MeshBuilder.CreateCylinder("map-collider-cylinder", {
      diameter: shape.radius * 2, height: shape.height, tessellation: 24,
    }, scene);
  mesh.parent = parent;
  mesh.position.set(...shape.position);
  mesh.material = material;
  mesh.isPickable = false;
  mesh.setEnabled(false);
  return mesh;
}

export async function buildMap(scene: Scene, definition: MapDefinition, assets: MapAssets,
                               registry: MapModelRegistry, shadows?: ShadowGenerator) {
  const root = new TransformNode("map-" + definition.id, scene);
  root.setEnabled(false);
  const missing = new MissingMapVisuals(scene);
  const missingModels = new Set<string>();
  const tiles = new Map<string, () => void>();
  const debugMeshes: AbstractMesh[] = [];
  let interactions: ReturnType<typeof createWorldInteractionScene> | undefined;
  const objectViews = new Map<string, {
    parent: TransformNode;
    model: ReturnType<typeof createEditableModel>;
    debug: AbstractMesh[];
    picks: AbstractMesh[];
  }>();
  let editorEnabled = false;
  let debugVisible = false;
  let disposed = false;
  const pickMaterial = new StandardMaterial("map-editor-pick-mat", scene);
  pickMaterial.alpha = 0.008;
  pickMaterial.disableLighting = true;
  pickMaterial.backFaceCulling = false;
  const debugMaterial = new StandardMaterial("map-colliders-debug", scene);
  debugMaterial.disableLighting = true;
  debugMaterial.emissiveColor = Color3.FromHexString("#F1C85A");
  debugMaterial.alpha = 0.28;
  debugMaterial.wireframe = true;
  debugMaterial.backFaceCulling = false;

  async function renderTile(row: number, column: number, tileId: string): Promise<void> {
    const key = "tile-" + row + "-" + column;
    const node = placeNode(scene, root, key, tileCenter(definition, row, column));
    node.setEnabled(false);
    const { model } = assets.tiles[tileId];
    let instance: Awaited<ReturnType<MapModelRegistry["instantiate"]>> = null;
    const release = () => {
      instance?.dispose();
      if (!node.isDisposed()) node.dispose(false, false);
    };
    try {
      instance = await registry.instantiate(model, node);
      if (disposed) throw new Error("Carte fermée pendant le placement.");
      if (!instance) {
        missingModels.add(model);
        missing.addTile(node, model, definition.tileSize, tileId);
      }
      for (const mesh of node.getChildMeshes()) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
      }
      tiles.get(key)?.();
      tiles.set(key, release);
      node.setEnabled(true);
    } catch (error) {
      release();
      throw error;
    }
  }

  async function renderObject(object: MapObject): Promise<void> {
    const asset = assets.objects[object.asset];
    const parent = placeNode(scene, root, "map-object-" + object.id, object.position, object.rotationY);
    parent.setEnabled(false);
    const model = createEditableModel(scene, parent, registry, shadows, asset.model,
      (holder) => missing.addObject(holder, object.visual?.model ?? asset.model,
        object.colliders ?? asset.colliders), true, undefined,
      { editorKind: "object", editorId: object.id });
    const view = { parent, model, debug: [], picks: [] };
    objectViews.set(object.id, view);
    try {
      const imported = await model.load(object.visual);
      if (disposed) throw new Error("Carte fermée pendant le placement.");
      if (!imported) missingModels.add(object.visual?.model ?? asset.model);
      parent.setEnabled(true);
    } catch (error) {
      objectViews.delete(object.id);
      model.dispose();
      if (!parent.isDisposed()) parent.dispose(false, false);
      throw error;
    }
  }

  function refreshCollisionMeshes(id: string): void {
    const view = objectViews.get(id);
    const object = definition.objects.find((item) => item.id === id);
    if (!view || !object) return;
    for (const mesh of [...view.debug, ...view.picks]) {
      const index = debugMeshes.indexOf(mesh);
      if (index >= 0) debugMeshes.splice(index, 1);
      mesh.dispose();
    }
    view.debug = [];
    view.picks = [];
    const shapes = object.colliders ?? assets.objects[object.asset].colliders;
    const defaults: MapCollider[] = shapes.length ? shapes : [
      { type: "box", position: [0, 0.5, 0], size: [1, 1, 1] },
    ];
    for (const shape of defaults) {
      if (shapes.length) {
        const display = colliderDebug(scene, view.parent, shape, debugMaterial);
        display.setEnabled(debugVisible);
        view.debug.push(display);
        debugMeshes.push(display);
      }
      const pick = colliderDebug(scene, view.parent, shape, pickMaterial);
      pick.metadata = { editorKind: "object", editorId: id };
      pick.isPickable = editorEnabled;
      pick.setEnabled(editorEnabled);
      view.picks.push(pick);
    }
  }

  function addGroundCollider(): void {
    const { enabled, thickness } = definition.terrain.groundCollider;
    if (!enabled) return;
    const width = definition.terrain.tiles[0].length * definition.tileSize;
    const depth = definition.terrain.tiles.length * definition.tileSize;
    const center = tileCenter(definition, (definition.terrain.tiles.length - 1) / 2,
      (definition.terrain.tiles[0].length - 1) / 2);
    const ground = MeshBuilder.CreateBox("map-ground-collider", {
      width, depth, height: thickness,
    }, scene);
    ground.parent = root;
    ground.position.set(center[0], definition.terrain.origin[1] - thickness / 2, center[2]);
    ground.material = debugMaterial;
    ground.isPickable = false;
    ground.setEnabled(false);
    debugMeshes.push(ground);
  }

  try {
    for (const [row, columns] of definition.terrain.tiles.entries()) {
      for (const [column, tileId] of columns.entries()) {
        if (tileId !== null) await renderTile(row, column, tileId);
      }
    }
    for (const object of definition.objects) {
      await renderObject(object);
      refreshCollisionMeshes(object.id);
    }
    addGroundCollider();
    interactions = createWorldInteractionScene(scene, root, definition.interactions ?? [], shadows);
  } catch (error) {
    interactions?.dispose();
    for (const view of objectViews.values()) view.model.dispose();
    for (const release of tiles.values()) release();
    root.dispose(false, false);
    pickMaterial.dispose();
    missing.dispose();
    debugMaterial.dispose();
    throw error;
  }

  const bounds = mapBounds(definition);
  // Recalculate lightweight geometry after editor changes, rather than keeping
  // a collider snapshot that would not match the visible placement.
  const navigation = createNavigationData(definition, assets);
  let obstacles = buildMapObstacles(definition, assets);

  function refreshCollisionData(): void {
    obstacles = buildMapObstacles(definition, assets);
    navigation.blockingObjects = createNavigationData(definition, assets).blockingObjects;
  }

  return {
    definition,
    navigation,
    missingModels: [...missingModels],
    setVisible(visible: boolean): void { root.setEnabled(visible); },
    setColliderDebug(visible: boolean): void {
      debugVisible = visible;
      for (const mesh of debugMeshes) mesh.setEnabled(visible);
    },
    setEditorEnabled(enabled: boolean): void {
      editorEnabled = enabled;
      for (const view of objectViews.values()) {
        for (const pick of view.picks) {
          pick.setEnabled(enabled);
          pick.isPickable = enabled;
        }
      }
    },
    async addObject(object: MapObject): Promise<void> {
      await renderObject(object);
      definition.objects.push(object);
      refreshCollisionMeshes(object.id);
      refreshCollisionData();
    },
    async replaceTile(row: number, column: number, tileId: string): Promise<void> {
      if (definition.terrain.tiles[row][column] === tileId) return;
      await renderTile(row, column, tileId);
      definition.terrain.tiles[row][column] = tileId;
      navigation.walkable[row][column] = assets.tiles[tileId].walkable;
    },
    moveObject(id: string, position: MapPosition): void {
      const object = definition.objects.find((item) => item.id === id);
      const view = objectViews.get(id);
      if (!object || !view) throw new Error("Objet de map inconnu : " + id);
      object.position = [...position];
      view.parent.position.set(...position);
      refreshCollisionData();
    },
    rotateObject(id: string, degrees: number): void {
      const object = definition.objects.find((item) => item.id === id);
      const view = objectViews.get(id);
      if (!object || !view || !Number.isFinite(degrees)) throw new Error("Rotation d'objet invalide.");
      object.rotationY = degrees;
      view.parent.rotation.y = degrees * Math.PI / 180;
      refreshCollisionData();
    },
    async setObjectVisual(id: string, visual: VisualOverride, localTextureUrl?: string): Promise<void> {
      const object = definition.objects.find((item) => item.id === id);
      const view = objectViews.get(id);
      if (!object || !view) throw new Error("Objet de map inconnu : " + id);
      const loaded = await view.model.load(visual, localTextureUrl);
      if (loaded === undefined) return;
      object.visual = { ...visual };
    },
    setObjectCollider(id: string, collider: MapCollider): void {
      const object = definition.objects.find((item) => item.id === id);
      const view = objectViews.get(id);
      if (!object || !view) throw new Error("Objet de map inconnu : " + id);
      const colliders = object.colliders ?? structuredClone(assets.objects[object.asset].colliders);
      if (!colliders.length) throw new Error("Cet objet ne possède pas de collider.");
      object.colliders = [collider, ...colliders.slice(1)];
      refreshCollisionMeshes(id);
      refreshCollisionData();
      // The temporary fallback model is rebuilt to match its current collider.
      void view.model.load(object.visual).catch((error: unknown) => {
        console.error("Impossible de reconstruire le visuel provisoire de l'objet :", id, error);
      });
    },
    nearbyInteraction(hero: MapPosition) { return interactions?.nearby(hero); },
    moveInteraction(id: string, position: MapPosition): void { interactions?.move(id, position); },
    interact(hero: MapPosition) { return interactions?.interact(hero); },
    getInventory() { return interactions?.inventory() ?? {}; },
    resolveMovement(start: MapPosition, step: GroundStep, heroRadius: number, heroHeight = 1.8): GroundStep {
      return resolveMapMovement(start, step, heroRadius, obstacles, bounds, heroHeight);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      interactions?.dispose();
      for (const view of objectViews.values()) view.model.dispose();
      for (const release of tiles.values()) release();
      root.dispose(false, false);
      pickMaterial.dispose();
      missing.dispose();
      debugMaterial.dispose();
    },
  };
}

export type BuiltMap = Awaited<ReturnType<typeof buildMap>>;
