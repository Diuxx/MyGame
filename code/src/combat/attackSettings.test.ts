import assert from "node:assert/strict";
import test from "node:test";
import { defaultSwordSwing, parseSwordSwing, swordHitboxOutline } from "./attackSettings.ts";

test("attack controls validate the same numbers used by the damage solver", () => {
  const defaults = defaultSwordSwing();
  assert.deepEqual(parseSwordSwing(defaults), defaults);
  assert.throws(() => parseSwordSwing({ ...defaults, range: NaN }), /range/);
  assert.throws(() => parseSwordSwing({ ...defaults, radius: -0.2 }), /radius/);
  assert.throws(() => parseSwordSwing({ ...defaults, damage: Infinity }), /damage/);
});

test("attack outline represents forward capsule range including the rounded tip", () => {
  const swing = { ...defaultSwordSwing(), range: 2, radius: 0.5 };
  const points = swordHitboxOutline(swing);
  assert.equal(points[0].z, 0);
  assert.equal(points.at(-1)?.z, 0);
  assert.ok(points.some(({ z }) => Math.abs(z - 2.5) < 0.001));
  assert.ok(points.every(({ z }) => z >= 0));
});
