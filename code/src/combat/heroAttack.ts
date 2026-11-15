import type { SwordSwing } from "./combat.ts";

/** A per-impact snapshot: character stats override legacy defaults, debug overrides are explicit. */
export function resolveHeroSwing(
  geometry: SwordSwing, calculatedAttack: number, overrideDamage?: number,
): SwordSwing {
  const damage = overrideDamage ?? calculatedAttack;
  if (!Number.isSafeInteger(damage) || damage < 1) {
    throw new Error("Dégâts d'attaque du héros invalides.");
  }
  return { ...geometry, damage };
}
