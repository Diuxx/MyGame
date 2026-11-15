import assert from "node:assert/strict";
import test from "node:test";
import { createTransitionSettings } from "./transitionSettings.ts";
import manifest from "../../ANIMATIONS.json" with { type: "json" };

test("animation transition preferences clamp and validate saved values", () => {
  const settings = createTransitionSettings({ move: 0.4, idle: -1, slowDown: Infinity });
  assert.equal(settings.move, 0.4);
  assert.equal(settings.idle, 0.03);
  assert.equal(settings.slowDown, manifest.transitions.slowDown);
  assert.equal(createTransitionSettings({ move: "invalid" }).move, manifest.transitions.move);
});
