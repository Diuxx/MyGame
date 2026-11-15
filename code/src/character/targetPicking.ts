import type { TargetCandidate, TargetPosition } from "./targetSelection.ts";

export interface RayVector { x: number; y: number; z: number }
export interface TargetRay { origin: RayVector; direction: RayVector }

const EPSILON = 1e-8;

/**
 * Intersect a vertical cylinder approximating the enemy hurtbox.
 * We use the simulation snapshot, not imported GLB meshes (which may be unpickable).
 * Returns the nearest positive distance along the ray.
 */
function hitDistance(ray: TargetRay, target: TargetCandidate): number | undefined {
  const radius = Math.max(0.3, target.radius);
  const centerY = target.groundY + (target.clickOffsetY ?? 0.9);
  const halfHeight = (target.clickHeight ?? 1.8) / 2;
  const minY = centerY - halfHeight;
  const maxY = centerY + halfHeight;
  const ox = ray.origin.x - target.x;
  const oz = ray.origin.z - target.z;
  const { x: dx, y: dy, z: dz } = ray.direction;
  let closest = Infinity;

  const a = dx * dx + dz * dz;
  const b = 2 * (ox * dx + oz * dz);
  const c = ox * ox + oz * oz - radius * radius;
  const discriminant = b * b - 4 * a * c;

  if (a > EPSILON && discriminant >= 0) {
    const squareRoot = Math.sqrt(discriminant);
    for (const t of [(-b - squareRoot) / (2 * a), (-b + squareRoot) / (2 * a)]) {
      const y = ray.origin.y + dy * t;
      if (t >= 0 && y >= minY && y <= maxY) closest = Math.min(closest, t);
    }
  }

  if (Math.abs(dy) > EPSILON) {
    for (const y of [minY, maxY]) {
      const t = (y - ray.origin.y) / dy;
      const x = ox + dx * t;
      const z = oz + dz * t;
      if (t >= 0 && x * x + z * z <= radius * radius) closest = Math.min(closest, t);
    }
  }
  return Number.isFinite(closest) ? closest : undefined;
}

/** Pick the frontmost alive target under the cursor, within the manual selection radius. */
export function pickTargetByRay(
  ray: TargetRay,
  hero: TargetPosition,
  candidates: readonly TargetCandidate[],
  acquireRadius: number,
): TargetCandidate | undefined {
  if (acquireRadius <= 0) return undefined;
  let picked: TargetCandidate | undefined;
  let distance = Infinity;
  for (const candidate of candidates) {
    if (!candidate.alive || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.z)) continue;
    if (Math.hypot(candidate.x - hero.x, candidate.z - hero.z) > acquireRadius) continue;
    const hit = hitDistance(ray, candidate);
    if (hit !== undefined && hit < distance) {
      picked = candidate;
      distance = hit;
    }
  }
  return picked;
}
