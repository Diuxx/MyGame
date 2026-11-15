import { calculateHeroStats, parseHeroDefinition, type HeroDefinition } from "./heroStats.ts";
import { createEquipmentState } from "../equipment/equipmentState.ts";
import { parseWeaponDefinitions, type WeaponDefinition } from "../equipment/weaponDefinitions.ts";

export function createHeroState(definition: HeroDefinition, weapons: readonly WeaponDefinition[]) {
  const equipment = createEquipmentState(weapons, definition.startingEquipment.mainHand);
  return {
    level: definition.startingLevel,
    baseStats: definition.baseStats,
    equipment,
    get stats() { return calculateHeroStats(definition.baseStats, equipment.mainHand); },
  };
}

export type HeroState = ReturnType<typeof createHeroState>;

async function readJson(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path);
  } catch (cause) {
    throw new Error(`Impossible de charger ${path}.`, { cause });
  }
  if (!response.ok) throw new Error(`Définition inaccessible : ${path} (HTTP ${response.status}).`);
  try {
    return await response.json() as unknown;
  } catch (cause) {
    throw new Error(`JSON invalide : ${path}.`, { cause });
  }
}

export async function loadHeroState(): Promise<HeroState> {
  const [hero, catalog] = await Promise.all([
    readJson("/assets/definitions/hero.json"),
    readJson("/assets/definitions/weapons.json"),
  ]);
  return createHeroState(parseHeroDefinition(hero), parseWeaponDefinitions(catalog));
}
