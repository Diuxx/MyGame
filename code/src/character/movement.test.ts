import assert from "node:assert/strict";
import test from "node:test";
import { aimYaw, calculateMovementStep } from "./movement.ts";

test("aim keeps its heading near the hero and turns across the shortest arc", () => {
  assert.equal(aimYaw(1, 0.01, 0.01, 1 / 60, 18, 0.12), 1);
  const turn = aimYaw(3.1, -0.04, -1, 1 / 60, 18, 0.12);
  assert.ok(turn > 3.1 && turn < Math.PI);
  const target = aimYaw(0, 0, -1, 1 / 60, 18, 0.12);
  assert.ok(target > 0 && target < Math.PI);
});

test("forward, backward and strafing are relative to the hero's facing", () => {
  assert.deepEqual(calculateMovementStep(1, 0, 0, 0.02, false), { x: 0.03, z: 0 });
  assert.deepEqual(calculateMovementStep(-1, 0, 0, 0.02, false), { x: -0.03, z: 0 });
  assert.deepEqual(calculateMovementStep(0, 1, 0, 0.02, false), { x: 0, z: 0.03 });
  assert.deepEqual(calculateMovementStep(0, -1, 0, 0.02, false), { x: 0, z: -0.03 });
  const forward = calculateMovementStep(0, 1, Math.PI / 2, 0.02, false);
  assert.equal(forward.x, 0.03);
  assert.ok(Math.abs(forward.z) < 1e-12);
});

test("diagonal movement keeps the same speed and running increases it", () => {
  const walk = calculateMovementStep(1, 1, 1, 0.02, false);
  const run = calculateMovementStep(1, 1, 1, 0.02, true);
  assert.ok(Math.abs(Math.hypot(walk.x, walk.z) - 0.03) < 1e-12);
  assert.ok(Math.abs(Math.hypot(run.x, run.z) - 0.07) < 1e-12);
});

test("no input gives no movement and slow frames cap the distance", () => {
  assert.deepEqual(calculateMovementStep(0, 0, 1, 0.02, false), { x: 0, z: 0 });
  assert.deepEqual(
    calculateMovementStep(1, 0, 1, 1, false),
    calculateMovementStep(1, 0, 1, 0.05, false),
  );
});
