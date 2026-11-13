import type { CombatState, Position } from "../combat/combat.ts";
import { validateEnemySettings, type EnemyDefinition, type EnemySettings } from "./enemyDefinitions.ts";

export type Enemy = EnemySettings & CombatState & {
  id: string;
  definition: EnemyDefinition;
  position: Position;
};

export function configureEnemy(enemy: Enemy, settings: EnemySettings): void {
  validateEnemySettings(settings);
  enemy.stats = { ...settings.stats };
  enemy.immortal = settings.immortal;
  enemy.regeneration = { ...settings.regeneration };
  enemy.health = Math.min(enemy.health, enemy.stats.maxHealth);
  // Editing a defeated enemy does not revive it. The reset action does.
}

export function createEnemy(id: string, definition: EnemyDefinition, position: Position, settings: EnemySettings): Enemy {
  // Never spread an archetype as settings: it also contains an `id` that can overwrite the instance ID.
  const enemy: Enemy = {
    id,
    definition,
    position,
    stats: { ...settings.stats },
    immortal: settings.immortal,
    regeneration: { ...settings.regeneration },
    health: 0,
    defeated: false,
    sinceHit: 0,
  };
  configureEnemy(enemy, settings);
  resetEnemy(enemy);
  return enemy;
}

export function resetEnemy(enemy: Enemy): void {
  enemy.health = enemy.stats.maxHealth;
  enemy.defeated = false;
  enemy.sinceHit = 0;
}

