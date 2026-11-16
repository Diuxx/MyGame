import { buildMapObstacles, type FlatObstacle } from "./mapCollision.ts";
import type { MapAssets, MapDefinition } from "./types.ts";

/** Data-only navigation seam. A* and grid rasterization are deferred to P2. */
export interface NavigationData {
  walkable: boolean[][];
  blockingObjects: { id: string; colliders: FlatObstacle[] }[];
}

export function createNavigationData(map: MapDefinition, assets: MapAssets): NavigationData {
  const walkable = map.terrain.tiles.map((row) => row.map((tile) => tile === null || assets.tiles[tile].walkable));
  return {
    walkable,
    blockingObjects: map.objects
      .filter((item) => assets.objects[item.asset].blocksNavigation)
      .map((item) => ({
        id: item.id,
        colliders: buildMapObstacles({ ...map, objects: [item], primitives: [], prefabs: [] }, assets),
      })).concat((map.primitives ?? []).filter((item) => item.blocksMovement)
        .map((item) => ({
          id: item.id,
          colliders: buildMapObstacles({ ...map, objects: [], primitives: [item], prefabs: [] }, assets),
        }))).concat((map.prefabs ?? [])
        .filter((item) => (assets.prefabs?.[item.prefab].colliders.length ?? 0) > 0)
        .map((item) => ({
          id: item.id,
          colliders: buildMapObstacles({ ...map, objects: [], primitives: [], prefabs: [item] }, assets),
        }))),
  };
}
