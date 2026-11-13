import assert from "node:assert/strict";
import test from "node:test";
import { createTransitionSettings } from "./transitionSettings.ts";

test("animation transition preferences clamp and validate saved values", () => {
  const settings = createTransitionSettings({ move: 0.4, idle: -1, slowDown: Infinity });
  assert.equal(settings.move, 0.4);
  assert.equal(settings.idle, 0.03);
  assert.equal(settings.slowDown, 0.15);
  assert.equal(createTransitionSettings({ move: "invalid" }).move, 0.12);
});
