import type { Hurtbox, RegenerationSettings } from "../combat/combat.ts";

export interface EnemyCollision {
  solid: boolean;
  radius: number;
}

export interface EnemySettings {
  collision?: EnemyCollision;
  stats: { maxHealth: number; defense: number; attackDamage: number; movementSpeed: number };
  immortal: boolean;
  regeneration: RegenerationSettings;
}

export interface EnemyDefinition extends EnemySettings {
  id: string;
  name: string;
  modelPath: string;
  category: "static" | "animated";
  hurtbox: Hurtbox;
  animationClips?: { idle: string; run: string };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function number(value: unknown, minimum = 0): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum;
}

export function validateEnemySettings(value: unknown): asserts value is EnemySettings {
  const settings = record(value);
  const stats = record(settings.stats);
  const regen = record(settings.regeneration);
  for (const [key, min] of [["maxHealth", 1], ["defense", 0], ["attackDamage", 0], ["movementSpeed", 0]] as const) {
    if (!number(stats[key], min)) throw new Error(`Statistique invalide : ${key} (minimum ${min}).`);
  }
  if (settings.collision !== undefined) {
    const collision = record(settings.collision);
    if (typeof collision.solid !== "boolean" || !number(collision.radius, 0.1) || collision.radius > 10) {
      throw new Error("Collision solide invalide (rayon entre 0,1 et 10).");
    }
  }
  if (typeof settings.immortal !== "boolean") throw new Error("Option d’immortalité invalide.");
  if (typeof regen.enabled !== "boolean" || !number(regen.delay) || !number(regen.healthPerSecond)) {
    throw new Error("Configuration de régénération invalide.");
  }
}

export function loadEnemyDefinitions(data: unknown): EnemyDefinition[] {
  if (!Array.isArray(data) || data.length === 0) throw new Error("Liste des ennemis invalide.");
  const ids = new Set<string>();
  return data.map((value: unknown) => {
    const definition = record(value);
    const { id, name, modelPath, category } = definition;
    if (typeof id !== "string" || !id.trim() || ids.has(id)) throw new Error(`Identifiant d’ennemi invalide : ${id}`);
    try {
      if (typeof name !== "string" || !name.trim() || typeof modelPath !== "string" || !/^\/(?!\/)[^?#\\]+\.glb$/i.test(modelPath) ||
          (category !== "static" && category !== "animated")) {
        throw new Error("Nom, chemin GLB ou catégorie invalide.");
      }
      validateEnemySettings(value);
      if (definition.animationClips !== undefined) {
        const { idle, run } = record(definition.animationClips);
        const isClipPath = (path: unknown) => typeof path === "string" &&
          /^\/assets\/(?!.*\.\.)[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*\.glb$/i.test(path);
        if (!isClipPath(idle) || !isClipPath(run)) {
          throw new Error("Clips idle et run : chemins GLB sous /assets/ attendus.");
        }
      }
      const box = record(definition.hurtbox);
      const positive = (n: unknown) => number(n) && n > 0;
      const dimensionsValid = box.shape === "cylinder" ? positive(box.radius)
        : box.shape === "box" && positive(box.width) && positive(box.depth);
      if (!dimensionsValid || !positive(box.height) || !Array.isArray(box.offset) ||
          box.offset.length !== 3 || !box.offset.every((n) => typeof n === "number" && Number.isFinite(n))) {
        throw new Error("Dimensions ou décalage de la zone de touche invalides.");
      }
      ids.add(id);
      return value as EnemyDefinition;
    } catch (error) {
      throw new Error(`Définition ${id} : ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  });
}
