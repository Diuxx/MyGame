# Combat and enemy tooling — working technical notes

> Editable implementation notes. The authoritative project references in `docs/PROJECT.md` and `docs/PROJETCT.md` remain unchanged.

## Current responsibilities

- `code/src/combat/combat.ts`: damage, health regeneration and compatibility entry point for the sword sweep.
- `code/src/combat/hitDetection.ts`: Babylon-independent ground-plane sweep/hurtbox intersection, including rotated rectangular targets.
- `code/src/enemies/enemyDefinitions.json`: version-controlled enemy archetypes, model URLs, base stats, and hurtboxes.
- `code/src/enemies/enemyState.ts`: independent mutable instance state, with an instance ID separate from the archetype ID.
- `code/src/enemies/enemyManager.ts`: runtime registry, regeneration and damage dispatch without Babylon.js.
- `code/src/enemies/enemyScene.ts`: loading GLBs, visual health bars and debug meshes. Owns the lifecycle of its visual entries and synchronizes them with the manager.
- `code/src/enemies/enemyPersistence.ts`: pure validation and serialization for versioned Playground presets.
- `code/src/playground/enemyTools.ts`: UI and localStorage/file operations. Neither the manager nor combat rules depend on it.

## Important distinctions

- **Hurtbox:** an enemy volume that can receive damage (cylinder or oriented box).
- **Hitbox:** the area swept by an attack (currently a forward capsule approximation).
- **Movement collider:** a separate, not-yet-implemented volume for blocking movement.

The melee sweep is intentionally independent of the sword mesh. Rectangle-vs-capsule intersection uses a conservative expanded rectangle near its corners. This is suitable for initial gameplay testing, not pixel-perfect weapon collision.

## Action and hit semantics

- A one-shot attack window is consumed exactly once, whether or not it connects.
- A successful hit is a separate result, used for feedback and combat stance.
- A future sustained damage zone should track target instance IDs already hit during the window.
- Moving/running may be interrupted by attack/dodge, while an already-running action needs explicit cancellation rules before supporting combos.
- Human and AI controllers should submit intentions into the same action execution path. This shared action interface is a separate follow-up, not implemented here.

## Playground presets

The Playground stores full instance presets (archetype ID, position, stats, immortality and regeneration) in JSON schema version 1. Current health, damage timers and generated IDs are intentionally not persisted. Saved presets are not authoritative enemy definitions and do not change the checked-in archetype JSON.

Import validates type names, dimensions, settings and a 64-instance limit before modifying the scene. Loading new assets is prepared first; existing targets remain if any load fails. Saved presets are loaded only on explicit user action, leaving the three default targets visible on startup.

## Future steps

1. Separate transient attack events, action cooldowns and cancellation policy from rendering and animation playback.
2. Add a movement collider, enemy orientation and telegraphed attacks.
3. Make weapon hitboxes attack-specific and move damage values into ability definitions.
4. Cache/instantiate repeated GLB assets when enemy counts justify the complexity.
5. Replace local presets with a secure authoritative service only if remote administration becomes necessary.

## Verification checklist

From `code/`: run `npm test`, `npm run build`, `npm run dev-playground`, and `npm run dev-gameplay`. In the Playground verify create/edit/remove, a hit while moving, independent instance IDs, loading presets, visually aligned debug hurtboxes, and no regression with missing or malformed GLBs. Performance and in-engine verification are still necessary on representative browsers/devices.
