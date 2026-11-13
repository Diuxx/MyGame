import assert from "node:assert/strict";
import test from "node:test";
import { aimYaw, calculateMovementStep, dodgeDirection, dodgeInvulnerable, mouseRelativeDirection } from "./movement.ts";
import { LOCOMOTION_CLIPS as clips, locomotionWeights } from "./locomotion.ts";

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

test("directional weights follow movement and switch between idle, exploration and combat", () => {
  const available = new Set(Object.values(clips));
  assert.deepEqual(locomotionWeights({ x: -1, z: 1 }, 0, false, "combat", clips.idle, available),
    new Map([[clips.walk, 0.5], [clips.left, 0.5]]));
  assert.deepEqual(locomotionWeights({ x: 1, z: -1 }, 0, true, "combat", clips.idle, available),
    new Map([[clips.backward, 0.5], [clips.right, 0.5]]));
  assert.deepEqual(locomotionWeights({ x: 0, z: -1 }, 0, true, "combat", clips.idle, available),
    new Map([[clips.backward, 1]]));
  assert.deepEqual(locomotionWeights({ x: 0, z: -1 }, 0, true, "exploration", clips.idle, available),
    new Map([[clips.run, 1]]));
  assert.deepEqual(locomotionWeights({ x: 0, z: 0 }, 0, false, "combat", clips.idle, available),
    new Map([[clips.idle, 1]]));
  assert.deepEqual(locomotionWeights({ x: -1, z: 1 }, 0, false, "combat", clips.idle, new Set()),
    new Map([[clips.walk, 1]]));
});

test("dodge uses the normalized input direction or falls back to facing", () => {
  const diagonal = mouseRelativeDirection(1, 1, 0);
  assert.deepEqual(dodgeDirection(diagonal, 0), diagonal);
  assert.deepEqual(dodgeDirection({ x: 0, z: 0 }, 0), { x: 0, z: 1 });
});

test("dodge invulnerability starts at 15% and ends at 65%", () => {
  for (const progress of [0, 0.1499, 0.65, 0.9, 1]) assert.equal(dodgeInvulnerable(progress), false);
  for (const progress of [0.15, 0.4, 0.6499]) assert.equal(dodgeInvulnerable(progress), true);
});
