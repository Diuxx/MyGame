# Floating combat text — implementation notes

The floating-text feature follows the existing architecture boundaries described in
PROJECT.md. It never modifies health or recomputes damage. These notes are
editable; the founding project references remain unchanged.

## Behaviour

- Action messages (ATTACK, DODGE, WALK, SPRINT) are emitted by the hero
  controller only when an action starts or the movement state changes. Holding a
  movement key does not generate a new message every frame.
- Damage messages are triggered after applyDamage, based on the target's
  actual health difference. This includes defense, overkill caps and the
  immortality floor. Targets can be hit multiple times independently.
- Critical-hit style is implemented for future combat abilities, but the current
  sword attack has no critical-hit rule. The Playground can preview this style.
- Collision currently returns intersection only, not the precise contact point.
  The centre of the target's hurtbox is used as an **approximate impact anchor**.
  A future contact-point-aware hit detector can replace it without changing the
  renderer. World objects with no damage/health model do not display numbers.

## Presentation and resources

The renderer is code/src/ui/floatingTextSystem.ts. It uses one
pointer-transparent HTML overlay positioned over the Babylon canvas, with
world-to-screen projection each frame. This keeps the feature dependency-free
(no new Babylon GUI package) and keeps visual resources outside combat rules.
Each message owns its life timer and fades/rises/scales independently. The
overlay follows the hero root at a configurable head-height offset.

One before-render observer updates all messages, with a global and per-entity
cap. The observer and overlay are removed on scene disposal. Hidden/off-screen
messages are not drawn, and mouse input passes through the overlay.

## Playground and preferences

Run cd code && npm run dev-playground, then open **Floating Text** in the
Playground module list. The panel offers individual enable switches, size,
duration, rise and scale controls, normal/critical colours and four previews
(including a simulated critical hit). Changes apply immediately.

The full development configuration is saved as
mon-rpg.playground.floating-text.v1 in localStorage. The player's global
display preference is separate:
mon-rpg.settings.floating-text-enabled. This preference is also read in
gameplay mode. If localStorage is unavailable, defaults are used and settings
remain effective for the current session.

Add new action names in floatingTextConfig.ts, rather than coupling the
renderer to animation clips. More specialised settings, anchor tracking and
combat event sources can be added when real gameplay requires them.

## Checks

From code/ run npm test and npm run build, then launch both
npm run dev-playground and npm run dev-gameplay.

Check in-engine action overlap and impact placement, zoom/camera movement,
enemy deaths and respawns, Playground world-editor clicks, browser resizing,
and scene reload. Device performance has not been established by unit tests.
