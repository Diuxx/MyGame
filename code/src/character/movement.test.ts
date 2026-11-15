import assert from "node:assert/strict";
import test from "node:test";
import { aimYaw, calculateMovementStep, consumeImpactWindow, crossesImpactWindow, dodgeDirection, dodgeInvulnerable, dodgeTravelProgress, relativeMovementDirection } from "./movement.ts";
import { ANIMATION_RANGES, createAnimationSettings, createAttackHits, effectivePlaybackSpeed, HERO_ANIMATIONS, serializeAnimationManifest } from "./animationSettings.ts";
import { HERO_TUNING } from "./heroTuning.ts";
import { createTransitionSettings } from "./transitionSettings.ts";
import manifest from "../../ANIMATIONS.json" with { type: "json" };
test("aim keeps its heading near the hero and turns across the shortest arc", () => {
  assert.equal(aimYaw(1, 0.01, 0.01, 1 / 60, 18, 0.12), 1);
  const turn = aimYaw(3.1, -0.04, -1, 1 / 60, 18, 0.12);
  assert.ok(turn > 3.1 && turn < Math.PI);
  const target = aimYaw(0, 0, -1, 1 / 60, 18, 0.12);
  assert.ok(target > 0 && target < Math.PI);
});

test("forward and backward follow the cursor axis while left and right follow its perpendicular", () => {
  assert.equal(relativeMovementDirection(0, 1, 0).z, 1);
  assert.equal(relativeMovementDirection(0, -1, 0).z, -1);
  assert.equal(relativeMovementDirection(-1, 0, 0).x, -1);
  assert.equal(relativeMovementDirection(1, 0, 0).x, 1);
  const forward = relativeMovementDirection(0, 1, Math.PI / 2);
  assert.equal(forward.x, 1);
  assert.ok(Math.abs(forward.z) < 1e-12);
  assert.equal(relativeMovementDirection(1, 0, Math.PI / 2).z, -1);
});

test("diagonal movement keeps the same speed and running increases it", () => {
  const direction = relativeMovementDirection(1, 1, 1);
  const walk = calculateMovementStep(direction, 0.02, 1.5);
  const run = calculateMovementStep(direction, 0.02, 3.5);
  const delta = Math.min(0.02, HERO_TUNING.maxMovementDelta);
  assert.ok(Math.abs(Math.hypot(walk.x, walk.z) - 1.5 * delta) < 1e-12);
  assert.ok(Math.abs(Math.hypot(run.x, run.z) - 3.5 * delta) < 1e-12);
});

test("no input gives no movement and slow frames cap the distance", () => {
  assert.deepEqual(calculateMovementStep(relativeMovementDirection(0, 0, 1), 0.02, 1.5), { x: 0, z: 0 });
  assert.deepEqual(
    calculateMovementStep(relativeMovementDirection(1, 0, 1), 1, 1.5),
    calculateMovementStep(relativeMovementDirection(1, 0, 1), HERO_TUNING.maxMovementDelta, 1.5),
  );
});

test("dodge travels behind the hero and stops advancing during recovery", () => {
  const facing = Math.PI / 4;
  const direction = dodgeDirection(facing);
  assert.ok(Math.abs(Math.sin(facing) * direction.x + Math.cos(facing) * direction.z + 1) < 1e-12);
  const { from, until } = HERO_TUNING.dodge.travel;
  assert.equal(dodgeTravelProgress(from), 0);
  assert.ok(Math.abs(dodgeTravelProgress((from + until) / 2) - 0.5) < 1e-12);
  assert.equal(dodgeTravelProgress(until), 1);
  assert.equal(dodgeTravelProgress(1), 1);
});

test("default dodge invulnerability uses the configured half-open window", () => {
  const { from, until } = manifest.settings.dodge.dodge.window;
  assert.equal(dodgeInvulnerable(until), false);
  assert.equal(dodgeInvulnerable(from), from < until);
  assert.equal(dodgeInvulnerable(from - 0.0001), false);
});

test("animation preferences validate stored values and keep per-clip defaults independent", () => {
  const { walk, run, dodge, attack } = HERO_ANIMATIONS;
  const settings = createAnimationSettings({
    [walk.id]: { playbackSpeed: 3, movement: { speed: 0, sync: "true" } },
    [dodge.id]: { dodge: { distance: NaN, window: { from: 0.7, until: 0.3 } } },
    [attack.id]: { playbackSpeed: "2" },
  });
  assert.deepEqual(settings[walk.id], { playbackSpeed: 2.5, movement: { speed: 0.5, sync: manifest.settings.walk.movement.sync } });
  assert.equal(settings[run.id].movement?.speed, manifest.settings.run.movement.speed);
  assert.deepEqual(settings[dodge.id].dodge, { distance: manifest.settings.dodge.dodge.distance, window: { from: 0.7, until: 0.7 } });
  assert.equal(settings[attack.id].playbackSpeed, manifest.settings.attack.playbackSpeed);
});

test("synchronization uses a fixed reference and retains the independent playback setting", () => {
  const walk = HERO_ANIMATIONS.walk;
  const config = createAnimationSettings({ [walk.id]: { playbackSpeed: 1.2, movement: { speed: 6, sync: true } } })[walk.id];
  const reference = manifest.animations.find(({ name }) => name === "walk")!.syncReference!;
  const { min, max } = ANIMATION_RANGES.playback;
  assert.equal(effectivePlaybackSpeed(walk, config), Math.max(min, Math.min(max, reference.playbackSpeed * 6 / reference.speed)));
  config.movement!.sync = false;
  assert.equal(effectivePlaybackSpeed(walk, config), 1.2);
});

test("saved hero animation settings migrate to lowercase clip names", () => {
  const settings = createAnimationSettings({
    Idle_9: { playbackSpeed: 0.75 },
    Running: { playbackSpeed: 1.5, movement: { speed: 5, sync: true } },
    "crouch-walk": { playbackSpeed: 1.1, movement: { speed: 1.8, sync: true } },
    Thrust_Slash: { playbackSpeed: 1.25 },
    attack: { playbackSpeed: 2.25 },
  });
  assert.equal(settings.idle.playbackSpeed, 0.75);
  assert.deepEqual(settings.run.movement, { speed: 5, sync: true });
  assert.equal(settings.attack.playbackSpeed, 2.25);
  assert.equal(settings["combat-stance"].playbackSpeed, 1.1);
  assert.deepEqual(settings["combat-stance"].movement, { speed: 1.8, sync: true });
});

test("action timing uses progress and catches an impact window crossed in a single step", () => {
  const window = { from: 0.4, until: 0.6 };
  assert.equal(crossesImpactWindow(0.1, 0.3, window), false);
  assert.equal(crossesImpactWindow(0.2, 1, window), true);
  assert.equal(crossesImpactWindow(0.5, 0.5, window), false);
  assert.equal(crossesImpactWindow(0.6, 0.7, window), false);
  assert.equal(dodgeInvulnerable(0.4, window), true);
  assert.equal(dodgeInvulnerable(1, { from: 0.4, until: 1 }), false);
});

test("the slash uses configured impact timing and migrates old timing without losing speed", () => {
  const { id } = HERO_ANIMATIONS.attack;
  assert.deepEqual(createAnimationSettings()[id].impact, manifest.settings.attack.impact);
  const migrated = createAnimationSettings({ [id]: { playbackSpeed: 1.5, impact: { doubleHit: true } } }, true);
  assert.equal(migrated[id].playbackSpeed, 1.5);
  assert.deepEqual(migrated[id].impact, manifest.settings.attack.impact);
  const settings = createAnimationSettings({
    [id]: { impact: { from: 0.2, until: 0.3, doubleHit: false, second: { from: 0.63, until: 0.7 } } },
  });
  const impact = settings[id].impact!;
  assert.equal(impact.doubleHit, false);
  assert.deepEqual(createAttackHits(impact), [{ triggered: false, window: { from: 0.2, until: 0.3 } }]);
  impact.doubleHit = true;
  const hits = createAttackHits(impact);
  assert.equal(consumeImpactWindow(hits[0], 0.1, 0.25), true);
  assert.equal(hits[1].triggered, false);
  assert.equal(crossesImpactWindow(0.4, 0.9, hits[0].window), false);
  assert.equal(crossesImpactWindow(0.4, 0.9, hits[1].window), true);
  assert.equal(createAttackHits(impact)[0].triggered, false);
});

test("the Playground export keeps animation rules and writes the adjusted settings", () => {
  const settings = createAnimationSettings({ walk: { playbackSpeed: 1.2, movement: { speed: 5.6, sync: true } } });
  const transitions = createTransitionSettings({ move: 0.33, idle: 0.25, slowDown: 0.42 });
  const output = JSON.parse(serializeAnimationManifest(settings, transitions));
  assert.deepEqual(output.animations, manifest.animations);
  assert.deepEqual(output.controller, manifest.controller);
  assert.deepEqual(output.blending, manifest.blending);
  assert.deepEqual(output.settings, settings);
  assert.deepEqual(output.transitions, transitions);
});

test("missed attack windows are consumed once and not retried", () => {
  const event = { window: { from: 0.2, until: 0.5 }, triggered: false };
  assert.equal(consumeImpactWindow(event, 0, 0.25), true);
  assert.equal(event.triggered, true);
  assert.equal(consumeImpactWindow(event, 0.25, 0.4), false);
});
