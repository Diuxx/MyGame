import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrthographicBounds, clamp, degreesToRadians, panCameraFocus, wheelZoomHeight } from "./cameraMath.ts";

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

test("editing camera arrows pan relative to the camera, without changing height", () => {
  const focus = { x: 0, z: 0 };
  const up = panCameraFocus(focus, 0, 1, 0, 2);
  const right = panCameraFocus(focus, 1, 0, 0, 2);
  assert.deepEqual(up, { x: -2, z: 0 });
  assert.deepEqual(right, { x: 0, z: 2 });
  const rotated = panCameraFocus(focus, 0, 1, Math.PI / 2, 2);
  assert.ok(Math.abs(rotated.x) < 1e-10);
  assert.ok(Math.abs(rotated.z + 2) < 1e-10);
  assert.deepEqual(focus, { x: 0, z: 0 });
});

test("editing camera diagonal movement is normalized and clamped to map bounds", () => {
  const diagonal = panCameraFocus({ x: 0, z: 0 }, 1, 1, 0.8, 4);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 4) < 1e-10);
  const limits = { minX: -10, maxX: 10, minZ: -5, maxZ: 5 };
  assert.deepEqual(panCameraFocus({ x: 9.5, z: 4.9 }, -1, -1, 1.4, 100, limits),
    { x: 10, z: 5 });
  assert.deepEqual(panCameraFocus({ x: 2, z: 3 }, 0, 0, 0, 100, limits),
    { x: 2, z: 3 });
  assert.deepEqual(panCameraFocus({ x: 2, z: 3 }, 1, 0, 0, 0, limits),
    { x: 2, z: 3 });
});
