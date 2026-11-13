import { SWORD_SWING, type SwordSwing } from "./combat.ts";

const LIMITS = {
  damage: [1, 10000],
  range: [0.1, 8],
  radius: [0.05, 3],
  height: [0, 4],
} as const;

export function parseSwordSwing(value: unknown): SwordSwing {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Réglages d'attaque invalides.");
  }
  const input = value as Record<string, unknown>;
  for (const name of ["damage", "range", "radius", "height"] as const) {
    const candidate = input[name];
    const [min, max] = LIMITS[name];
    if (typeof candidate !== "number" || !Number.isFinite(candidate) ||
        candidate < min || candidate > max) {
      throw new Error(`Valeur d'attaque invalide : ${name} (de ${min} à ${max}).`);
    }
  }
  return {
    damage: input.damage as number,
    range: input.range as number,
    radius: input.radius as number,
    height: input.height as number,
  };
}

export function defaultSwordSwing(): SwordSwing {
  return { ...SWORD_SWING };
}

export interface GroundPoint {
  x: number;
  z: number;
}

/**
 * Ground-plane footprint of the current melee hitbox: straight sides and a
 * rounded tip. The detector excludes centers behind the attacker (z < 0).
 * This is a debug projection, not the trajectory of an animated weapon.
 */
export function swordHitboxOutline(swing: SwordSwing, segments = 24): GroundPoint[] {
  const { radius, range } = swing;
  const points: GroundPoint[] = [{ x: -radius, z: 0 }, { x: -radius, z: range }];
  for (let i = 1; i <= segments; i++) {
    const angle = Math.PI - (Math.PI * i) / segments;
    points.push({ x: radius * Math.cos(angle), z: range + radius * Math.sin(angle) });
  }
  points.push({ x: radius, z: 0 });
  return points;
}
