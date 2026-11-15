# Hero equipment — first blade implementation

This is a POC implementation note. The authoritative, immutable references remain `docs/PROJECT.md` and `docs/PROJETCT.md`.

## Sources of truth

- `code/public/assets/definitions/hero.json`: initial level, base hero stats and starting main-hand ID.
- `code/public/assets/definitions/weapons.json`: versioned, validated immutable weapon definitions. Each weapon has an ID, icon, mainHand slot and attack bonus; a GLB path is optional.
- `code/src/character/heroState.ts`: session-local hero state, calculated stat access and current equipment.
- `code/src/equipment/equipmentState.ts`: equip/unequip by ID, with validation against the weapon catalog.
- `code/src/character/heroStats.ts`: pure calculation, no rendering or combat side effects.
- `code/src/combat/heroVitals.ts`: existing current HP, invulnerability, death and respawn rules.

The POC deliberately has no inventory, weapon levels, item persistence or socket registry.

## Attack calculation

For the first implementation:

```text
Attack = BaseAttack + EquippedWeaponAttack + floor(Strength / 2)
5 + 15 + floor(10 / 2) = 25
```

`resolveHeroSwing` snapshots this damage per attack impact while retaining the existing swing range, radius and height. `applyDamage` continues to own defense and actual HP loss.

The Gameplay and Playground use the same stats; the Playground can optionally force a **test-only** damage value. Stored version-1 Playground attack settings are loaded with the debug override disabled and a visible migration notice, so an old custom value does not silently change the new hero stats.

Damage text still consumes the already resolved `DamageResolved.finalDamage` and never derives damage from the HUD or the weapon image.

## HUD and visuals

`index.html`, `src/style.css`, and `src/ui/heroHud.ts` display an icon and the weapon name to the left of the existing health information, without Babylon GUI. Missing images fall back to an empty slot indicator. Equipment appearance can update through `hud.setEquipment(weapon)`; HP updates remain separate.

The included `blade.webp` is a compact 64px POC icon and can be replaced with a 256px transparent WebP later, keeping the same path.

The 3D dagger has **not** been supplied to the repository. Do not fabricate a GLB. When a final model is available, set the optional `model` path in the weapon definition, inspect the actual hero skeleton for its right-hand bone, attach a visual owner/pivot to that bone and clean it up with the scene. Visual scale and grip rotation must be tuned with the actual GLB; combat hitboxes remain independent.

## Adding another weapon

1. Add a new, uniquely identified entry to `weapons.json` with its attack bonus and icon path.
2. Provide its WebP under `public/assets/weapons/icons/`.
3. Optionally switch it with `heroState.equipment.equipMainHand(id)` and call `hud.setEquipment(heroState.equipment.mainHand)`.
4. For a new starting weapon, change `hero.json`'s `startingEquipment.mainHand`.

No change in `applyDamage`, enemy manager or the floating-text renderer is necessary.

## Verification

From `code/`: `npm test`, `npm run build`, `npm run dev-playground`, and `npm run dev-gameplay`.
Verify 25 attack on an unarmoured target, 17 versus 8 defense, correctly capped damage numbers for immortal targets, disabled/enabled Playground damage override, health/respawn, and HUD sizing on desktop and mobile. The 3D attachment remains deferred until a real GLB is provided.
