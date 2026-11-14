import assert from "node:assert/strict";
import test from "node:test";
import { createHeroVitals } from "./heroVitals.ts";

test("hero ignores hits while dodging and respawns after a delay", () => {
  const hero = createHeroVitals(100, 2);
  assert.equal(hero.hit(30, true), false);
  assert.equal(hero.health, 100);
  assert.equal(hero.hit(120), true);
  assert.equal(hero.isAlive, false);
  assert.equal(hero.update(1), false);
  assert.equal(hero.hit(1), false);
  assert.equal(hero.update(1.1), true);
  assert.equal(hero.health, 100);
  assert.equal(hero.hit(10), false);
  hero.update(2);
  assert.equal(hero.hit(10), true);
  assert.equal(hero.health, 90);
});
