import assert from "node:assert/strict";
import test from "node:test";
import { canCancelAction } from "./actionCancelling.ts";

test("dodge remains locked until the configured run window", () => {
  const cancel = { runFrom: 0.9, attackFrom: 1 };
  assert.equal(canCancelAction(0.899, cancel, "run"), false);
  assert.equal(canCancelAction(0.9, cancel, "run"), true);
  assert.equal(canCancelAction(1, cancel, "attack"), true);
  assert.equal(canCancelAction(0.999, cancel, "attack"), false);
});
test("missing and malformed cancel windows never authorize an action", () => {
  assert.equal(canCancelAction(0.8, undefined, "run"), false);
  assert.equal(canCancelAction(Number.NaN, { runFrom: 0 }, "run"), false);
  assert.equal(canCancelAction(1.1, { runFrom: 0 }, "run"), false);
});
test("each target uses an independent threshold", () => {
  const cancel = { runFrom: 0.4, dodgeFrom: 0.6, attackFrom: 0.8 };
  assert.equal(canCancelAction(0.5, cancel, "run"), true);
  assert.equal(canCancelAction(0.5, cancel, "dodge"), false);
  assert.equal(canCancelAction(0.7, cancel, "dodge"), true);
  assert.equal(canCancelAction(0.7, cancel, "attack"), false);
});
