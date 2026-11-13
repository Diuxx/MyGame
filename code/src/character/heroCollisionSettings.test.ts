import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_HERO_COLLISION, parseHeroCollisionSettings } from "./heroCollisionSettings.ts";

test("hero collision preferences validate and retain defaults", () => {
  assert.deepEqual(parseHeroCollisionSettings(DEFAULT_HERO_COLLISION), DEFAULT_HERO_COLLISION);
  assert.throws(() => parseHeroCollisionSettings({ ...DEFAULT_HERO_COLLISION, radius: -1 }), /radius/);
  assert.throws(() => parseHeroCollisionSettings({ ...DEFAULT_HERO_COLLISION, height: Infinity }), /height/);
  assert.throws(() => parseHeroCollisionSettings({ ...DEFAULT_HERO_COLLISION, enabled: "true" }), /enabled/);
});
