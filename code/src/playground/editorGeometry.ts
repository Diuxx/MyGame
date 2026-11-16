import type { PrefabDefinition } from "../world/maps/prefabDefinitions.ts";
import type { MapPosition } from "../world/maps/types.ts";

/** Estimate an authored prefab's local dimensions; not a collision hull. */
export function prefabDimensions(definition: PrefabDefinition): MapPosition {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (const part of definition.parts) {
    for (let i = 0; i < 3; i++) {
      minimum[i] = Math.min(minimum[i], part.position[i] - part.size[i] / 2);
      maximum[i] = Math.max(maximum[i], part.position[i] + part.size[i] / 2);
    }
  }
  return [maximum[0] - minimum[0], maximum[1] - minimum[1], maximum[2] - minimum[2]];
}
