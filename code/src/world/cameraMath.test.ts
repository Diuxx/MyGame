import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrthographicBounds, clamp, degreesToRadians, wheelZoomHeight } from "./cameraMath.ts";

test("orthographic bounds remain centered on square viewports", () => {
  assert.deepEqual(calculateOrthographicBounds(1000, 1000, 12), {
    left: -6, right: 6, top: 6, bottom: -6,
  });
});

test("portrait viewports keep vertical field of view", () => {
  assert.deepEqual(calculateOrthographicBounds(900, 1600, 12), {
    left: -3.375, right: 3.375, top: 6, bottom: -6,
  });
});

test("zero-height viewport is guarded against division by zero", () => {
  const bounds = calculateOrthographicBounds(600, 0, 8);
  assert.ok(Number.isFinite(bounds.left));
});

test("clamp and angle conversion are predictable", () => {
  assert.equal(clamp(90, 10, 65), 65);
  assert.equal(clamp(-5, 10, 65), 10);
  assert.ok(Math.abs(degreesToRadians(180) - Math.PI) < 1e-12);
});

test("wheel zoom changes the visible height in both directions and respects camera limits", () => {
  const closer = wheelZoomHeight(25, -100, 5, 40);
  assert.ok(closer < 25);
  assert.ok(Math.abs(wheelZoomHeight(closer, 100, 5, 40) - 25) < 1e-12);
  assert.equal(wheelZoomHeight(25, -5000, 5, 40), 5);
  assert.equal(wheelZoomHeight(25, 5000, 5, 40), 40);
});
