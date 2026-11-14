import type { WorldInteraction } from "./editorSchema.ts";

export interface InteractionOutcome {
  id: string;
  kind: WorldInteraction["kind"];
  message: string;
  itemId?: string;
}

/** V1: world proximity and pickup state, with no renderer or storage dependency. */
export function createWorldInteractions(definitions: readonly WorldInteraction[]) {
  const picked = new Set<string>();
  const inventory = new Map<string, number>();

  function nearby(hero: readonly [number, number, number]): WorldInteraction | undefined {
    let closest: WorldInteraction | undefined;
    let closestDistance = Infinity;
    for (const object of definitions) {
      if (picked.has(object.id)) continue;
      const distance = Math.hypot(hero[0] - object.position[0], hero[2] - object.position[2]);
      if (distance > object.range || distance >= closestDistance) continue;
      closest = object;
      closestDistance = distance;
    }
    return closest;
  }

  return {
    nearby,
    isPicked: (id: string) => picked.has(id),
    getInventory: () => Object.fromEntries(inventory),
    interact(hero: readonly [number, number, number]): InteractionOutcome | undefined {
      const object = nearby(hero);
      if (!object) return undefined;
      if (object.kind === "pickup" && object.itemId) {
        picked.add(object.id);
        inventory.set(object.itemId, (inventory.get(object.itemId) ?? 0) + 1);
        return { id: object.id, kind: object.kind, itemId: object.itemId, message: "Ramassé : " + object.label };
      }
      return { id: object.id, kind: object.kind,
        message: (object.kind === "inspect" ? "Observation : " : "Interaction : ") + object.label };
    },
  };
}
