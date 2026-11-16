import type { MapDefinition, MapPosition } from "./types.ts";
import type { PrefabCatalog, PrefabDefinition, PrefabPlacement } from "./prefabDefinitions.ts";
import { rotateLocal } from "./prefabDefinitions.ts";
import { terrainBounds } from "./validation.ts";

export function isWallPrefab(id: string): boolean {
  return id.startsWith("wall-");
}

export interface WallFootprint {
  minX: number; maxX: number; minZ: number; maxZ: number;
}

/** The visible parts, rather than collider centers, determine where the wall fits. */
export function wallFootprint(definition: PrefabDefinition, placement: PrefabPlacement): WallFootprint {
  const scaleX = placement.scale * (placement.scaleAxes?.[0] ?? 1);
  const scaleZ = placement.scale * (placement.scaleAxes?.[2] ?? 1);
  const yaw = placement.rotationY * Math.PI / 180;
  const footprint = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const part of definition.parts) {
    const localYaw = part.rotationY * Math.PI / 180;
    for (const cornerX of [-part.size[0] / 2, part.size[0] / 2]) {
      for (const cornerZ of [-part.size[2] / 2, part.size[2] / 2]) {
        const rotated = rotateLocal(cornerX, cornerZ, localYaw);
        const point = rotateLocal(
          (part.position[0] + rotated.x) * scaleX,
          (part.position[2] + rotated.z) * scaleZ,
          yaw,
        );
        footprint.minX = Math.min(footprint.minX, point.x);
        footprint.maxX = Math.max(footprint.maxX, point.x);
        footprint.minZ = Math.min(footprint.minZ, point.z);
        footprint.maxZ = Math.max(footprint.maxZ, point.z);
      }
    }
  }
  return footprint;
}

/** Reposition a perimeter wall so every visible part stays inside all four borders. */
export function fitWallToTerrain(
  map: MapDefinition, catalog: PrefabCatalog | undefined, placement: PrefabPlacement,
): PrefabPlacement {
  if (!isWallPrefab(placement.prefab)) return placement;
  const definition = catalog?.[placement.prefab];
  if (!definition) throw new Error("Définition du mur introuvable : " + placement.prefab);
  const bounds = terrainBounds(map);
  const shape = wallFootprint(definition, placement);
  const minX = bounds.minX - shape.minX;
  const maxX = bounds.maxX - shape.maxX;
  const minZ = bounds.minZ - shape.minZ;
  const maxZ = bounds.maxZ - shape.maxZ;
  if (minX > maxX + 1e-7 || minZ > maxZ + 1e-7) {
    throw new Error("Ce mur est trop grand pour les dimensions du terrain.");
  }
  const [x, y, z] = placement.position;
  if (![x, y, z].every(Number.isFinite)) throw new Error("Position de mur invalide.");
  const position: MapPosition = [
    Math.max(minX, Math.min(maxX, x)),
    y,
    Math.max(minZ, Math.min(maxZ, z)),
  ];
  return { ...placement, position };
}

export function wallFitsTerrain(
  map: MapDefinition, catalog: PrefabCatalog | undefined, placement: PrefabPlacement,
): boolean {
  if (!isWallPrefab(placement.prefab)) return true;
  const fitted = fitWallToTerrain(map, catalog, placement);
  return Math.abs(fitted.position[0] - placement.position[0]) < 1e-6 &&
    Math.abs(fitted.position[2] - placement.position[2]) < 1e-6;
}

/** A small interaction margin lets designers pick the formerly exclusive max edges. */
export function isNearTerrain(map: MapDefinition, x: number, z: number, margin: number): boolean {
  const bounds = terrainBounds(map);
  return Number.isFinite(x) && Number.isFinite(z) && Number.isFinite(margin) && margin >= 0 &&
    x >= bounds.minX - margin && x <= bounds.maxX + margin &&
    z >= bounds.minZ - margin && z <= bounds.maxZ + margin;
}
