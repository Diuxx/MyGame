import assert from "node:assert/strict";
import test from "node:test";
import { intersectsMeleeHitbox } from "./hitDetection.ts";

const attack = { range: 1.8, radius: 0.55, elevation: 1, verticalRadius: 0 };

test("a rotated box uses the target's orientation", () => {
  const hurtbox = { shape: "box", width: 0.5, depth: 2, height: 2, offset: [0, 1, 0] } as const;
  assert.equal(intersectsMeleeHitbox([0, 0, 0], Math.PI / 2, [2, 0, 1.2], hurtbox, attack), true);
  assert.equal(intersectsMeleeHitbox([0, 0, 0], Math.PI / 2, [2, 0, 1.2], hurtbox, attack, Math.PI / 2), false);
});

test("hurtbox offsets rotate with the enemy", () => {
  const hurtbox = { shape: "box", width: 0.4, depth: 0.4, height: 2, offset: [0, 1, 0.6] } as const;
  assert.equal(intersectsMeleeHitbox([0, 0, 0], Math.PI / 2, [2, 0, 0], hurtbox, attack), true);
  assert.equal(intersectsMeleeHitbox([0, 0, 0], Math.PI / 2, [2, 0, 0], hurtbox, attack, Math.PI / 2), false);
});

test("vertical overlap is independent of attack direction", () => {
  const hurtbox = { shape: "cylinder", radius: 0.5, height: 2, offset: [0, 1, 0] } as const;
  assert.equal(intersectsMeleeHitbox([0, 0, 0], 0, [0, 0, 2], hurtbox, attack), true);
  assert.equal(intersectsMeleeHitbox([0, 0, 0], 0, [0, 3, 2], hurtbox, attack), false);
});
