import assert from "node:assert/strict";
import test from "node:test";
import { canStartZoneTransition } from "./zoneTransitions.ts";

test("manual map load remains available while the Playground editor is active", () => {
  assert.equal(canStartZoneTransition({
    busy: false, disposed: false, editing: true, manual: true,
  }), true);
  assert.equal(canStartZoneTransition({
    busy: false, disposed: false, editing: false, manual: true,
  }), true);
});

test("gameplay exits are disabled in edition and active in test mode", () => {
  assert.equal(canStartZoneTransition({
    busy: false, disposed: false, editing: true, manual: false,
  }), false);
  assert.equal(canStartZoneTransition({
    busy: false, disposed: false, editing: false, manual: false,
  }), true);
});

test("concurrent or disposed transitions remain blocked for every mode", () => {
  for (const manual of [true, false]) {
    for (const editing of [true, false]) {
      assert.equal(canStartZoneTransition({ busy: true, disposed: false, editing, manual }), false);
      assert.equal(canStartZoneTransition({ busy: false, disposed: true, editing, manual }), false);
    }
  }
});
