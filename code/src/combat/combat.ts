import { intersectsMeleeHitbox } from "./hitDetection.ts";

export type Position = readonly [number, number, number];

export type Hurtbox = { height: number; offset: Position } & (
  { shape: "cylinder"; radius: number } | { shape: "box"; width: number; depth: number }
);

export interface RegenerationSettings {
  enabled: boolean;
  delay: number;
  healthPerSecond: number;
}

export interface CombatState {
  stats: { maxHealth: number; defense: number };
  immortal: boolean;
  regeneration: RegenerationSettings;
  health: number;
  defeated: boolean;
  sinceHit: number;
}

export function applyDamage(enemy: CombatState, rawDamage: number): boolean {
  if (enemy.defeated || !Number.isFinite(rawDamage) || rawDamage <= 0) return false;
  const damage = Math.max(1, Math.floor(rawDamage) - enemy.stats.defense);
  enemy.health = Math.max(enemy.immortal ? 1 : 0, enemy.health - damage);
  enemy.defeated = enemy.health === 0;
  enemy.sinceHit = 0;
  return true;
}

export function regenerate(enemy: CombatState, delta: number): void {
  if (enemy.defeated || enemy.health >= enemy.stats.maxHealth) return;
  const { enabled, delay, healthPerSecond } = enemy.regeneration;
  const timeBeforeHealing = Math.max(0, delay - enemy.sinceHit);
  enemy.sinceHit += delta;
  if (enabled) {
    enemy.health = Math.min(enemy.stats.maxHealth, enemy.health + Math.max(0, delta - timeBeforeHealing) * healthPerSecond);
  }
}

export const SWORD_SWING = { damage: 25, range: 1.8, radius: 0.55, height: 1 };
export type SwordSwing = typeof SWORD_SWING;

/** A forward sword sweep against a cylinder or oriented rectangular hurtbox. */
export function intersectsSwing(
  origin: Position,
  yaw: number,
  position: Position,
  box: Hurtbox,
  targetYaw = 0,
  swing: SwordSwing = SWORD_SWING,
): boolean {
  return intersectsMeleeHitbox(origin, yaw, position, box, {
    range: swing.range,
    radius: swing.radius,
    elevation: swing.height,
    verticalRadius: 0,
  }, targetYaw);
}
