import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_DRAWN_KATANA_ROTATION, parseDrawnKatanaRotation } from "./equipmentTuning.ts";

test("drawn blade rotation accepts three degree axes and validates stored preferences", () => {
  assert.deepEqual(parseDrawnKatanaRotation([30, -90, 180]), [30, -90, 180]);
  assert.deepEqual(parseDrawnKatanaRotation([Infinity, 0, 0]), DEFAULT_DRAWN_KATANA_ROTATION);
  assert.deepEqual(parseDrawnKatanaRotation([0, 0, 361]), DEFAULT_DRAWN_KATANA_ROTATION);
  assert.deepEqual(parseDrawnKatanaRotation([0, 0]), DEFAULT_DRAWN_KATANA_ROTATION);
});
