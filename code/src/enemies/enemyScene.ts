import {
  Color3, LoadAssetContainerAsync, Mesh, MeshBuilder, StandardMaterial, TransformNode,
  type Scene, type ShadowGenerator,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import type { Hurtbox, Position } from "../combat/combat";
import type { EnemyDefinition, EnemySettings } from "./enemyDefinitions";
import { createEnemy, type Enemy } from "./enemyState";
import { createEnemyManager } from "./enemyManager";

function footprint(box: Hurtbox): number {
  const radius = box.shape === "cylinder" ? box.radius : Math.hypot(box.width, box.depth) / 2;
  return radius + Math.hypot(box.offset[0], box.offset[2]);
}

export function createEnemyScene(scene: Scene, shadows: ShadowGenerator, groundY: number) {
  const entries = new Map<string, { enemy: Enemy; update(): void; select(selected: boolean): void;
    showHurtbox(visible: boolean): void; dispose(): void }>();
  const manager = createEnemyManager();
  let nextId = 1;
  let debug = false;

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

  async function spawn(definition: EnemyDefinition, settings: EnemySettings, position: Position | (() => Position)): Promise<Enemy> {
    const id = `${definition.id}-${nextId++}`;
    const assets = await LoadAssetContainerAsync(definition.modelPath, scene, {
      pluginOptions: { gltf: { animationStartMode: 0 } },
    }).catch((error: unknown) => {
      throw new Error(`Chargement de ${definition.modelPath} impossible : ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    });
    let root: TransformNode | undefined;
    try {
      const enemy = createEnemy(id, definition, typeof position === "function" ? position() : position, settings);
      const geometry = assets.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
      if (geometry.length === 0 || assets.rootNodes.length === 0) {
        throw new Error(`Aucun maillage visible dans ${definition.modelPath}.`);
      }
      root = new TransformNode(id, scene);
      assets.addAllToScene();
      const model = new TransformNode(`${id}-model`, scene);
      model.parent = root;
      for (const node of assets.rootNodes) node.parent = model;
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
        },
        select(isSelected: boolean) { bar.material = isSelected ? selected : background; },
        showHurtbox(visible: boolean) { hurtbox.setEnabled(visible); },
        dispose() {
          for (const mesh of geometry) shadows.removeShadowCaster(mesh, false);
          assets.dispose();
          bar.dispose();
          hurtbox.dispose();
          model.dispose(true);
          root?.dispose(true);
        },
      };
      entries.set(id, entry);
      manager.add(enemy);
      entry.update();
      return enemy;
    } catch (error) {
      assets.dispose();
      root?.dispose();
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

  return {
    spawn,
    findSpawnPosition,
    remove(id: string) {
      entries.get(id)?.dispose();
      entries.delete(id);
      manager.remove(id);
    },
    removeAll() {
      for (const entry of entries.values()) entry.dispose();
      entries.clear();
      manager.clear();
    },
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
    update(delta: number) {
      manager.update(delta);
      for (const entry of entries.values()) entry.update();
    },
    strike(origin: Position, yaw: number) {
      return manager.strike(origin, yaw);
    },
  };
}
