import {
  Color3, MeshBuilder, StandardMaterial, TransformNode,
  type AbstractMesh, type InstancedMesh, type Mesh, type Scene, type ShadowGenerator,
} from "@babylonjs/core";
import type { MapPosition } from "./types.ts";
import type { PrefabCatalog, PrefabPartKind, PrefabPlacement } from "./prefabDefinitions.ts";

interface PrefabView {
  root: TransformNode;
  parts: InstancedMesh[];
  debug: AbstractMesh[];
}

/**
 * Every prefab part is an instance of one of three unit geometry meshes.
 * Maps retain placement ownership, while the source geometry and material are
 * shared across all placements in this zone.
 */
export function createPrefabRenderer(
  scene: Scene, parent: TransformNode, catalog: PrefabCatalog,
  placements: readonly PrefabPlacement[], shadows?: ShadowGenerator,
) {
  const material = new StandardMaterial("blockout-white", scene);
  material.diffuseColor = Color3.FromHexString("#F3F3F3");
  material.specularColor = Color3.Black();

  const debugMaterial = new StandardMaterial("blockout-collision", scene);
  debugMaterial.disableLighting = true;
  debugMaterial.emissiveColor = Color3.FromHexString("#E8A848");
  debugMaterial.alpha = 0.3;
  debugMaterial.wireframe = true;
  debugMaterial.backFaceCulling = false;

  const sourceMeshes = new Map<PrefabPartKind, Mesh>();
  const views = new Map<string, PrefabView>();
  let editing = false;
  let showColliders = false;
  let disposed = false;

  function unitMesh(kind: PrefabPartKind): Mesh {
    const existing = sourceMeshes.get(kind);
    if (existing) return existing;
    const source = kind === "box"
      ? MeshBuilder.CreateBox("prefab-unit-box", { size: 1 }, scene)
      : kind === "cylinder"
        ? MeshBuilder.CreateCylinder("prefab-unit-cylinder", {
          diameter: 1, height: 1, tessellation: 16,
        }, scene)
        : MeshBuilder.CreateSphere("prefab-unit-sphere", { diameter: 1, segments: 12 }, scene);
    source.material = material;
    // Master meshes must stay enabled for their Babylon instances; put them
    // outside the playable world rather than disabling their geometry.
    source.position.y = -1000;
    source.isPickable = false;
    sourceMeshes.set(kind, source);
    return source;
  }

  function createCollisionMesh(
    holder: TransformNode, type: "box" | "cylinder",
    position: MapPosition, size: MapPosition,
  ): AbstractMesh {
    const mesh = type === "box"
      ? MeshBuilder.CreateBox("prefab-collider", {
        width: size[0], height: size[1], depth: size[2],
      }, scene)
      : MeshBuilder.CreateCylinder("prefab-collider", {
        diameter: size[0], height: size[1], tessellation: 16,
      }, scene);
    mesh.parent = holder;
    mesh.position.set(...position);
    mesh.material = debugMaterial;
    mesh.isPickable = false;
    mesh.setEnabled(showColliders);
    return mesh;
  }

  function add(placement: PrefabPlacement): void {
    if (disposed) throw new Error("Le rendu des prefabs est fermé.");
    if (views.has(placement.id)) throw new Error("Prefab déjà placé : " + placement.id);
    const definition = catalog[placement.prefab];
    if (!definition) throw new Error("Prefab inconnu : " + placement.prefab);
    const root = new TransformNode("prefab:" + placement.id, scene);
    root.parent = parent;
    root.position.set(...placement.position);
    root.rotation.y = placement.rotationY * Math.PI / 180;
    root.scaling.setAll(placement.scale);
    const view: PrefabView = { root, parts: [], debug: [] };
    try {
      for (const [index, part] of definition.parts.entries()) {
        const mesh = unitMesh(part.kind).createInstance("prefab:" + placement.id + ":" + index);
        mesh.parent = root;
        mesh.position.set(...part.position);
        mesh.scaling.set(...part.size);
        mesh.rotation.y = part.rotationY * Math.PI / 180;
        mesh.metadata = { editorKind: "prefab", editorId: placement.id };
        mesh.isPickable = editing;
        mesh.receiveShadows = true;
        view.parts.push(mesh);
        shadows?.addShadowCaster(mesh, false);
      }
      for (const shape of definition.colliders) {
        const sizes: MapPosition = shape.type === "box"
          ? shape.size
          : [shape.radius * 2, shape.height, shape.radius * 2];
        view.debug.push(createCollisionMesh(root, shape.type, shape.position, sizes));
      }
      views.set(placement.id, view);
    } catch (error) {
      for (const mesh of view.parts) shadows?.removeShadowCaster(mesh, false);
      root.dispose(false, false);
      throw error;
    }
  }

  function lookup(id: string): PrefabView {
    const view = views.get(id);
    if (!view) throw new Error("Placement prefab inconnu : " + id);
    return view;
  }

  function remove(id: string): void {
    const view = lookup(id);
    for (const mesh of view.parts) shadows?.removeShadowCaster(mesh, false);
    view.root.dispose(false, false);
    views.delete(id);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (const id of [...views.keys()]) remove(id);
    for (const source of sourceMeshes.values()) source.dispose(false, false);
    sourceMeshes.clear();
    material.dispose();
    debugMaterial.dispose();
  }

  try {
    for (const placement of placements) add(placement);
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    add,
    remove,
    move(id: string, position: MapPosition): void {
      lookup(id).root.position.set(...position);
    },
    rotate(id: string, degrees: number): void {
      lookup(id).root.rotation.y = degrees * Math.PI / 180;
    },
    scale(id: string, factor: number): void {
      lookup(id).root.scaling.setAll(factor);
    },
    setEditing(enabled: boolean): void {
      editing = enabled;
      for (const view of views.values()) {
        for (const mesh of view.parts) mesh.isPickable = enabled;
      }
    },
    setColliderDebug(enabled: boolean): void {
      showColliders = enabled;
      for (const view of views.values()) {
        for (const mesh of view.debug) mesh.setEnabled(enabled);
      }
    },
    dispose,
  };
}
