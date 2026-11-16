import type { MapDefinition, MapPosition } from "../world/maps/types.ts";
import { terrainBounds } from "../world/maps/validation.ts";
import { wallFitsTerrain } from "../world/maps/wallPlacement.ts";
import type { PrefabCatalog } from "../world/maps/prefabDefinitions.ts";

export type ResizeAnchor = "center" | "origin";
export interface TerrainSize { width: number; depth: number }
export interface TerrainSnapshot {
  origin: MapPosition;
  tiles: (string | null)[][];
}

const MAX_CELLS = 4096;

/** Prepare new terrain data before touching a live Babylon scene. */
export function resizeTerrain(
  map: MapDefinition,
  size: TerrainSize,
  anchor: ResizeAnchor,
  prefabCatalog?: PrefabCatalog,
): TerrainSnapshot {
  const cellCount = (units: number, dimension: string): number => {
    const cells = units / map.tileSize;
    if (!Number.isFinite(cells) || !Number.isInteger(cells) || cells < 1) {
      throw new Error(dimension + " doit être un multiple positif de tileSize.");
    }
    return cells;
  };
  const width = cellCount(size.width, "Largeur");
  const depth = cellCount(size.depth, "Profondeur");
  if (width * depth > MAX_CELLS) throw new Error("Terrain limité à 4096 cellules.");
  const oldRows = map.terrain.tiles;
  const oldWidth = oldRows[0].length;
  const oldDepth = oldRows.length;
  const changeX = width - oldWidth;
  const changeZ = depth - oldDepth;
  if (anchor !== "center" && anchor !== "origin") throw new Error("Ancrage terrain inconnu.");
  // Central resize must shift entire cells so nonempty tiles remain aligned.
  if (anchor === "center" && (changeX % 2 || changeZ % 2)) {
    throw new Error("Redimensionnement centré : ajouter ou retirer des cellules par paires.");
  }
  const shiftX = anchor === "center" ? changeX / 2 : 0;
  const shiftZ = anchor === "center" ? changeZ / 2 : 0;
  const tiles = Array.from({ length: depth }, () => Array<string | null>(width).fill(null));
  for (let z = 0; z < oldDepth; z++) {
    for (let x = 0; x < oldWidth; x++) {
      const newZ = z + shiftZ;
      const newX = x + shiftX;
      if (tiles[newZ]?.[newX] !== undefined) {
        tiles[newZ][newX] = oldRows[z][x];
      } else if (oldRows[z][x] !== null) {
        throw new Error("Impossible de couper une tuile existante.");
      }
    }
  }
  const origin: MapPosition = [
    map.terrain.origin[0] - shiftX * map.tileSize,
    map.terrain.origin[1],
    map.terrain.origin[2] - shiftZ * map.tileSize,
  ];
  const candidate: MapDefinition = { ...map, terrain: { ...map.terrain, origin, tiles } };
  const bounds = terrainBounds(candidate);
  const within = (position: MapPosition): boolean =>
    position[0] >= bounds.minX && position[0] < bounds.maxX &&
    position[2] >= bounds.minZ && position[2] < bounds.maxZ;
  const positions = [
    ...map.objects.map((item) => item.position),
    ...(map.prefabs ?? []).map((item) => item.position),
    ...(map.primitives ?? []).map((item) => item.position),
    ...map.spawnPoints.map((item) => item.position),
    ...(map.enemySpawns ?? []).map((item) => item.position),
    ...(map.exits ?? []).map((item) => item.position),
    ...(map.interactions ?? []).map((item) => item.position),
  ];
  if (!positions.every(within)) {
    throw new Error("Des objets ou points d'apparition seraient hors des limites.");
  }
  if (prefabCatalog && (map.prefabs ?? []).some((wall) =>
    !wallFitsTerrain(candidate, prefabCatalog, wall))) {
    throw new Error("La réduction ferait dépasser un mur du terrain.");
  }
  return { origin, tiles };
}
