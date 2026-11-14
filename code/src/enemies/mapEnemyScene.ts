import {
  Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, TransformNode,
  type AbstractMesh, type Scene, type ShadowGenerator,
} from "@babylonjs/core";
import type { Position, SwordSwing } from "../combat/combat";
import type { MapModelRegistry } from "../world/maps/modelRegistry";
import type { MapDefinition } from "../world/maps/types";
import type { BuiltMap } from "../world/maps/mapBuilder";
import type { EnemyDefinition } from "./enemyDefinitions";
import type { EnemyEvent, FieldEnemy, SavedMapProgress } from "./mapEnemySimulation";
import { createMapEnemySimulation } from "./mapEnemySimulation";

function material(scene: Scene, color: string, alpha = 1): StandardMaterial {
  const result = new StandardMaterial("map-enemy-" + color, scene);
  result.diffuseColor = Color3.FromHexString(color);
  result.emissiveColor = Color3.FromHexString(color).scale(0.16);
  result.specularColor = Color3.Black();
  result.alpha = alpha;
  result.backFaceCulling = false;
  return result;
}

interface MapEnemyOptions {
  shadows: ShadowGenerator;
  registry: MapModelRegistry;
  progress: SavedMapProgress;
  onEvent: (event: EnemyEvent, progress: SavedMapProgress) => void;
  onHeroHit: (damage: number) => void;
  getHeroPosition: () => Position;
  isHeroAlive: () => boolean;
}

/**
 * Babylon-only presentation of the independent simulation. A procedural
 * silhouette is created if the GLB is missing. Combat and AI never read meshes.
 */
export async function createMapEnemyScene(
  scene: Scene, definition: MapDefinition, catalog: readonly EnemyDefinition[],
  map: BuiltMap, options: MapEnemyOptions,
) {
  const simulation = createMapEnemySimulation(
    {
      enemySpawns: definition.enemySpawns ?? [],
      waves: definition.waves ?? [],
      events: definition.events ?? [],
    },
    catalog, options.progress,
    { move: (start, desired, radius) => map.resolveMovement(start, desired, radius) },
  );
  const root = new TransformNode("map-encounters-" + definition.id, scene);
  root.setEnabled(false);
  const resources: (() => void)[] = [];
  const shadowCasters: AbstractMesh[] = [];
  const models = new Map<string, {
    node: TransformNode; bar: Mesh; aggro: AbstractMesh; telegraph: AbstractMesh;
  }>();
  const materials: StandardMaterial[] = [];
  const textures: DynamicTexture[] = [];
  const healthMaterial = material(scene, "#74D698");
  const backgroundMaterial = material(scene, "#2A302B");
  const aggroMaterial = material(scene, "#E8A94B", 0.7);
  aggroMaterial.wireframe = true;
  const telegraphMaterial = material(scene, "#FF615C", 0.34);
  materials.push(healthMaterial, backgroundMaterial, aggroMaterial, telegraphMaterial);

  function label(text: string, node: TransformNode, y: number): void {
    const texture = new DynamicTexture("enemy-name-" + text, { width: 512, height: 96 }, scene, false);
    texture.drawText(text, null, 62, "bold 32px Arial", "#FFFFFF", "#23312C", true);
    textures.push(texture);
    const mat = new StandardMaterial("enemy-label-" + text, scene);
    mat.disableLighting = true;
    mat.diffuseTexture = texture;
    mat.emissiveTexture = texture;
    mat.backFaceCulling = false;
    materials.push(mat);
    const plane = MeshBuilder.CreatePlane("enemy-name", { width: 1.9, height: 0.36 }, scene);
    plane.parent = node;
    plane.position.y = y;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.material = mat;
    plane.isPickable = false;
  }

  function primitive(enemy: FieldEnemy, node: TransformNode): void {
    const { profile } = enemy.spec.ai;
    const isBoss = !!enemy.spec.boss;
    const width = isBoss ? 1.45 : 0.72;
    const height = isBoss ? 2.7 : 1.65;
    const model = profile === "ranged"
      ? MeshBuilder.CreateBox("enemy-archer-body", {
        width, height, depth: width * 0.7,
      }, scene)
      : MeshBuilder.CreateCylinder(isBoss ? "enemy-boss-body" : "enemy-body", {
        diameterTop: width * 0.75, diameterBottom: width,
        height, tessellation: isBoss ? 8 : 12,
      }, scene);
    model.parent = node;
    model.position.y = height / 2;
    const colors: Record<string, string> = {
      guard: "#7196CA", patrol: "#82B47A", aggressive: "#D58666", ranged: "#9C80D1",
    };
    const mat = material(scene, isBoss ? "#D5AA61" : colors[profile]);
    materials.push(mat);
    model.material = mat;
    model.receiveShadows = true;
    model.isPickable = false;
    options.shadows.addShadowCaster(model, false);
    shadowCasters.push(model);

    // A small front-facing marker distinguishes direction when testing AI.
    const face = MeshBuilder.CreateSphere("enemy-facing", { diameter: width * 0.23 }, scene);
    face.parent = node;
    face.position.set(0, height * 0.68, width * 0.42);
    face.material = backgroundMaterial;
    face.isPickable = false;
  }

  async function createVisual(enemy: FieldEnemy): Promise<void> {
    const node = new TransformNode("map-enemy-" + enemy.spec.id, scene);
    node.parent = root;
    node.position.set(...enemy.entity.position);
    const cleanup = await options.registry.instantiate(enemy.entity.definition.modelPath, node);
    if (cleanup) {
      resources.push(cleanup);
      for (const mesh of node.getChildMeshes()) {
        mesh.receiveShadows = true;
        options.shadows.addShadowCaster(mesh, false);
        shadowCasters.push(mesh);
      }
    } else primitive(enemy, node);
    const height = enemy.spec.boss ? 3.25 : 2.1;
    label(enemy.entity.definition.name, node, height + 0.35);
    const bg = MeshBuilder.CreatePlane("enemy-health-background", { width: 1.4, height: 0.12 }, scene);
    bg.parent = node;
    bg.position.y = height;
    bg.billboardMode = Mesh.BILLBOARDMODE_ALL;
    bg.material = backgroundMaterial;
    const bar = MeshBuilder.CreatePlane("enemy-health-fill", { width: 1.35, height: 0.08 }, scene);
    bar.parent = bg;
    bar.position.z = -0.01;
    bar.material = healthMaterial;
    const aggro = MeshBuilder.CreateTorus("enemy-aggro-zone", {
      diameter: enemy.spec.ai.aggroRadius * 2, thickness: 0.035, tessellation: 48,
    }, scene);
    aggro.parent = node;
    aggro.position.y = 0.06;
    aggro.material = aggroMaterial;
    aggro.isPickable = false;
    const telegraph = MeshBuilder.CreateCylinder("enemy-attack-telegraph", {
      diameter: enemy.spec.ai.attackRange * 2, height: 0.018, tessellation: 48,
    }, scene);
    telegraph.parent = node;
    telegraph.position.y = 0.045;
    telegraph.material = telegraphMaterial;
    telegraph.isPickable = false;
    models.set(enemy.spec.id, { node, bar, aggro, telegraph });
  }

  try {
    await Promise.all(simulation.list().map((enemy) => createVisual(enemy)));
  } catch (error) {
    for (const dispose of resources) dispose();
    root.dispose(false, false);
    for (const caster of shadowCasters) options.shadows.removeShadowCaster(caster, false);
    for (const mat of materials) mat.dispose();
    for (const texture of textures) texture.dispose();
    throw error;
  }
  let debug = false;
  let activated = false;
  let disposed = false;

  function refreshVisuals(): void {
    for (const actor of simulation.list()) {
      const view = models.get(actor.spec.id);
      if (!view) continue;
      view.node.setEnabled(actor.state !== "inactive" && !actor.entity.defeated);
      view.node.position.set(...actor.entity.position);
      view.node.rotation.y = actor.yaw;
      const ratio = actor.entity.health / actor.entity.stats.maxHealth;
      view.bar.scaling.x = ratio;
      view.bar.position.x = (ratio - 1) * 0.675;
      view.aggro.setEnabled(debug);
      view.telegraph.setEnabled(actor.state === "windup");
    }
  }

  function dispatchEvents(): void {
    for (const event of simulation.events()) {
      if (event.type === "hitHero") options.onHeroHit(event.damage);
      options.onEvent(event, simulation.progress());
    }
  }

  const tick = (): void => {
    if (!activated || disposed || document.hidden) return;
    const seconds = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    simulation.update(seconds, options.getHeroPosition(), options.isHeroAlive());
    refreshVisuals();
    dispatchEvents();
  };
  let renderObserver: ReturnType<typeof scene.onBeforeRenderObservable.add> | null = null;

  return {
    simulation,
    activate(): void {
      if (disposed || activated) return;
      activated = true;
      root.setEnabled(true);
      renderObserver = scene.onBeforeRenderObservable.add(tick);
      refreshVisuals();
      dispatchEvents();
    },
    showAggro(visible: boolean): void {
      debug = visible;
      refreshVisuals();
    },
    strike(origin: Position, yaw: number, swing: SwordSwing): boolean {
      const hit = simulation.strike(origin, yaw, swing);
      refreshVisuals();
      dispatchEvents();
      return hit;
    },
    resolveHeroMovement: simulation.resolveHeroMovement,
    resetProgress(): void {
      simulation.resetProgress();
      refreshVisuals();
      dispatchEvents();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (renderObserver) scene.onBeforeRenderObservable.remove(renderObserver);
      for (const caster of shadowCasters) options.shadows.removeShadowCaster(caster, false);
      for (const dispose of resources) dispose();
      root.dispose(false, false);
      for (const mat of materials) mat.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
