import type { WeaponDefinition } from "../equipment/weaponDefinitions.ts";

export interface HeroBaseStats {
  readonly maxHealth: number;
  readonly attack: number;
  readonly strength: number;
  readonly defense: number;
  readonly agility: number;
  readonly intelligence: number;
}

export interface HeroDefinition {
  readonly id: "hero";
  readonly startingLevel: number;
  readonly baseStats: HeroBaseStats;
  readonly startingEquipment: Readonly<{ mainHand: string | null }>;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Définition invalide : ${name}.`);
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, name: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`Statistique invalide : ${name}.`);
  }
  return value;
}

export function parseHeroDefinition(value: unknown): HeroDefinition {
  const definition = record(value, "hero");
  const base = record(definition.baseStats, "baseStats");
  const equipment = record(definition.startingEquipment, "startingEquipment");
  if (definition.id !== "hero" ||
      (equipment.mainHand !== null && typeof equipment.mainHand !== "string")) {
    throw new Error("Identifiant du héros ou équipement initial invalide.");
  }
  return Object.freeze({
    id: "hero",
    startingLevel: integer(definition.startingLevel, "startingLevel", 1),
    baseStats: Object.freeze({
      maxHealth: integer(base.maxHealth, "maxHealth", 1),
      attack: integer(base.attack, "attack"),
      strength: integer(base.strength, "strength"),
      defense: integer(base.defense, "defense"),
      agility: integer(base.agility, "agility"),
      intelligence: integer(base.intelligence, "intelligence"),
    }),
    startingEquipment: Object.freeze({ mainHand: equipment.mainHand }),
  }) as HeroDefinition;
}

/** Hero stats and equipment bonuses are combined exactly once at the gameplay boundary. */
export function calculateHeroStats(base: HeroBaseStats, weapon?: WeaponDefinition): HeroBaseStats {
  return {
    ...base,
    attack: base.attack + (weapon?.stats.attack ?? 0) + Math.floor(base.strength / 2),
  };
}
