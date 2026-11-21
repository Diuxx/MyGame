import assert from "node:assert/strict";
import test from "node:test";
import { canBufferComboInput, canStartBufferedCombo, followUpStartProgress } from "./attackCombo.ts";
import { createAnimationSettings } from "./animationSettings.ts";

const combo = createAnimationSettings().attack.combo!;

test("buffer accepts an early click within the configured 150 ms lead", () => {
  assert.equal(canBufferComboInput(0.5, 1, combo, 1), false);
  assert.equal(canBufferComboInput(0.52, 1, combo, 1), true);
  assert.equal(canStartBufferedCombo(0.6, combo), false);
  assert.equal(canStartBufferedCombo(0.66, combo), true);
});

test("late clicks, full chains and missing combo support do not queue", () => {
  assert.equal(canBufferComboInput(1.01, 1, combo, 1), false);
  assert.equal(canBufferComboInput(0.8, 1, combo, combo.maxChain), false);
  assert.equal(canBufferComboInput(0.8, 1, { ...combo, enabled: false }, 1), false);
  assert.equal(canBufferComboInput(Number.NaN, 1, combo, 1), false);
});

test("the configured chain is limited to punch 1 followed by punch 2", () => {
  assert.equal(combo.maxChain, 2);
  assert.equal(combo.followUp.animation, "attack-2");
  assert.equal(canBufferComboInput(0.8, 1, combo, 2), false);
});

test("follow-up start remains before the first impact", () => {
  assert.equal(followUpStartProgress(combo, 0.39), Math.min(combo.followUp.startProgress, 0.38));
  assert.equal(followUpStartProgress({ ...combo, followUp: { ...combo.followUp, startProgress: 0.5 } }, 0.39), 0.38);
});
