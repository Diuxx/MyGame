import type { PrefabCatalog, PrefabPlacement } from "../world/maps/prefabDefinitions.ts";

export function gridSnap(value: number, increment: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(increment) || increment <= 0) {
    throw new Error("Valeur ou pas de grille invalide.");
  }
  return Math.round(value / increment) * increment;
}

export function angleSnap(value: number, increment: number): number {
  return gridSnap(value, increment);
}

/** Simple, predictable wall endpoint snap; advanced surface anchors can follow later. */
export function snapWallEndpoint(
  x: number, z: number, moving: PrefabPlacement,
  placed: readonly PrefabPlacement[], catalog: PrefabCatalog,
  tolerance = 0.6,
): { x: number; z: number } | undefined {
  if (!moving.prefab.startsWith("wall-")) return;
  const movingSize = catalog[moving.prefab]?.parts[0]?.size[0];
  if (!movingSize) return;
  const movingYaw = moving.rotationY * Math.PI / 180;
  const mx = Math.cos(movingYaw) * movingSize * moving.scale / 2;
  const mz = -Math.sin(movingYaw) * movingSize * moving.scale / 2;
  for (const other of placed) {
    if (other.id === moving.id || !other.prefab.startsWith("wall-")) continue;
    const size = catalog[other.prefab]?.parts[0]?.size[0];
    if (!size) continue;
    const yaw = other.rotationY * Math.PI / 180;
    const ox = Math.cos(yaw) * size * other.scale / 2;
    const oz = -Math.sin(yaw) * size * other.scale / 2;
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const candidateX = other.position[0] + ox * a - mx * b;
      const candidateZ = other.position[2] + oz * a - mz * b;
      if (Math.hypot(x - candidateX, z - candidateZ) <= tolerance) {
        return { x: candidateX, z: candidateZ };
      }
    }
  }
}
