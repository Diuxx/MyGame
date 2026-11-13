import { HERO_TUNING } from "./heroTuning.ts";
import { HERO_ANIMATIONS } from "./animationSettings.ts";

export type MovementMode = "exploration" | "combat";

export interface GroundVector {
  x: number;
  z: number;
}

/** Smooth the shortest turn around Y, retaining the heading inside the dead zone. */
export function aimYaw(yaw: number, dx: number, dz: number, delta: number, speed: number, deadZone: number): number {
  if (Math.hypot(dx, dz) < deadZone || delta <= 0) return yaw;
  const difference = Math.atan2(dx, dz) - yaw;
  const shortest = Math.atan2(Math.sin(difference), Math.cos(difference));
  const angle = yaw + shortest * (1 - Math.exp(-speed * delta));
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Normalized ground direction relative to the cursor heading (+Z at yaw zero). */
export function mouseRelativeDirection(horizontal: number, vertical: number, yaw: number): GroundVector {
  const length = Math.hypot(horizontal, vertical);
  if (length === 0) return { x: 0, z: 0 };
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: (horizontal * cos + vertical * sin) / length,
    z: (vertical * cos - horizontal * sin) / length,
  };
}

export function calculateMovementStep(
  direction: GroundVector,
  deltaSeconds: number,
  speed: number,
): GroundVector {
  const distance = speed * Math.min(deltaSeconds, HERO_TUNING.maxMovementDelta);
  return { x: direction.x * distance, z: direction.z * distance };
}

export function localMovement(direction: GroundVector, yaw: number): { forward: number; right: number } {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return { forward: direction.x * sin + direction.z * cos, right: direction.x * cos - direction.z * sin };
}

export function dodgeDirection(direction: GroundVector, yaw: number): GroundVector {
  return direction.x || direction.z ? direction : { x: Math.sin(yaw), z: Math.cos(yaw) };
}

export function dodgeInvulnerable(progress: number, { from, until } = HERO_ANIMATIONS.dodge.dodge!.window): boolean {
  return progress >= from && progress < until;
}

/** Detect an impact even when one render step crosses the entire window. */
export function crossesImpactWindow(previous: number, progress: number, { from, until }: { from: number; until: number }): boolean {
  return progress > previous && progress >= from && (previous < until || (previous === 0 && until === 0));
}


/** Consume a one-shot impact once, regardless of whether it touches an enemy. */
export function consumeImpactWindow(
  event: { window: { from: number; until: number }; triggered: boolean },
  previous: number,
  progress: number,
): boolean {
  if (event.triggered || !crossesImpactWindow(previous, progress, event.window)) return false;
  event.triggered = true;
  return true;
}
