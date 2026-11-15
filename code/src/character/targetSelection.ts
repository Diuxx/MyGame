import type { TargetingSettings } from "./targetingSettings.ts";

export interface TargetCandidate {
  id: string;
  x: number;
  z: number;
  alive: boolean;
  radius: number;
  groundY: number;
}

export interface TargetPosition {
  x: number;
  z: number;
}

function squaredDistance(a: TargetPosition, b: TargetPosition): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

/**
 * Preserve the current target within the release radius (hysteresis).
 * Only acquire a new target inside the smaller detection radius.
 * Stable IDs avoid retargeting repeatedly when enemies cross paths.
 */
export function selectTarget(
  origin: TargetPosition,
  candidates: readonly TargetCandidate[],
  currentId: string | undefined,
  settings: TargetingSettings,
): TargetCandidate | undefined {
  if (!settings.enabled) return undefined;
  const available = candidates.filter((candidate) =>
    candidate.alive && Number.isFinite(candidate.x) && Number.isFinite(candidate.z));
  if (currentId) {
    const current = available.find((candidate) => candidate.id === currentId);
    if (current && squaredDistance(origin, current) <= settings.releaseRadius ** 2) return current;
  }
  let nearest: TargetCandidate | undefined;
  let distance = settings.acquireRadius ** 2;
  for (const candidate of available) {
    const nextDistance = squaredDistance(origin, candidate);
    if (nextDistance < distance || (nextDistance === distance && nearest && candidate.id < nearest.id)) {
      nearest = candidate;
      distance = nextDistance;
    }
  }
  return nearest;
}

export function targetYaw(origin: TargetPosition, target: TargetPosition): number {
  return Math.atan2(target.x - origin.x, target.z - origin.z);
}

/** Camera screen-up direction projected on the ground (Babylon ArcRotateCamera alpha). */
export function cameraMovementYaw(alphaRadians: number): number {
  return Math.atan2(-Math.cos(alphaRadians), -Math.sin(alphaRadians));
}

export function movementYaw(
  settings: TargetingSettings,
  cameraAlpha: number,
  origin: TargetPosition,
  target: TargetPosition,
): number {
  return settings.movementReference === "target"
    ? targetYaw(origin, target) : cameraMovementYaw(cameraAlpha);
}
