import type { PrefabPlacement } from "../world/maps/prefabDefinitions.ts";
import type { MapPosition } from "../world/maps/types.ts";

/** JSON-only clipboard contents. Copying never retains a mutable map object. */
export interface PrefabClipboard {
  readonly items: readonly PrefabPlacement[];
  readonly origin: MapPosition;
}

export function copyPrefabs(placements: readonly PrefabPlacement[]): PrefabClipboard {
  if (!placements.length) throw new Error("Aucun bloc sélectionné.");
  const items = structuredClone(placements);
  const count = items.length;
  const origin: MapPosition = [
    items.reduce((sum, item) => sum + item.position[0], 0) / count,
    items.reduce((sum, item) => sum + item.position[1], 0) / count,
    items.reduce((sum, item) => sum + item.position[2], 0) / count,
  ];
  return { items, origin };
}

export function pastePrefabs(
  clipboard: PrefabClipboard,
  destination: MapPosition,
  takenIds: ReadonlySet<string>,
): PrefabPlacement[] {
  if (!destination.every(Number.isFinite)) throw new Error("Position de collage invalide.");
  const ids = new Set(takenIds);
  return clipboard.items.map((item) => {
    let suffix = 1;
    let id = "";
    do {
      const tail = "-copy-" + suffix++;
      id = item.id.slice(0, 80 - tail.length) + tail;
    } while (ids.has(id));
    ids.add(id);
    const offset = item.position.map((axis, i) => axis - clipboard.origin[i]);
    return {
      ...structuredClone(item),
      id,
      position: destination.map((axis, i) => axis + offset[i]) as unknown as MapPosition,
    };
  });
}
