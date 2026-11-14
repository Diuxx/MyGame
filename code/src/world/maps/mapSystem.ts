import type { Scene, ShadowGenerator, TransformNode } from "@babylonjs/core";
import type { Position, SwordSwing } from "../../combat/combat";
import type { GroundStep } from "../../combat/bodyCollision";
import { createMapEnemyScene } from "../../enemies/mapEnemyScene";
import { clearMapProgress, readMapProgress, saveMapProgress } from "../../enemies/mapProgress";
import type { EnemyEvent, SavedMapProgress } from "../../enemies/mapEnemySimulation";
import { DEFAULT_ENVIRONMENT, type EnvironmentSettings } from "./environmentSettings";
import { loadMapData, isMapId, type MapId } from "./dataLoader";
import { buildMap } from "./mapBuilder";
import { createMapSession } from "./mapSession";
import { MapModelRegistry } from "./modelRegistry";
import type { VisualOverride } from "./editorSchema";
import type { MapCollider, MapPosition } from "./types";

export interface MapSystemOptions {
  hero: TransformNode;
  shadows: ShadowGenerator;
  applyEnvironment(value: EnvironmentSettings): void;
  isHeroAlive(): boolean;
  onHeroHit(damage: number): void;
  onEncounterEvent?(event: EnemyEvent): void;
  onWorldInteraction?(message: string): void;
}

/** Integrates maps, lighting and AI without coupling game rules to Babylon.js. */
export function createMapSystem(scene: Scene, options: MapSystemOptions) {
  const registry = new MapModelRegistry(scene);
  let showCollisionDebug = false;
  let showAggroDebug = false;
  let disposed = false;
  let editing = false;
  const keyboard = new AbortController();

  function readProgress(id: string): SavedMapProgress {
    try { return readMapProgress(localStorage, id); }
    catch (error) {
      console.warn("Sauvegarde de progression indisponible :", error);
      return { defeatedIds: [], clearedWaveIds: [] };
    }
  }

  function persist(id: string, progress: SavedMapProgress): void {
    try { saveMapProgress(localStorage, id, progress); }
    catch (error) { console.warn("Progression non enregistrée :", error); }
  }

  const session = createMapSession(async (id) => {
    if (!isMapId(id)) throw new Error("Map inconnue : " + id);
    const { map, assets, enemyCatalog } = await loadMapData(id);
    const level = await buildMap(scene, map, assets, registry, options.shadows);
    try {
      const enemies = await createMapEnemyScene(scene, map, enemyCatalog, level, {
        shadows: options.shadows,
        registry,
        progress: readProgress(map.id),
        getHeroPosition: (): Position =>
          [options.hero.position.x, options.hero.position.y, options.hero.position.z],
        isHeroAlive: options.isHeroAlive,
        onHeroHit: options.onHeroHit,
        onEvent: (event, progress) => {
          if ((event.type === "death" && event.persistent) || event.type === "waveCleared") {
            persist(map.id, progress);
          }
          options.onEncounterEvent?.(event);
        },
      });
      return {
        definition: level.definition,
        assets,
        missingModels: level.missingModels,
        navigation: level.navigation,
        simulation: enemies.simulation,
        activate(): void {
          level.activate();
          enemies.activate();
          level.setEditorEnabled(editing);
          enemies.setEditorEnabled(editing);
          options.applyEnvironment(map.environment ?? DEFAULT_ENVIRONMENT);
        },
        setColliderDebug(visible: boolean): void { level.setColliderDebug(visible); },
        showAggro(visible: boolean): void { enemies.showAggro(visible); },
        setEditorEnabled(visible: boolean): void {
          level.setEditorEnabled(visible);
          enemies.setEditorEnabled(visible);
        },
        editor: {
          move(kind: "object" | "enemy", id: string, position: MapPosition): void {
            if (kind === "object") level.moveObject(id, position);
            else enemies.moveEnemy(id, position);
          },
          rotate(kind: "object" | "enemy", id: string, degrees: number): void {
            if (kind === "object") level.rotateObject(id, degrees);
            else enemies.rotateEnemy(id, degrees);
          },
          setObjectCollider: level.setObjectCollider,
          setEnemyParameters: enemies.setEnemyParameters,
          async setVisual(kind: "object" | "enemy", id: string,
                          visual: VisualOverride, localTextureUrl?: string): Promise<void> {
            if (kind === "object") await level.setObjectVisual(id, visual, localTextureUrl);
            else await enemies.setEnemyVisual(id, visual, localTextureUrl);
          },
          importGlb: (file: File) => registry.registerLocalFile(file),
        },
        nearInteraction() {
          return level.nearbyInteraction([
            options.hero.position.x, options.hero.position.y, options.hero.position.z,
          ]);
        },
        interact() {
          return level.interact([
            options.hero.position.x, options.hero.position.y, options.hero.position.z,
          ]);
        },
        inventory: level.getInventory,
        exportJson(): string { return JSON.stringify(map, null, 2) + "\n"; },
        strike(origin: Position, yaw: number, swing: SwordSwing): boolean {
          return enemies.strike(origin, yaw, swing);
        },
        resolveMovement(start: Position, desired: GroundStep, radius: number, height = 1.8): GroundStep {
          const afterMap = level.resolveMovement(start, desired, radius, height);
          return enemies.resolveHeroMovement(start, afterMap, radius);
        },
        resetProgress(): void {
          try { clearMapProgress(localStorage, map.id); }
          catch (error) { console.warn("Impossible de réinitialiser la sauvegarde :", error); }
          enemies.resetProgress();
        },
        dispose(): void {
          enemies.dispose();
          level.dispose();
        },
      };
    } catch (error) {
      level.dispose();
      throw error;
    }
  });

  async function load(id: MapId) {
    if (disposed) throw new Error("Système de maps fermé.");
    const result = await session.load(id);
    result?.setColliderDebug(showCollisionDebug);
    result?.showAggro(showAggroDebug);
    return result;
  }

  function setEditing(value: boolean): void {
    editing = value;
    session.active?.setEditorEnabled(value);
  }

  window.addEventListener("keydown", (event) => {
    if (editing || event.repeat || event.key.toLowerCase() !== "e" ||
        event.ctrlKey || event.altKey || event.metaKey ||
        (event.target instanceof HTMLElement &&
          (event.target.isContentEditable || event.target.matches("input, textarea, select")))) return;
    const result = session.active?.interact();
    if (result) options.onWorldInteraction?.(result.message);
  }, { signal: keyboard.signal });

  function unload(): void {
    session.unload();
    options.applyEnvironment(DEFAULT_ENVIRONMENT);
  }

  async function dispose(): Promise<void> {
    if (disposed) return;
    disposed = true;
    keyboard.abort();
    unload();
    await session.dispose();
    await registry.dispose();
  }

  scene.onDisposeObservable.addOnce(() => { void dispose(); });
  return {
    load, unload, setEditing,
    get isEditing() { return editing; },
    get active() { return session.active; },
    showColliders(visible: boolean): void {
      showCollisionDebug = visible;
      session.active?.setColliderDebug(visible);
    },
    showAggro(visible: boolean): void {
      showAggroDebug = visible;
      session.active?.showAggro(visible);
    },
    dispose,
  };
}
