import assert from "node:assert/strict";
import test from "node:test";
import { pickTargetByRay, type TargetRay } from "./targetPicking.ts";
import type { TargetCandidate } from "./targetSelection.ts";

function enemy(id: string, x: number, z: number, alive = true): TargetCandidate {
  return { id, x, z, alive, groundY: 0, radius: 0.6, clickHeight: 2, clickOffsetY: 1 };
}

test("a click on a visible enemy selects the nearest intersected hurtbox", () => {
  const ray: TargetRay = {
    origin: { x: 0, y: 1, z: 10 },
    direction: { x: 0, y: 0, z: -1 },
  };
  const candidates = [enemy("back", 0, 0), enemy("front", 0, 4)];
  assert.equal(pickTargetByRay(ray, { x: 0, z: 0 }, candidates, 8)?.id, "front");
  assert.equal(pickTargetByRay(ray, { x: 0, z: 0 }, candidates, 3)?.id, "back",
    "an out-of-range foreground enemy must not block a target inside the selection radius");
});

test("empty space, a dead enemy and an out-of-range enemy do not target", () => {
  const straight: TargetRay = {
    origin: { x: 0, y: 1, z: 10 },
    direction: { x: 0, y: 0, z: -1 },
  };
  assert.equal(pickTargetByRay(straight, { x: 0, z: 0 }, [enemy("dead", 0, 0, false)], 8), undefined);
  assert.equal(pickTargetByRay(straight, { x: 0, z: 0 }, [enemy("far", 0, 5)], 4), undefined);
  assert.equal(pickTargetByRay(straight, { x: 0, z: 0 }, [enemy("in", 0, 0)], 0), undefined);
  const miss = {
    origin: { x: 4, y: 1, z: 10 }, direction: { x: 0, y: 0, z: -1 },
  };
  assert.equal(pickTargetByRay(miss, { x: 0, z: 0 }, [enemy("off-screen", 0, 0)], 8), undefined);
});

test("vertical clicks through the top cap select tall targets but not the ground outside them", () => {
  const topDown: TargetRay = {
    origin: { x: 0.5, y: 10, z: 0 }, direction: { x: 0, y: -1, z: 0 },
  };
  assert.equal(pickTargetByRay(topDown, { x: 0, z: 0 }, [enemy("target", 0, 0)], 4)?.id, "target");
  topDown.origin.x = 2;
  assert.equal(pickTargetByRay(topDown, { x: 0, z: 0 }, [enemy("target", 0, 0)], 4), undefined);
});

test("rays that miss the enemy's vertical extent never select it", () => {
  const ray: TargetRay = {
    origin: { x: 0, y: 3, z: 10 }, direction: { x: 0, y: 0, z: -1 },
  };
  assert.equal(pickTargetByRay(ray, { x: 0, z: 0 }, [enemy("short", 0, 0)], 8), undefined);
});
