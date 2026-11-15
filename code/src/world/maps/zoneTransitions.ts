import type { TransformNode } from "@babylonjs/core";
import type { CameraControls } from "../scene.ts";
import type { createMapSystem } from "./mapSystem.ts";
import { createExitActivationGuard } from "./zoneExits.ts";
import { isMapId, type MapId } from "./dataLoader.ts";

interface MapTransitionOptions {
  maps: ReturnType<typeof createMapSystem>;
  hero: TransformNode;
  camera: Pick<CameraControls, "follow">;
  signal: AbortSignal;
  onStatus(message: string): void;
  onBusyChange?(busy: boolean): void;
  onMapChanged?(id: MapId): void;
}

const FADE_MS = 170;

/** Coordinates entry and exit without replacing the shared hero, camera, or HUD. */
export function createMapTransitions(options: MapTransitionOptions) {
  const { maps, hero, camera, signal } = options;
  const overlay = document.createElement("div");
  overlay.className = "zone-transition-overlay";
  overlay.setAttribute("aria-hidden", "true");
  document.body.append(overlay);
  const guard = createExitActivationGuard();
  let busy = false;
  let disposed = false;

  function fade(visible: boolean): Promise<void> {
    overlay.classList.toggle("is-visible", visible);
    return new Promise((resolve) => window.setTimeout(resolve, FADE_MS));
  }

  async function enter(id: MapId, spawnId?: string): Promise<boolean> {
    if (busy || disposed || maps.isEditing) return false;
    busy = true;
    options.onBusyChange?.(true);
    try {
      await fade(true);
      if (disposed || signal.aborted) return false;
      const loaded = await maps.load(id, spawnId);
      if (!loaded) throw new Error("Chargement remplacé par une requête plus récente.");
      const spawn = spawnId
        ? loaded.definition.spawnPoints.find((point) => point.id === spawnId && point.type === "player")
        : loaded.definition.spawnPoints.find((point) => point.type === "player");
      if (!spawn) throw new Error("Point d'apparition introuvable : " + (spawnId ?? id));
      hero.position.set(...spawn.position);
      hero.rotation.y = spawn.rotationY * Math.PI / 180;
      camera.follow(hero.position.x, hero.position.z);
      guard.consume();
      options.onMapChanged?.(id);
      options.onStatus("Zone : " + loaded.definition.name);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      options.onStatus("Transition impossible : " + reason);
      console.error("Map transition failed", error);
      guard.consume();
      return false;
    } finally {
      if (!disposed) await fade(false);
      busy = false;
      options.onBusyChange?.(false);
    }
  }

  function update(): void {
    if (disposed || busy || maps.isEditing) return;
    const exit = maps.active?.nearExit();
    guard.observe(exit);
    if (exit && exit.activation === "automatic" && guard.canActivate) {
      guard.consume();
      if (!isMapId(exit.targetMap)) {
        options.onStatus("Map de destination inconnue : " + exit.targetMap);
        return;
      }
      void enter(exit.targetMap, exit.targetSpawn);
    }
  }

  function interact(): void {
    if (disposed || busy || maps.isEditing) return;
    const exit = maps.active?.nearExit();
    guard.observe(exit);
    if (exit && exit.activation === "interact") {
      if (guard.canActivate) {
        guard.consume();
        if (!isMapId(exit.targetMap)) {
          options.onStatus("Map de destination inconnue : " + exit.targetMap);
          return;
        }
        void enter(exit.targetMap, exit.targetSpawn);
      }
      return;
    }
    maps.interact();
  }

  signal.addEventListener("abort", () => {
    disposed = true;
    overlay.remove();
  }, { once: true });

  return {
    update,
    interact,
    loadManual: (id: MapId) => enter(id),
    get isBusy(): boolean { return busy; },
  };
}
