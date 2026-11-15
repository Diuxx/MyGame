import {
  Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode,
  type Scene, type ShadowGenerator,
} from "@babylonjs/core";
import { MapModelRegistry } from "../world/maps/modelRegistry";
import type { Hurtbox, Position, SwordSwing } from "../combat/combat";
import type { EnemyDefinition, EnemySettings } from "./enemyDefinitions";
import { createEnemy, getEnemyCollision, type Enemy } from "./enemyState";
import type { GroundStep } from "../combat/bodyCollision";
import { createEnemyManager } from "./enemyManager";

function footprint(box: Hurtbox): number {
  const radius = box.shape === "cylinder" ? box.radius : Math.hypot(box.width, box.depth) / 2;
  return radius + Math.hypot(box.offset[0], box.offset[2]);
}

export function createEnemyScene(scene: Scene, shadows: ShadowGenerator, groundY: number) {
  const entries = new Map<string, { enemy: Enemy; update(): void; select(selected: boolean): void;
    showHurtbox(visible: boolean): void; showCollider(visible: boolean): void; dispose(): void }>();
  const manager = createEnemyManager();
  const models = new MapModelRegistry(scene);
  let disposed = false;
  let nextId = 1;
  let debug = false;
  let debugColliders = false;

  function material(name: string, color: string, alpha = 1): StandardMaterial {
    const result = new StandardMaterial(name, scene);
    result.disableLighting = true;
    result.emissiveColor = Color3.FromHexString(color);
    result.backFaceCulling = false;
    result.alpha = alpha;
    return result;
  }

  const background = material("enemyHealthBackground", "#252321");
  const selected = material("enemyHealthSelected", "#FFC65C");
  const fill = material("enemyHealthFill", "#6DB85D");
  const debugMaterial = material("enemyHurtbox", "#64E9DD", 0.3);
  debugMaterial.wireframe = true;
  const colliderMaterial = material("enemyCollider", "#FFD166", 0.45);
  colliderMaterial.wireframe = true;

  async function spawn(definition: EnemyDefinition, settings: EnemySettings, position: Position | (() => Position)): Promise<Enemy> {
    if (disposed) throw new Error("Scène des cibles déjà libérée.");
    const id = `${definition.id}-${nextId++}`;
    const root = new TransformNode(id, scene);
    const model = new TransformNode(`${id}-model`, scene);
    model.parent = root;
    let instance: Awaited<ReturnType<MapModelRegistry["instantiate"]>>;
    try {
      instance = await models.instantiate(definition.modelPath, model);
      if (disposed) throw new Error("Scène des cibles libérée pendant le chargement.");
      if (!instance) throw new Error(`Chargement de ${definition.modelPath} impossible.`);
      const enemy = createEnemy(id, definition, typeof position === "function" ? position() : position, settings);
      const geometry = model.getChildMeshes().filter((mesh) => mesh.getTotalVertices() > 0);
      if (!geometry.length) throw new Error(`Aucun maillage visible dans ${definition.modelPath}.`);
      const bounds = model.getHierarchyBoundingVectors();
      model.position.y = -bounds.min.y;
      root.position.set(...enemy.position);

      const box = definition.hurtbox;
      const hurtbox = box.shape === "cylinder"
        ? MeshBuilder.CreateCylinder(`${id}-hurtbox`, { diameter: box.radius * 2, height: box.height, tessellation: 16 }, scene)
        : MeshBuilder.CreateBox(`${id}-hurtbox`, { width: box.width, height: box.height, depth: box.depth }, scene);
      hurtbox.parent = root;
      hurtbox.position.set(...box.offset);
      hurtbox.material = debugMaterial;
      hurtbox.isPickable = false;
      hurtbox.setEnabled(debug);

      // A circular footprint blocks movement independently of the imported GLB geometry.
      const collider = MeshBuilder.CreateCylinder(`${id}-collider`, { diameter: 2, height: 0.08, tessellation: 32 }, scene);
      collider.parent = root;
      collider.position.y = 0.055;
      collider.material = colliderMaterial;
      collider.isPickable = false;
      collider.setEnabled(false);

      const bar = MeshBuilder.CreatePlane(`${id}-health`, { width: 1.28, height: 0.18 }, scene);
      bar.parent = root;
      bar.position.y = bounds.max.y - bounds.min.y + 0.28;
      bar.billboardMode = Mesh.BILLBOARDMODE_ALL;
      bar.material = background;
      bar.isPickable = false;
      const health = MeshBuilder.CreatePlane(`${id}-health-fill`, { width: 1.18, height: 0.105 }, scene);
      health.parent = bar;
      health.position.z = -0.01;
      health.material = fill;
      health.isPickable = false;
      for (const mesh of geometry) {
        mesh.computeWorldMatrix(true);
        shadows.addShadowCaster(mesh, false);
      }

      const entry = {
        enemy,
        update() {
          const ratio = enemy.health / enemy.stats.maxHealth;
          health.setEnabled(ratio > 0);
          health.scaling.x = ratio;
          health.position.x = (ratio - 1) * 0.59;
          const solid = getEnemyCollision(enemy);
          collider.scaling.x = solid.radius;
          collider.scaling.z = solid.radius;
          collider.setEnabled(debugColliders && solid.solid && !enemy.defeated);
        },
        select(isSelected: boolean) { bar.material = isSelected ? selected : background; },
        showHurtbox(visible: boolean) { hurtbox.setEnabled(visible); },
        showCollider(visible: boolean) {
          const solid = getEnemyCollision(enemy);
          collider.setEnabled(visible && solid.solid && !enemy.defeated);
        },
        dispose() {
          for (const mesh of geometry) shadows.removeShadowCaster(mesh, false);
          instance?.dispose();
          bar.dispose();
          hurtbox.dispose();
          collider.dispose();
          model.dispose(true);
          root?.dispose(true);
        },
      };
      entries.set(id, entry);
      manager.add(enemy);
      entry.update();
      return enemy;
    } catch (error) {
      instance?.dispose();
      root.dispose(false, false);
      throw error;
    }
  }

  function findSpawnPosition(definition: EnemyDefinition, hero: Position, yaw: number, limit: number): Position {
    const radius = footprint(definition.hurtbox);
    for (let distance = Math.max(2.4, radius + 1); distance <= 12; distance += 2) {
      for (let step = 0; step < 12; step++) {
        const angle = yaw + step * Math.PI / 6;
        const x = hero[0] + Math.sin(angle) * distance;
        const z = hero[2] + Math.cos(angle) * distance;
        if (Math.abs(x) + radius > limit || Math.abs(z) + radius > limit) continue;
        const overlaps = Array.from(entries.values()).some(({ enemy }) =>
          Math.hypot(x - enemy.position[0], z - enemy.position[2]) < radius + footprint(enemy.definition.hurtbox) + 0.25);
        if (!overlaps) return [x, groundY, z];
      }
    }
    throw new Error("Aucune place libre près du héros.");
  }

  async function dispose(): Promise<void> {
    if (disposed) return;
    disposed = true;
    removeAll();
    for (const material of [background, selected, fill, debugMaterial, colliderMaterial]) {
      material.dispose();
    }
    await models.dispose();
  }

  function removeAll(): void {
    for (const entry of entries.values()) entry.dispose();
    entries.clear();
    manager.clear();
  }

  scene.onDisposeObservable.addOnce(() => { void dispose(); });

  return {
    spawn,
    findSpawnPosition,
    dispose,
    remove(id: string) {
      entries.get(id)?.dispose();
      entries.delete(id);
      manager.remove(id);
    },
    removeAll,
    select(id: string) {
      for (const entry of entries.values()) entry.select(entry.enemy.id === id);
    },
    showHurtboxes(visible: boolean) {
      debug = visible;
      for (const entry of entries.values()) entry.showHurtbox(visible);
    },
    list() {
      return manager.list();
    },
    resolveMovement(start: Position, desired: GroundStep, heroRadius: number): GroundStep {
      return manager.resolveMovement(start, desired, heroRadius);
    },
    showColliders(visible: boolean) {
      debugColliders = visible;
      for (const entry of entries.values()) entry.showCollider(visible);
    },
    update(delta: number) {
      manager.update(delta);
      for (const entry of entries.values()) entry.update();
    },
    strike(origin: Position, yaw: number, swing?: SwordSwing) {
      return manager.strike(origin, yaw, swing);
    },
  };
}
