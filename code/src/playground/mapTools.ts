import type { TransformNode } from "@babylonjs/core";
import { AVAILABLE_MAPS, isMapId } from "../world/maps/dataLoader";
import type { createMapSystem } from "../world/maps/mapSystem";
import type { CameraControls } from "../world/scene";
import { requireElement } from "../ui/dom";

/** Loading is explicit in Playground so existing combat tests start unchanged. */
export function bindMapTools(
  maps: ReturnType<typeof createMapSystem>,
  hero: TransformNode,
  camera: CameraControls,
  signal: AbortSignal,
): void {
  const selection = requireElement<HTMLSelectElement>("mapSelect");
  const load = requireElement<HTMLButtonElement>("mapLoad");
  const unload = requireElement<HTMLButtonElement>("mapUnload");
  const placeHero = requireElement<HTMLButtonElement>("mapPlaceHero");
  const debug = requireElement<HTMLInputElement>("mapShowColliders");
  const status = requireElement<HTMLParagraphElement>("mapStatus");
  let pending = false;

  for (const id of AVAILABLE_MAPS) selection.add(new Option(id === "dojo" ? "Cour du dojo" : "Clairière", id));

  function syncButtons(): void {
    load.disabled = pending;
    selection.disabled = pending;
    unload.disabled = pending || !maps.active;
    placeHero.disabled = pending || !maps.active?.definition.spawnPoints.some((point) => point.type === "player");
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
    if (pending || !isMapId(selection.value)) return;
    pending = true;
    syncButtons();
    status.textContent = "Chargement de la map...";
    try {
      const loaded = await maps.load(selection.value);
      if (!loaded) return;
      teleportToSpawn();
      const absent = loaded.missingModels;
      status.textContent = loaded.definition.name + " chargée. " +
        (absent.length ? "GLB absents (" + absent.length + ") remplacés par des volumes : " +
          absent.map((path) => path.split("/").at(-1)).join(", ") : "Tous les modèles GLB sont présents.");
    } catch (error) {
      status.textContent = "Map inchangée — erreur : " + (error instanceof Error ? error.message : String(error));
    } finally {
      pending = false;
      syncButtons();
    }
  }, { signal });

  unload.addEventListener("click", () => {
    if (pending) return;
    maps.unload();
    status.textContent = "Map déchargée ; le terrain du Playground reste affiché.";
    syncButtons();
  }, { signal });

  placeHero.addEventListener("click", teleportToSpawn, { signal });
  debug.addEventListener("change", () => maps.showColliders(debug.checked), { signal });
  syncButtons();
}
