import type { TransformNode } from "@babylonjs/core";
import { AVAILABLE_MAPS, isMapId } from "../world/maps/dataLoader";
import type { createMapSystem } from "../world/maps/mapSystem";
import type { createMapTransitions } from "../world/maps/zoneTransitions";
import type { CameraControls } from "../world/scene";
import { requireElement } from "../ui/dom";

/** Loading is explicit in Playground so existing combat tests start unchanged. */
export function bindMapTools(
  maps: ReturnType<typeof createMapSystem>,
  hero: TransformNode,
  camera: CameraControls,
  signal: AbortSignal,
  transitions: ReturnType<typeof createMapTransitions>,
): void {
  const selection = requireElement<HTMLSelectElement>("mapSelect");
  const load = requireElement<HTMLButtonElement>("mapLoad");
  const unload = requireElement<HTMLButtonElement>("mapUnload");
  const placeHero = requireElement<HTMLButtonElement>("mapPlaceHero");
  const debug = requireElement<HTMLInputElement>("mapShowColliders");
  const aggro = requireElement<HTMLInputElement>("mapShowAggro");
  const zoneDebug = requireElement<HTMLInputElement>("mapShowZonePoints");
  const activeId = requireElement<HTMLElement>("mapActiveId");
  const resetProgress = requireElement<HTMLButtonElement>("mapResetProgress");
  const status = requireElement<HTMLParagraphElement>("mapStatus");
  let pending = false;

  const labels: Record<string, string> = {
    dojo: "Cour du dojo", forest: "Clairière",
    "prototype-forest": "Prototype — Forêt",
    "prototype-inn": "Playground — Auberge blanche",
  };
  for (const id of AVAILABLE_MAPS) selection.add(new Option(labels[id] ?? id, id));
  selection.value = maps.active?.definition.id ?? "prototype-inn";

  function syncButtons(): void {
    load.disabled = pending || transitions.isBusy;
    selection.disabled = pending || transitions.isBusy;
    unload.disabled = pending || transitions.isBusy || !maps.active ||
      maps.active.definition.id === "prototype-inn";
    placeHero.disabled = pending || transitions.isBusy ||
      !maps.active?.definition.spawnPoints.some((point) => point.type === "player");
    resetProgress.disabled = pending || transitions.isBusy || !maps.active;
    activeId.textContent = maps.active?.definition.id ?? "prototype-inn";
  }

  function teleportToSpawn(): void {
    const spawn = maps.active?.definition.spawnPoints.find((point) => point.type === "player");
    if (!spawn) {
      status.textContent = "Aucun point d’apparition joueur pour cette map.";
      return;
    }
    hero.position.set(...spawn.position);
    hero.rotation.y = spawn.rotationY * Math.PI / 180;
    camera.follow(hero.position.x, hero.position.z);
  }

  load.addEventListener("click", async () => {
    if (pending || transitions.isBusy || !isMapId(selection.value)) return;
    pending = true;
    syncButtons();
    status.textContent = "Chargement de la map...";
    try {
      const loadedSuccessfully = await transitions.loadManual(selection.value);
      if (!loadedSuccessfully) {
        status.textContent = "Chargement impossible. Vérifier le message dans le HUD.";
        return;
      }
      const loaded = maps.active;
      if (!loaded) return;
      const absent = loaded.missingModels;
      status.textContent = loaded.definition.name + " (" + loaded.definition.id + ") chargée. " +
        (absent.length ? "Modèles 3D absents (" + absent.length + ") remplacés par des volumes : " +
          absent.map((path) => path.split("/").at(-1)).join(", ") : "Tous les modèles 3D sont présents.");
    } catch (error) {
      status.textContent = "Map inchangée — erreur : " + (error instanceof Error ? error.message : String(error));
    } finally {
      pending = false;
      syncButtons();
    }
  }, { signal });

  unload.addEventListener("click", async () => {
    if (pending || transitions.isBusy || maps.active?.definition.id === "prototype-inn") return;
    pending = true;
    syncButtons();
    try {
      const loaded = await transitions.loadManual("prototype-inn");
      status.textContent = loaded
        ? "Map de départ restaurée."
        : "Retour impossible. Vérifier le message dans le HUD.";
    } finally {
      pending = false;
      syncButtons();
    }
  }, { signal });

  placeHero.addEventListener("click", teleportToSpawn, { signal });
  debug.addEventListener("change", () => maps.showColliders(debug.checked), { signal });
  aggro.addEventListener("change", () => maps.showAggro(aggro.checked), { signal });
  zoneDebug.addEventListener("change", () => maps.showZonePoints(zoneDebug.checked), { signal });
  resetProgress.addEventListener("click", () => {
    maps.active?.resetProgress();
    status.textContent = "Progression de cette map réinitialisée : ennemis et vagues restaurés.";
  }, { signal });
  syncButtons();
}
