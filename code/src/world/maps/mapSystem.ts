import type { Scene } from "@babylonjs/core";
import { loadMapData, isMapId, type MapId } from "./dataLoader";
import { buildMap } from "./mapBuilder";
import { createMapSession } from "./mapSession";
import { MapModelRegistry } from "./modelRegistry";

export function createMapSystem(scene: Scene) {
  const registry = new MapModelRegistry(scene);
  const session = createMapSession(async (id) => {
    if (!isMapId(id)) throw new Error("Map inconnue : " + id);
    const { map, assets } = await loadMapData(id);
    return buildMap(scene, map, assets, registry);
  });
  let debugVisible = false;
  let disposed = false;

  async function load(id: MapId) {
    if (disposed) throw new Error("Système de maps fermé.");
    const result = await session.load(id);
    result?.setColliderDebug(debugVisible);
    return result;
  }

  async function dispose(): Promise<void> {
    if (disposed) return;
    disposed = true;
    await session.dispose();
    await registry.dispose();
  }

  scene.onDisposeObservable.addOnce(() => { void dispose(); });
  return {
    load,
    unload: () => session.unload(),
    get active() { return session.active; },
    showColliders(visible: boolean): void {
      debugVisible = visible;
      session.active?.setColliderDebug(visible);
    },
    dispose,
  };
}
