import assert from "node:assert/strict";
import test from "node:test";
import { calculateMovementStep } from "./movement.ts";

test("movement follows the camera's screen axes", () => {
  assert.deepEqual(calculateMovementStep(1, 0, 0, 0.02, false), { x: -0, z: 0.03 });
  assert.deepEqual(calculateMovementStep(0, 1, 0, 0.02, false), { x: -0.03, z: 0 });
  const forward = calculateMovementStep(0, 1, Math.PI / 2, 0.02, false);
  assert.ok(Math.abs(forward.x) < 1e-12);
  assert.equal(forward.z, -0.03);
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
