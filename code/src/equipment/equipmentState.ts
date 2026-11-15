import type { WeaponDefinition } from "./weaponDefinitions.ts";

export function createEquipmentState(weapons: readonly WeaponDefinition[], startingWeaponId: string | null) {
  const catalogue = new Map(weapons.map((weapon) => [weapon.id, weapon]));
  let mainHandId: string | null = null;

  function equipMainHand(id: string | null): void {
    if (id !== null) {
      const definition = catalogue.get(id);
      if (!definition || definition.slot !== "mainHand") {
        throw new Error(`Arme inconnue ou emplacement incompatible : ${id}.`);
      }
    }
    mainHandId = id;
  }

  equipMainHand(startingWeaponId);
  return {
    get mainHandId(): string | null { return mainHandId; },
    get mainHand(): WeaponDefinition | undefined {
      return mainHandId === null ? undefined : catalogue.get(mainHandId);
    },
    equipMainHand,
  };
}

export type EquipmentState = ReturnType<typeof createEquipmentState>;
