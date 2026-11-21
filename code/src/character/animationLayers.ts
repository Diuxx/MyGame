import { HERO_TUNING } from "./heroTuning.ts";

/** Bone ownership is deliberately independent of Babylon so the rig rules can be tested. */
export function isUpperBodyBone(name: string): boolean {
  const bone = name.split(":").at(-1) ?? name;
  return HERO_TUNING.blending.upperBodyBones.test(bone);
}

/** Cross-fade the attack in and out without resetting its timeline. */
export function attackLayerWeight(elapsed: number, remaining: number, fadeSeconds = HERO_TUNING.blending.attackFadeSeconds): number {
  if (!Number.isFinite(elapsed) || !Number.isFinite(remaining) || fadeSeconds <= 0) return 0;
  return Math.max(0, Math.min(1, elapsed / fadeSeconds, remaining / fadeSeconds));
}

export type HeroActionKind = "attack" | "skill" | "dodge" | "preview" | "stop";

/** Only a light attack allows player-directed movement; dodge owns its trajectory. */
export function allowsLocomotion(kind?: HeroActionKind): boolean {
  return kind === undefined || (kind === "attack" && HERO_TUNING.attack.allowMovement);
}
