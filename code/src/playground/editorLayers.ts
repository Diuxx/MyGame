import type { PrefabCatalog, PrefabPlacement } from "../world/maps/prefabDefinitions.ts";
import type { MapObject } from "../world/maps/types.ts";

export const DEFAULT_EDITOR_LAYERS = ["architecture", "furniture", "decoration", "entities"] as const;
export type EditorLayerState = { id: string; visible: boolean; locked: boolean };

export function defaultLayerForPrefab(placement: PrefabPlacement, catalog?: PrefabCatalog): string {
  return placement.layer ?? (catalog?.[placement.prefab]?.category === "architecture" ?
    "architecture" : "furniture");
}

export function defaultLayerForObject(object: MapObject): string {
  return object.layer ?? "decoration";
}

export function createEditorLayers() {
  const states = new Map<string, EditorLayerState>(
    DEFAULT_EDITOR_LAYERS.map((id) => [id, { id, visible: true, locked: false }]),
  );
  return {
    all(): EditorLayerState[] { return Array.from(states.values()).map((item) => ({ ...item })); },
    ensure(id: string): void {
      if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id)) throw new Error("Identifiant de layer invalide.");
      if (!states.has(id)) states.set(id, { id, visible: true, locked: false });
    },
    update(id: string, change: Partial<Pick<EditorLayerState, "visible" | "locked">>): EditorLayerState {
      this.ensure(id);
      const state = states.get(id)!;
      if (change.visible !== undefined) state.visible = change.visible;
      if (change.locked !== undefined) state.locked = change.locked;
      return { ...state };
    },
    canSelect(id: string): boolean {
      const state = states.get(id);
      return !!state && state.visible && !state.locked;
    },
    clearCustom(): void {
      for (const id of states.keys()) {
        if (!(DEFAULT_EDITOR_LAYERS as readonly string[]).includes(id)) states.delete(id);
      }
      for (const state of states.values()) { state.visible = true; state.locked = false; }
    },
  };
}
