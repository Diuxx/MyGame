import type { Position } from "../combat/combat.ts";
import { validateEnemySettings, type EnemyDefinition, type EnemySettings } from "./enemyDefinitions.ts";
import type { Enemy } from "./enemyState.ts";

export const ENEMY_STORAGE_KEY = "mygame.playground.enemies.v1";
const MAX_INSTANCES = 64;

export interface SavedEnemy {
  definitionId: string;
  position: Position;
  settings: EnemySettings;
}

interface EnemySnapshot {
  version: 1;
  instances: SavedEnemy[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function serializeEnemyInstances(enemies: readonly Enemy[]): string {
  if (enemies.length > MAX_INSTANCES) throw new Error("Trop d’ennemis à sauvegarder (maximum 64).");
  const snapshot: EnemySnapshot = {
    version: 1,
    instances: enemies.map((enemy) => ({
      definitionId: enemy.definition.id,
      position: [enemy.position[0], enemy.position[1], enemy.position[2]],
      settings: {
        stats: { ...enemy.stats },
        immortal: enemy.immortal,
        regeneration: { ...enemy.regeneration },
        ...(enemy.collision ? { collision: { ...enemy.collision } } : {}),
      },
    })),
  };
  return JSON.stringify(snapshot, null, 2);
}

/** Validate untrusted JSON completely before any scene instance is replaced. */
export function parseEnemyInstances(json: string, definitions: readonly EnemyDefinition[]): SavedEnemy[] {
  let source: unknown;
  try {
    source = JSON.parse(json);
  } catch (error) {
    throw new Error("Le fichier JSON des ennemis est illisible.", { cause: error });
  }
  if (!isRecord(source) || source.version !== 1 || !Array.isArray(source.instances) ||
      source.instances.length > MAX_INSTANCES) {
    throw new Error("Format ou version de sauvegarde des ennemis invalide (maximum 64 instances).");
  }
  const available = new Set(definitions.map(({ id }) => id));
  return source.instances.map((candidate: unknown, index: number) => {
    if (!isRecord(candidate) || typeof candidate.definitionId !== "string" ||
        !available.has(candidate.definitionId)) {
      throw new Error(`Type d'ennemi inconnu à la position ${index + 1}.`);
    }
    if (!Array.isArray(candidate.position) || candidate.position.length !== 3 ||
        !candidate.position.every((value: unknown) => typeof value === "number" && Number.isFinite(value))) {
      throw new Error(`Position invalide pour l'ennemi ${index + 1}.`);
    }
    validateEnemySettings(candidate.settings);
    return {
      definitionId: candidate.definitionId,
      position: [candidate.position[0], candidate.position[1], candidate.position[2]],
      settings: {
        stats: { ...candidate.settings.stats },
        immortal: candidate.settings.immortal,
        regeneration: { ...candidate.settings.regeneration },
        ...(candidate.settings.collision ? { collision: { ...candidate.settings.collision } } : {}),
      },
    };
  });
}
