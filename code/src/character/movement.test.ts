import assert from "node:assert/strict";
import test from "node:test";
import { aimYaw, calculateMovementStep, consumeImpactWindow, crossesImpactWindow, dodgeDirection, dodgeInvulnerable, dodgeTravelProgress, mouseRelativeDirection } from "./movement.ts";
import { createAnimationSettings, createAttackHits, effectivePlaybackSpeed, HERO_ANIMATIONS } from "./animationSettings.ts";
test("aim keeps its heading near the hero and turns across the shortest arc", () => {
  assert.equal(aimYaw(1, 0.01, 0.01, 1 / 60, 18, 0.12), 1);
  const turn = aimYaw(3.1, -0.04, -1, 1 / 60, 18, 0.12);
  assert.ok(turn > 3.1 && turn < Math.PI);
  const target = aimYaw(0, 0, -1, 1 / 60, 18, 0.12);
  assert.ok(target > 0 && target < Math.PI);
});

test("forward and backward follow the cursor axis while left and right follow its perpendicular", () => {
  assert.equal(mouseRelativeDirection(0, 1, 0).z, 1);
  assert.equal(mouseRelativeDirection(0, -1, 0).z, -1);
  assert.equal(mouseRelativeDirection(-1, 0, 0).x, -1);
  assert.equal(mouseRelativeDirection(1, 0, 0).x, 1);
  const forward = mouseRelativeDirection(0, 1, Math.PI / 2);
  assert.equal(forward.x, 1);
  assert.ok(Math.abs(forward.z) < 1e-12);
  assert.equal(mouseRelativeDirection(1, 0, Math.PI / 2).z, -1);
});

test("diagonal movement keeps the same speed and running increases it", () => {
  const direction = mouseRelativeDirection(1, 1, 1);
  const walk = calculateMovementStep(direction, 0.02, 1.5);
  const run = calculateMovementStep(direction, 0.02, 3.5);
  assert.ok(Math.abs(Math.hypot(walk.x, walk.z) - 0.03) < 1e-12);
  assert.ok(Math.abs(Math.hypot(run.x, run.z) - 0.07) < 1e-12);
});

test("no input gives no movement and slow frames cap the distance", () => {
  assert.deepEqual(calculateMovementStep(mouseRelativeDirection(0, 0, 1), 0.02, 1.5), { x: 0, z: 0 });
  assert.deepEqual(
    calculateMovementStep(mouseRelativeDirection(1, 0, 1), 1, 1.5),
    calculateMovementStep(mouseRelativeDirection(1, 0, 1), 0.05, 1.5),
  );
});

test("dodge travels behind the hero and stops advancing during recovery", () => {
  const facing = Math.PI / 4;
  const direction = dodgeDirection(facing);
  assert.ok(Math.abs(Math.sin(facing) * direction.x + Math.cos(facing) * direction.z + 1) < 1e-12);
  assert.equal(dodgeTravelProgress(0.03), 0);
  assert.ok(dodgeTravelProgress(0.6) > dodgeTravelProgress(0.3));
  assert.ok(dodgeTravelProgress(0.6) < 1);
  assert.equal(dodgeTravelProgress(0.9), 1);
  assert.equal(dodgeTravelProgress(1), 1);
});

test("default dodge invulnerability starts at 15% and ends at 90%", () => {
  for (const progress of [0, 0.1499, 0.9, 1]) assert.equal(dodgeInvulnerable(progress), false);
  for (const progress of [0.15, 0.4, 0.8999]) assert.equal(dodgeInvulnerable(progress), true);
});

test("animation preferences validate stored values and keep per-clip defaults independent", () => {
  const { walk, run, dodge, attack } = HERO_ANIMATIONS;
  const settings = createAnimationSettings({
    [walk.id]: { playbackSpeed: 3, movement: { speed: 0, sync: "true" } },
    [dodge.id]: { dodge: { distance: NaN, window: { from: 0.7, until: 0.3 } } },
    [attack.id]: { playbackSpeed: "2" },
  });
  assert.deepEqual(settings[walk.id], { playbackSpeed: 2.5, movement: { speed: 0.5, sync: false } });
  assert.equal(settings[run.id].movement?.speed, 4.5);
  assert.deepEqual(settings[dodge.id].dodge, { distance: 2, window: { from: 0.7, until: 0.7 } });
  assert.equal(settings[attack.id].playbackSpeed, 2);
});

test("synchronization uses a fixed reference and retains the independent playback setting", () => {
  const walk = HERO_ANIMATIONS.walk;
  const config = createAnimationSettings({ [walk.id]: { playbackSpeed: 1.2, movement: { speed: 6, sync: true } } })[walk.id];
  assert.equal(effectivePlaybackSpeed(walk, config), 2.5);
  config.movement!.speed = 3;
  assert.equal(effectivePlaybackSpeed(walk, config), 1.3);
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

test("the slash defaults to one impact and migrates old timing without losing speed", () => {
  const { id } = HERO_ANIMATIONS.attack;
  assert.deepEqual(createAttackHits(createAnimationSettings()[id].impact!), [
    { triggered: false, window: { from: 0.39, until: 0.46 } },
  ]);
  const migrated = createAnimationSettings({ [id]: { playbackSpeed: 1.5, impact: { doubleHit: true } } }, true);
  assert.equal(migrated[id].playbackSpeed, 1.5);
  assert.equal(migrated[id].impact?.doubleHit, false);
  const settings = createAnimationSettings({ [id]: { impact: { from: 0.2, until: 0.3, doubleHit: false } } });
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


test("missed attack windows are consumed once and not retried", () => {
  const event = { window: { from: 0.2, until: 0.5 }, triggered: false };
  assert.equal(consumeImpactWindow(event, 0, 0.25), true);
  assert.equal(event.triggered, true);
  assert.equal(consumeImpactWindow(event, 0.25, 0.4), false);
});
