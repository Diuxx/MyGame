import assert from "node:assert/strict";
import test from "node:test";
import { resolveHeroSwing } from "./heroAttack.ts";
import { SWORD_SWING } from "./combat.ts";

test("resolved attack uses stats by default and an explicit optional override", () => {
  const swing = resolveHeroSwing(SWORD_SWING, 25);
  assert.deepEqual(swing, SWORD_SWING);
  assert.deepEqual(resolveHeroSwing(SWORD_SWING, 30), { ...SWORD_SWING, damage: 30 });
  assert.deepEqual(resolveHeroSwing(SWORD_SWING, 30, 42), { ...SWORD_SWING, damage: 42 });
  assert.equal(SWORD_SWING.damage, 25);
  assert.throws(() => resolveHeroSwing(SWORD_SWING, 25, -1), /invalides/);
});
