/** Bone ownership is deliberately independent of Babylon so the rig rules can be tested. */
export function isUpperBodyBone(name: string): boolean {
  const bone = name.split(":").at(-1) ?? name;
  return /^(?:Spine\d*|Neck\d*|Head(?:Top_End)?|(?:Left|Right)(?:Shoulder|Arm|ForeArm|Hand.*))$/i.test(bone);
}

/** Cross-fade the attack in and out without resetting its timeline. */
export function attackLayerWeight(elapsed: number, remaining: number, fadeSeconds = 0.12): number {
  if (!Number.isFinite(elapsed) || !Number.isFinite(remaining) || fadeSeconds <= 0) return 0;
  return Math.max(0, Math.min(1, elapsed / fadeSeconds, remaining / fadeSeconds));
}

export type HeroActionKind = "attack" | "dodge" | "preview";

/** Only a light attack allows player-directed movement; dodge owns its trajectory. */
export function allowsLocomotion(kind?: HeroActionKind): boolean {
  return kind === undefined || kind === "attack";
}
