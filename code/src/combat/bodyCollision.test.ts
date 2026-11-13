import assert from "node:assert/strict";
import test from "node:test";
import { resolveCircleMovement } from "./bodyCollision.ts";

test("swept collision stops the hero before an enemy, even at high speed", () => {
  const [obstacle] = [{ x: 0, z: 3, radius: 0.6 }];
  const step = resolveCircleMovement([0, 0, 0], { x: 0, z: 10 }, 0.4, [obstacle]);
  assert.ok(step.z >= 1.99 && step.z < 2.001);
  assert.ok(Math.abs(step.x) < 1e-8);
});

test("tangent movement slides around enemies instead of freezing", () => {
  const moved = resolveCircleMovement([0, 0, 0], { x: 1, z: 3 }, 0.4, [{ x: 0, z: 2, radius: 0.5 }]);
  assert.ok(moved.x > 0.5);
  assert.ok(moved.z > 0.1);
  assert.ok(Math.hypot(moved.x, moved.z - 2) >= 0.899);
});

test("an overlapping hero can walk outward after the collider is enlarged", () => {
  const obstacles = [{ x: 0, z: 0, radius: 1 }];
  const outward = resolveCircleMovement([0.5, 0, 0], { x: 1, z: 0 }, 0.5, obstacles);
  const inward = resolveCircleMovement([0.5, 0, 0], { x: -1, z: 0 }, 0.5, obstacles);
  assert.ok(outward.x > 0.9);
  assert.ok(inward.x > -0.001);
});

test("no obstacles preserves the requested displacement", () => {
  assert.deepEqual(resolveCircleMovement([2, 0, 5], { x: -0.5, z: 2 }, 0.4, []), { x: -0.5, z: 2 });
});
