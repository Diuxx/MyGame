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

/** Render-independent motion request used by the player controller. */
export interface TargetingMotion {
  target: TargetPosition;
  movementReference: TargetingSettings["movementReference"];
  turnSpeed: number;
}

function squaredDistance(a: TargetPosition, b: TargetPosition): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

/** A target remains locked only while alive and inside the larger release radius. */
export function selectTarget(
  origin: TargetPosition,
  candidates: readonly TargetCandidate[],
  currentId: string | undefined,
  settings: TargetingSettings,
): TargetCandidate | undefined {
  if (!settings.enabled || !currentId) return undefined;
  return candidates.find((candidate) =>
    candidate.id === currentId && candidate.alive &&
    Number.isFinite(candidate.x) && Number.isFinite(candidate.z) &&
    squaredDistance(origin, candidate) <= settings.releaseRadius ** 2);
}

/** W acquires the nearest eligible target, then cycles deterministically through nearby enemies. */
export function cycleTarget(
  origin: TargetPosition,
  candidates: readonly TargetCandidate[],
  currentId: string | undefined,
  settings: TargetingSettings,
): TargetCandidate | undefined {
  if (!settings.enabled) return undefined;
  const nearby = candidates.filter((candidate) =>
    candidate.alive && Number.isFinite(candidate.x) && Number.isFinite(candidate.z) &&
    squaredDistance(origin, candidate) <= settings.acquireRadius ** 2);
  nearby.sort((a, b) => squaredDistance(origin, a) - squaredDistance(origin, b) || a.id.localeCompare(b.id));
  if (!nearby.length) return undefined;
  const currentIndex = nearby.findIndex((candidate) => candidate.id === currentId);
  return nearby[(currentIndex + 1) % nearby.length];
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
