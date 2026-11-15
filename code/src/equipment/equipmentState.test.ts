import assert from "node:assert/strict";
import test from "node:test";
import { createEquipmentState } from "./equipmentState.ts";
import { parseWeaponDefinitions } from "./weaponDefinitions.ts";

const catalog = {
  version: 1,
  weapons: [
    { id: "blade", name: "Lame", type: "dagger", slot: "mainHand",
      icon: "/assets/weapons/icons/blade.webp", stats: { attack: 15 } },
    { id: "second", name: "Seconde", type: "sword", slot: "mainHand",
      icon: "/assets/weapons/icons/second.webp", stats: { attack: 20 } },
  ],
};

test("catalog validates identities, stats and allowed assets", () => {
  const weapons = parseWeaponDefinitions(catalog);
  assert.equal(weapons.length, 2);
  assert.throws(() => parseWeaponDefinitions({ ...catalog, weapons: [catalog.weapons[0], catalog.weapons[0]] }), /dupliqué/);
  assert.throws(() => parseWeaponDefinitions({
    ...catalog, weapons: [{ ...catalog.weapons[0], stats: { attack: -2 } }],
  }), /Statistique/);
  assert.throws(() => parseWeaponDefinitions({
    ...catalog, weapons: [{ ...catalog.weapons[0], icon: "javascript:alert(1)" }],
  }), /Icône/);
});

test("equip, switch and unequip without modifying the definitions", () => {
  const weapons = parseWeaponDefinitions(catalog);
  const equipment = createEquipmentState(weapons, "blade");
  assert.equal(equipment.mainHand?.stats.attack, 15);
  equipment.equipMainHand("second");
  assert.equal(equipment.mainHandId, "second");
  equipment.equipMainHand(null);
  assert.equal(equipment.mainHand, undefined);
  assert.throws(() => equipment.equipMainHand("missing"), /inconnue/);
  assert.equal(equipment.mainHandId, null);
  assert.equal(weapons[0].stats.attack, 15);
});
