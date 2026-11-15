import test from "node:test";
import assert from "node:assert/strict";
import { cameraMovementYaw, movementYaw, selectTarget, targetYaw, type TargetCandidate } from "./targetSelection.ts";
import { createTargetingSettings, parseTargetingManifest, serializeTargetingManifest } from "./targetingSettings.ts";
import { mouseRelativeDirection } from "./movement.ts";

const settings = { ...createTargetingSettings(), enabled: true };
const candidate = (id: string, x: number, z: number, alive = true): TargetCandidate =>
  ({ id, x, z, alive, radius: 0.8, groundY: 0 });

test("acquires the nearest living enemy inside the configured combat radius", () => {
  assert.equal(selectTarget({ x: 0, z: 0 }, [
    candidate("dead", 0.5, 0.5, false), candidate("far", 9, 0), candidate("near", 2, 0),
  ], undefined, settings)?.id, "near");
  assert.equal(selectTarget({ x: 0, z: 0 }, [candidate("far", 9, 0)], undefined, settings), undefined);
});

test("retains a current target until the larger release distance is crossed", () => {
  const enemies = [candidate("locked", 9, 0), candidate("closer", 2, 0)];
  assert.equal(selectTarget({ x: 0, z: 0 }, enemies, "locked", settings)?.id, "locked");
  enemies[0].x = 10.1;
  assert.equal(selectTarget({ x: 0, z: 0 }, enemies, "locked", settings)?.id, "closer");
  assert.equal(selectTarget({ x: 0, z: 0 }, enemies, "missing", settings)?.id, "closer");
});

test("dead, removed and inactive candidates are never retained", () => {
  assert.equal(selectTarget({ x: 0, z: 0 }, [candidate("locked", 1, 0, false)], "locked", settings), undefined);
  assert.equal(selectTarget({ x: 0, z: 0 }, [], "locked", settings), undefined);
  assert.equal(selectTarget({ x: 0, z: 0 }, [candidate("a", 1, 0)], "a", { ...settings, enabled: false }), undefined);
});

test("camera-relative movement and target-relative strafing use independent headings", () => {
  const origin = { x: 0, z: 0 };
  const target = { x: 3, z: 0 };
  assert.equal(targetYaw(origin, target), Math.PI / 2);
  assert.equal(movementYaw({ ...settings, movementReference: "target" }, 0, origin, target), Math.PI / 2);
  assert.equal(movementYaw(settings, 0, origin, target), cameraMovementYaw(0));
  assert.ok(Math.abs(cameraMovementYaw(0) + Math.PI / 2) < 1e-6);
});

test("settings import/export preserve all fields and reject invalid radius pairs", () => {
  const restored = parseTargetingManifest(JSON.parse(serializeTargetingManifest(settings)));
  assert.deepEqual(restored, settings);
  assert.throws(() => parseTargetingManifest({ ...settings, releaseRadius: 4 }), /releaseRadius/);
  assert.throws(() => parseTargetingManifest({ ...settings, movementReference: "pointer" }), /movementReference/);
  assert.equal(createTargetingSettings({ ...settings, releaseRadius: -1 }).releaseRadius, settings.acquireRadius);
});

test("Q/D strafe tangentially while Z/S move toward and away from the locked enemy", () => {
  const origin = { x: 0, z: 0 };
  const target = { x: 0, z: 5 };
  const yaw = movementYaw({ ...settings, movementReference: "target" }, 1, origin, target);
  assert.deepEqual(mouseRelativeDirection(0, 1, yaw), { x: 0, z: 1 });
  assert.deepEqual(mouseRelativeDirection(0, -1, yaw), { x: 0, z: -1 });
  assert.deepEqual(mouseRelativeDirection(-1, 0, yaw), { x: -1, z: 0 });
  assert.deepEqual(mouseRelativeDirection(1, 0, yaw), { x: 1, z: 0 });
});

test("acquisition includes enemies precisely at the radius boundary", () => {
  assert.equal(selectTarget({ x: 0, z: 0 },
    [candidate("boundary", settings.acquireRadius, 0)], undefined, settings)?.id, "boundary");
});
