# Floating Text — JSON tuning

The presentation-only floating-text feature follows the architecture in
[PROJECT.md](PROJECT.md). It never calculates damage or changes animation timing.

## Authoritative source

The committed file **code/FLOATING_TEXT.json** supplies the production defaults
for both Gameplay and Playground. The loader and validator are in
**code/src/ui/floatingTextConfig.ts**. Both modes consume the same JSON; no
second set of hardcoded style defaults is maintained in TypeScript.

The manifest is version 1 and defines:

- `actions.styles.movement`: WALK, SPRINT and DODGE; initially **11 px / 450 ms**
  to keep movement feedback discreet.
- `actions.styles.attack`: ATTACK; initially **14 px / 650 ms**, slightly more visible.
- Each style has its own duration, size, scale, vertical rise and colour.
- `actions.labels` and `actions.anchorHeight` provide the words and hero offset.
- `damage.normal` and `damage.critical` retain their existing independent
  presentation settings. The real sword attack currently has no crit rule;
  the Playground can preview the critical style.
- `limits`, `enabled`, `actions.enabled` and `damage.enabled` retain the
  previous safety caps and display switches.

The strict manifest parser refuses incompatible versions and invalid fields.
Temporary editor values are also bounded to safe ranges.

## Playground workflow

From the code directory, run `npm run dev-playground`, open **Floating Text**
and adjust the movement and attack sections separately. Changing values updates
future messages immediately; existing messages finish with the style captured
when they were created. Movement and attack previews are independent of real
combat, as are the normal/critical damage previews.

- **Exporter FLOATING_TEXT.json** downloads the *complete* version 1 manifest.
- **Copier le JSON complet** copies the same content when browser clipboard
  permission is available.
- **Importer FLOATING_TEXT.json** accepts a compatible full manifest, validates
  it and applies its values only in Playground.
- **Rétablir le JSON versionné** discards the local Playground override and
  restores the values from the committed manifest.

The browser **does not edit Git files**. To make edits permanent, export the
file, replace code/FLOATING_TEXT.json in the working copy, commit the change,
and relaunch Gameplay. As with the animation tuning module, exporting is an
explicit designer action.

Temporary Playground values use localStorage key
`mon-rpg.playground.floating-text.v2`. The previous v1 override is intentionally
not loaded: the new movement/attack profiles cannot be mapped safely from its
single shared action style, and stale large text sizes must not override the
new defaults. Gameplay **never** reads this Playground tuning key.

The personal enable/disable preference remains separate at
`mon-rpg.settings.floating-text-enabled`. It is respected in both modes, even
when the versioned manifest has different default styles. If storage access is
blocked, the Playground still applies changes for the current session.

## Rendering and combat limits

The existing renderer uses a single pointer-transparent HTML overlay above
the Babylon canvas, refreshed by one scene render observer. Texts have
independent lifetimes and caps; all overlay resources are cleaned up on scene
disposal. The lighter movement weight is presentation-only.

The current collision system reports an overlap rather than a precise surface
contact point: damage numbers appear at the centre of the target's hurtbox.
Targets without damage/health state do not display damage. Nothing in this
tuning feature modifies combat rules, the hero equipment system or hitboxes.

## Verification

From code/, run `npm test` and `npm run build`.

In both Playground and Gameplay, verify that WALK/SPRINT/DODGE are subdued,
ATTACK is separately sized, actions overlap safely, enemy damage still appears,
the camera and resize work, and disabling text persists. In Playground, also
export a tuned manifest, import it again, reset to the committed JSON and check
the source indicator. After committing the exported JSON, launch Gameplay to
confirm the defaults changed without relying on browser storage.
