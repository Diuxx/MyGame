import test from "node:test";
import assert from "node:assert/strict";
import { cameraMovementYaw, cycleTarget, movementYaw, selectTarget, targetYaw, type TargetCandidate } from "./targetSelection.ts";
import { createTargetingSettings, parseTargetingManifest, serializeTargetingManifest } from "./targetingSettings.ts";
import { relativeMovementDirection } from "./movement.ts";

const settings = { ...createTargetingSettings(), enabled: true };
const candidate = (id: string, x: number, z: number, alive = true): TargetCandidate =>
  ({ id, x, z, alive, radius: 0.8, groundY: 0 });

test("an enemy entering the radius never acquires itself", () => {
  assert.equal(selectTarget({ x: 0, z: 0 }, [candidate("near", 2, 0)], undefined, settings), undefined);
  assert.equal(cycleTarget({ x: 0, z: 0 }, [
    candidate("dead", 0.5, 0.5, false), candidate("far", 9, 0), candidate("near", 2, 0),
  ], undefined, settings)?.id, "near");
});

test("W cycles among living targets in distance order, wrapping to the nearest", () => {
  const enemies = [candidate("third", settings.acquireRadius - 0.5, 0), candidate("first", 1, 0), candidate("second", 2, 0)];
  const origin = { x: 0, z: 0 };
  assert.equal(cycleTarget(origin, enemies, undefined, settings)?.id, "first");
  assert.equal(cycleTarget(origin, enemies, "first", settings)?.id, "second");
  assert.equal(cycleTarget(origin, enemies, "second", settings)?.id, "third");
  assert.equal(cycleTarget(origin, enemies, "third", settings)?.id, "first");
  assert.equal(cycleTarget(origin, [candidate("only", 1, 1)], "only", settings)?.id, "only");
});

test("the current target is retained until the release radius, without reacquiring another", () => {
  const enemies = [candidate("locked", settings.releaseRadius - 0.5, 0), candidate("closer", 2, 0)];
  assert.equal(selectTarget({ x: 0, z: 0 }, enemies, "locked", settings)?.id, "locked");
  enemies[0].x = settings.releaseRadius + 0.1;
  assert.equal(selectTarget({ x: 0, z: 0 }, enemies, "locked", settings), undefined);
  enemies[0].x = 1;
  assert.equal(selectTarget({ x: 0, z: 0 }, enemies, undefined, settings), undefined);
});

test("dead, removed or disabled targets cannot remain locked", () => {
  assert.equal(selectTarget({ x: 0, z: 0 }, [candidate("locked", 1, 0, false)], "locked", settings), undefined);
  assert.equal(selectTarget({ x: 0, z: 0 }, [], "locked", settings), undefined);
  assert.equal(selectTarget({ x: 0, z: 0 }, [candidate("a", 1, 0)], "a", { ...settings, enabled: false }), undefined);
  assert.equal(cycleTarget({ x: 0, z: 0 }, [candidate("a", 1, 0)], undefined,
    { ...settings, enabled: false }), undefined);
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
  assert.throws(() => parseTargetingManifest({ ...settings, releaseRadius: settings.acquireRadius - 1 }), /releaseRadius/);
  assert.throws(() => parseTargetingManifest({ ...settings, movementReference: "pointer" }), /movementReference/);
  assert.equal(createTargetingSettings({ ...settings, releaseRadius: -1 }).releaseRadius, settings.acquireRadius);
});

test("Q/D strafe tangentially while Z/S move toward and away from the locked enemy", () => {
  const origin = { x: 0, z: 0 };
  const target = { x: 0, z: 5 };
  const yaw = movementYaw({ ...settings, movementReference: "target" }, 1, origin, target);
  assert.deepEqual(relativeMovementDirection(0, 1, yaw), { x: 0, z: 1 });
  assert.deepEqual(relativeMovementDirection(0, -1, yaw), { x: 0, z: -1 });
  assert.deepEqual(relativeMovementDirection(-1, 0, yaw), { x: -1, z: 0 });
  assert.deepEqual(relativeMovementDirection(1, 0, yaw), { x: 1, z: 0 });
});

test("acquisition includes enemies precisely at the radius boundary", () => {
  assert.equal(selectTarget({ x: 0, z: 0 },
    [candidate("boundary", settings.acquireRadius, 0)], undefined, settings), undefined);
  assert.equal(cycleTarget({ x: 0, z: 0 },
    [candidate("boundary", settings.acquireRadius, 0)], undefined, settings)?.id, "boundary");
});
