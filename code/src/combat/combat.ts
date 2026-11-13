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

export const SWORD_SWING = { damage: 25, range: 1.8, radius: 0.55, height: 1, impact: 0.4 };

/** A rounded forward segment at sword height against a vertical cylinder or axis-aligned box. */
export function intersectsSwing(origin: Position, yaw: number, position: Position, box: Hurtbox): boolean {
  const [x, y, z] = box.offset.map((offset, axis) => position[axis] + offset);
  if (Math.abs(origin[1] + SWORD_SWING.height - y) > box.height / 2) return false;
  const dx = x - origin[0];
  const dz = z - origin[2];
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  const projection = dx * forwardX + dz * forwardZ;
  if (projection < 0) return false;

  if (box.shape === "cylinder") {
    const along = Math.min(projection, SWORD_SWING.range);
    return Math.hypot(dx - along * forwardX, dz - along * forwardZ) <= box.radius + SWORD_SWING.radius;
  }

  // Intersect the forward segment with the box expanded by the swing radius.
  let near = 0;
  let far = SWORD_SWING.range;
  for (const [center, direction, halfSize] of [[dx, forwardX, box.width / 2], [dz, forwardZ, box.depth / 2]]) {
    const radius = halfSize + SWORD_SWING.radius;
    if (Math.abs(direction) < 1e-9) {
      if (Math.abs(center) > radius) return false;
      continue;
    }
    const a = (center - radius) / direction;
    const b = (center + radius) / direction;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  return true;
}
