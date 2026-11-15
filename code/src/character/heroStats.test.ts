import assert from "node:assert/strict";
import test from "node:test";
import { calculateHeroStats, parseHeroDefinition } from "./heroStats.ts";
import { createHeroState } from "./heroState.ts";
import { parseWeaponDefinitions } from "../equipment/weaponDefinitions.ts";

const hero = {
  id: "hero", startingLevel: 1,
  baseStats: { maxHealth: 100, attack: 5, strength: 10, defense: 0, agility: 5, intelligence: 5 },
  startingEquipment: { mainHand: "blade" },
};
const weapons = parseWeaponDefinitions({ version: 1, weapons: [
  { id: "blade", name: "Lame", type: "dagger", slot: "mainHand",
    icon: "/assets/weapons/icons/blade.webp", stats: { attack: 15 } },
  { id: "other", name: "Autre", type: "dagger", slot: "mainHand",
    icon: "/assets/weapons/icons/other.webp", stats: { attack: 20 } },
] });

test("hero starts with blade; computed attack never double-counts the weapon", () => {
  const state = createHeroState(parseHeroDefinition(hero), weapons);
  assert.equal(state.stats.attack, 25);
  assert.equal(calculateHeroStats(state.baseStats, state.equipment.mainHand).attack, 25);
  state.equipment.equipMainHand("other");
  assert.equal(state.stats.attack, 30);
  state.equipment.equipMainHand(null);
  assert.equal(state.stats.attack, 10);
  assert.equal(state.baseStats.attack, 5);
});

test("invalid hero values and unknown initial equipment are rejected", () => {
  assert.throws(() => parseHeroDefinition({
    ...hero, baseStats: { ...hero.baseStats, maxHealth: 0 },
  }), /maxHealth/);
  assert.throws(() => createHeroState(parseHeroDefinition({
    ...hero, startingEquipment: { mainHand: "missing" },
  }), weapons), /inconnue/);
});
