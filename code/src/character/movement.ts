import { HERO_TUNING } from "./heroTuning.ts";
import { HERO_ANIMATIONS } from "./animationSettings.ts";

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

/** Normalized ground movement relative to a chosen heading (camera or locked target). */
export function relativeMovementDirection(horizontal: number, vertical: number, yaw: number): GroundVector {
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

export function dodgeDirection(yaw: number): GroundVector {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

/** Match the windup, push-off and landing in dodging-back.fbx. */
export function dodgeTravelProgress(progress: number): number {
  const { from, until } = HERO_TUNING.dodge.travel;
  const travel = Math.min(1, Math.max(0, (progress - from) / (until - from)));
  return travel * travel * (3 - 2 * travel);
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
