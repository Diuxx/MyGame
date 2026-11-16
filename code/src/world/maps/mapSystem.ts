import type { Scene, ShadowGenerator, TransformNode } from "@babylonjs/core";
import type { DamageResolved, Position, SwordSwing } from "../../combat/combat";
import type { GroundStep } from "../../combat/bodyCollision";
import { createMapEnemyScene } from "../../enemies/mapEnemyScene";
import { clearMapProgress, readMapProgress, saveMapProgress } from "../../enemies/mapProgress";
import type { EnemyEvent, SavedMapProgress } from "../../enemies/mapEnemySimulation";
import { MAX_MAP_ENEMIES, type AISettings } from "../../enemies/mapEnemyConfig";
import { DEFAULT_ENVIRONMENT, type EnvironmentSettings } from "./environmentSettings";
import { defaultLighting, parseLightingSettings, type LightingSettings } from "./lightingSettings";
import { loadAssetCatalog, loadMapData, isMapId, type MapId } from "./dataLoader";
import { buildMap } from "./mapBuilder";
import { createMapSession } from "./mapSession";
import { MapModelRegistry } from "./modelRegistry";
import type { MapEditorKind, MapPlacementKind, VisualOverride } from "./editorSchema";
import type { MapDefinition, MapPosition } from "./types";
import { findTerrainCell, MAX_MAP_OBJECTS, validateMapDefinition } from "./validation";
import { nearestExit } from "./zoneExits";
import { fitWallToTerrain, isNearTerrain, isWallPrefab } from "./wallPlacement";

const DEFAULT_PLACED_ENEMY_AI: AISettings = {
  profile: "guard", aggroRadius: 6, attackRange: 1.5, leashRadius: 10,
  attackCooldown: 1.5, patrol: [], skills: ["slash"],
};

function placementId(base: string, entries: readonly { id: string }[]): string {
  const used = new Set(entries.map(({ id }) => id));
  let index = 1;
  let id: string;
  do {
    const suffix = "-" + index++;
    id = base.slice(0, 80 - suffix.length) + suffix;
  } while (used.has(id));
  return id;
}

export interface MapSystemOptions {
  hero: TransformNode;
  shadows: ShadowGenerator;
  applyLighting(environment: EnvironmentSettings, lighting: LightingSettings): void;
  isHeroAlive(): boolean;
  onHeroHit(damage: number): void;
  onDamage?(event: DamageResolved): void;
  onEncounterEvent?(event: EnemyEvent): void;
  onWorldInteraction?(message: string): void;
}

/** Integrates maps, lighting and AI without coupling game rules to Babylon.js. */
export function createMapSystem(scene: Scene, options: MapSystemOptions) {
  const registry = new MapModelRegistry(scene);
  let showCollisionDebug = false;
  let showAggroDebug = false;
  let showZoneDebug = false;
  let disposed = false;
  let editing = false;

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

  async function buildWorld({ map, assets, enemyCatalog }: Awaited<ReturnType<typeof loadMapData>>) {
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
        onEnemyDamage: options.onDamage,
        onEvent: (event, progress) => {
          if ((event.type === "death" && event.persistent) || event.type === "waveCleared") {
            persist(map.id, progress);
          }
          options.onEncounterEvent?.(event);
        },
      });
      let placing = false;
      return {
        definition: level.definition,
        assets,
        enemyCatalog,
        missingModels: level.missingModels,
        navigation: level.navigation,
        simulation: enemies.simulation,
        enemyAnimationName: enemies.animationName,
        activate(useEnvironment = true): void {
          level.setVisible(true);
          enemies.activate();
          level.setEditorEnabled(editing);
          enemies.setEditorEnabled(editing);
          if (useEnvironment) options.applyLighting(
            map.environment ?? DEFAULT_ENVIRONMENT,
            map.lighting ?? defaultLighting(map.environment ?? DEFAULT_ENVIRONMENT),
          );
        },
        setVisible(visible: boolean): void {
          level.setVisible(visible);
          enemies.setVisible(visible);
        },
        setColliderDebug(visible: boolean): void { level.setColliderDebug(visible); },
        setZoneDebug(visible: boolean): void { level.setZoneDebug(visible); },
        showAggro(visible: boolean): void { enemies.showAggro(visible); },
        setEditorEnabled(visible: boolean): void {
          level.setEditorEnabled(visible);
          enemies.setEditorEnabled(visible);
        },
        editor: {
          setLighting(value: LightingSettings): void {
            const parsed = parseLightingSettings(value, map.environment ?? DEFAULT_ENVIRONMENT);
            options.applyLighting(map.environment ?? DEFAULT_ENVIRONMENT, parsed);
            map.lighting = parsed;
          },
          async place(kind: MapPlacementKind, asset: string, point: MapPosition): Promise<string | undefined> {
            if (placing) throw new Error("Un placement est en cours.");
            const cell = findTerrainCell(map, point[0], point[2]);
            const nearWall = kind === "prefab" && isWallPrefab(asset) &&
              isNearTerrain(map, point[0], point[2], map.tileSize / 4);
            if ((!cell && !nearWall) || !point.every(Number.isFinite)) {
              throw new Error("Cliquer à l’intérieur du terrain.");
            }
            placing = true;
            try {
              if (kind === "tile") {
                if (!cell) throw new Error("Case de terrain introuvable.");
                if (!Object.hasOwn(assets.tiles, asset)) throw new Error("Tuile inconnue : " + asset);
                await level.replaceTile(cell.row, cell.column, asset);
                return;
              }
              if (kind === "prefab") {
                if (!assets.prefabs || !Object.hasOwn(assets.prefabs, asset)) {
                  throw new Error("Prefab inconnu : " + asset);
                }
                const placements = map.prefabs ?? [];
                if (placements.length >= 256) throw new Error("Maximum 256 prefabs placés.");
                const id = placementId(asset, placements);
                level.addPrefab({ id, prefab: asset, position: point, rotationY: 0, scale: 1 });
                return id;
              }
              if (kind === "object") {
                if (!Object.hasOwn(assets.objects, asset)) throw new Error("Décor inconnu : " + asset);
                if (map.objects.length >= MAX_MAP_OBJECTS) throw new Error("Nombre maximal de décors atteint.");
                const id = placementId(asset, map.objects);
                await level.addObject({ id, asset, position: point, rotationY: 0 });
                return id;
              }
              const enemy = enemyCatalog.find(({ id }) => id === asset);
              if (!enemy) throw new Error("Ennemi inconnu : " + asset);
              const spawns = map.enemySpawns ?? [];
              if (spawns.length >= MAX_MAP_ENEMIES) throw new Error("Nombre maximal d’ennemis atteint.");
              const id = placementId(asset, spawns);
              await enemies.addEnemy({
                id, enemyId: asset, position: point, rotationY: 0,
                activation: { mode: "always" }, respawn: { mode: "never" }, persistDeath: false,
                ai: structuredClone(enemy.placementAI ?? DEFAULT_PLACED_ENEMY_AI),
              });
              return id;
            } finally {
              placing = false;
            }
          },
          move(kind: MapEditorKind, id: string, position: MapPosition): void {
            if (kind === "object") level.moveObject(id, position);
            else if (kind === "prefab") level.movePrefab(id, position);
            else if (kind === "enemy") enemies.moveEnemy(id, position);
            else level.moveInteraction(id, position);
          },
          rotate(kind: "object" | "enemy" | "prefab", id: string, degrees: number): void {
            if (kind === "object") level.rotateObject(id, degrees);
            else if (kind === "prefab") level.rotatePrefab(id, degrees);
            else enemies.rotateEnemy(id, degrees);
          },
          setObjectCollider: level.setObjectCollider,
          addPrefab: level.addPrefab,
          addObject: level.addObject,
          removeObject: level.removeObject,
          setPrefabScaleAxes: level.setPrefabScaleAxes,
          setPrefabLayer: level.setPrefabLayer,
          setObjectLayer: level.setObjectLayer,
          setObjectLayerVisible: level.setObjectLayerVisible,
          setPrefabLayerVisibility: level.setPrefabLayerVisibility,
          getPrefabRoot: level.getPrefabRoot,
          getObjectRoot: level.getObjectRoot,
          resizeTerrain: level.resizeTerrain,
          setTerrainVisual: level.setTerrainVisual,
          scalePrefab: level.scalePrefab,
          removePrefab: level.removePrefab,
          duplicatePrefab(id: string): string {
            const original = map.prefabs?.find((item) => item.id === id);
            if (!original) throw new Error("Prefab à dupliquer introuvable : " + id);
            if ((map.prefabs?.length ?? 0) >= 256) throw new Error("Maximum 256 prefabs placés.");
            const next = {
              ...original, id: placementId(original.prefab, map.prefabs ?? []),
              position: [original.position[0] + 1.5, original.position[1], original.position[2]] as MapPosition,
            };
            const fitted = fitWallToTerrain(map, assets.prefabs, next);
            if (!findTerrainCell(map, fitted.position[0], fitted.position[2])) {
              throw new Error("Aucune place disponible pour dupliquer ce prefab.");
            }
            level.addPrefab(fitted);
            return next.id;
          },
          setEnemyParameters: enemies.setEnemyParameters,
          async setVisual(kind: "object" | "enemy", id: string,
                          visual: VisualOverride, localTextureUrl?: string): Promise<void> {
            if (kind === "object") await level.setObjectVisual(id, visual, localTextureUrl);
            else await enemies.setEnemyVisual(id, visual, localTextureUrl);
          },
          importGlb: (file: File) => registry.registerLocalFile(file),
        },
        nearExit() {
          return nearestExit(map.exits ?? [], [
            options.hero.position.x, options.hero.position.y, options.hero.position.z,
          ]);
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
  }

  let base: Awaited<ReturnType<typeof buildWorld>> | undefined;
  const session = createMapSession(async (id) => {
    if (!isMapId(id)) throw new Error("Map inconnue : " + id);
    return buildWorld(await loadMapData(id));
  });
  const world = () => session.active ?? base;

  async function openBase(map: MapDefinition): Promise<void> {
    if (disposed || base) throw new Error("Le terrain de base ne peut pas être ouvert.");
    const next = await buildWorld({ ...(await loadAssetCatalog()), map });
    if (disposed) {
      next.dispose();
      return;
    }
    base = next;
    base.activate(false);
    base.setVisible(!session.active);
    base.setColliderDebug(showCollisionDebug);
    base.showAggro(showAggroDebug);
    base.setZoneDebug(showZoneDebug);
  }

  async function load(id: MapId, spawnId?: string) {
    if (disposed) throw new Error("Système de maps fermé.");
    const result = await session.load(id, (candidate) => {
      if (spawnId && !candidate.definition.spawnPoints.some(
        (spawn) => spawn.id === spawnId && spawn.type === "player",
      )) {
        throw new Error("Point d'apparition introuvable : " + spawnId);
      }
      if (!candidate.definition.spawnPoints.some((spawn) => spawn.type === "player")) {
        throw new Error("La map ne contient aucun spawn joueur : " + id);
      }
    });
    if (result) base?.setVisible(false);
    result?.setColliderDebug(showCollisionDebug);
    result?.showAggro(showAggroDebug);
    result?.setZoneDebug(showZoneDebug);
    return result;
  }

  async function restoreMap(source: unknown): Promise<void> {
    const active = session.active;
    if (!active) throw new Error("Charger une map avant de restaurer un brouillon.");
    const enemyIds = new Set(active.enemyCatalog.map(({ id }) => id));
    const validated = validateMapDefinition(source, active.assets, enemyIds);
    if (validated.id !== active.definition.id) throw new Error("Identifiant de map différent.");
    if (disposed) throw new Error("Le système de maps est fermé.");
    const result = await session.replace(buildWorld({
      map: validated, assets: active.assets, enemyCatalog: active.enemyCatalog,
    }));
    if (!result) throw new Error("Restauration interrompue par un autre chargement.");
    result.setEditorEnabled(editing);
    result.setColliderDebug(showCollisionDebug);
    result.showAggro(showAggroDebug);
    result.setZoneDebug(showZoneDebug);
  }

  function setEditing(value: boolean): void {
    editing = value;
    world()?.setEditorEnabled(value);
  }

  function interact(): void {
    if (editing) return;
    const result = world()?.interact();
    if (result) options.onWorldInteraction?.(result.message);
  }

  function unload(): void {
    session.unload();
    base?.setVisible(true);
    base?.setEditorEnabled(editing);
    base?.setColliderDebug(showCollisionDebug);
    base?.showAggro(showAggroDebug);
    base?.setZoneDebug(showZoneDebug);
    options.applyLighting(DEFAULT_ENVIRONMENT, defaultLighting(DEFAULT_ENVIRONMENT));
  }

  async function dispose(): Promise<void> {
    if (disposed) return;
    disposed = true;
    base?.dispose();
    base = undefined;
    await session.dispose();
    await registry.dispose();
  }

  scene.onDisposeObservable.addOnce(() => { void dispose(); });
  return {
    interact,
    load, unload, setEditing, openBase, restoreMap,
    get isEditing() { return editing; },
    get active() { return session.active; },
    get world() { return world(); },
    showColliders(visible: boolean): void {
      showCollisionDebug = visible;
      world()?.setColliderDebug(visible);
    },
    showAggro(visible: boolean): void {
      showAggroDebug = visible;
      world()?.showAggro(visible);
    },
    showZonePoints(visible: boolean): void {
      showZoneDebug = visible;
      world()?.setZoneDebug(visible);
    },
    dispose,
  };
}
