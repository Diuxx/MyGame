import { localMovement, type GroundVector, type MovementMode } from "./movement.ts";
import { HERO_ANIMATIONS } from "./animationSettings.ts";

export const LOCOMOTION_CLIPS = {
  idle: HERO_ANIMATIONS.idle.id,
  walk: HERO_ANIMATIONS.walk.id,
  backward: HERO_ANIMATIONS.backward.id,
  run: HERO_ANIMATIONS.run.id,
  left: HERO_ANIMATIONS.left.id,
  right: HERO_ANIMATIONS.right.id,
};

export function locomotionWeights(
  displacement: GroundVector,
  yaw: number,
  running: boolean,
  mode: MovementMode,
  restClip: string,
  available: ReadonlySet<string>,
): Map<string, number> {
  const clips = LOCOMOTION_CLIPS;
  const forwardClip = running ? clips.run : clips.walk;
  if (!displacement.x && !displacement.z) return new Map([[restClip, 1]]);
  if (mode === "exploration") return new Map([[forwardClip, 1]]);

  const { forward, right } = localMovement(displacement, yaw);
  const total = Math.abs(forward) + Math.abs(right);
  const longitudinal = forward < 0 ? clips.backward : forwardClip;
  const strafe = right < 0 ? clips.left : clips.right;
  // Temporary walk pose for assets without a dedicated lateral clip.
  const lateral = available.has(strafe) ? strafe : clips.walk;
  if (Math.abs(right) < total * 1e-6) return new Map([[longitudinal, 1]]);
  if (Math.abs(forward) < total * 1e-6) return new Map([[lateral, 1]]);
  const forwardWeight = Math.abs(forward) / total;
  if (longitudinal === lateral) return new Map([[lateral, 1]]);
  return new Map([[longitudinal, forwardWeight], [lateral, 1 - forwardWeight]]);
}
