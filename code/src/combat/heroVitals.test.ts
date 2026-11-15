import assert from "node:assert/strict";
import test from "node:test";
import { createHeroVitals } from "./heroVitals.ts";
import { dodgeInvulnerable } from "../character/movement.ts";

test("hero ignores hits while dodging and respawns after a delay", () => {
  const hero = createHeroVitals(100, 2);
  assert.equal(hero.hit(30, dodgeInvulnerable(0.5)), false);
  assert.equal(hero.health, 100);
  assert.equal(hero.hit(120, dodgeInvulnerable(0.9)), true);
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

test("simulated death uses the respawn delay and cannot restart an active countdown", () => {
  const hero = createHeroVitals(100, 5.1);
  assert.equal(hero.defeat(), true);
  assert.equal(hero.update(4.6), false);
  assert.equal(hero.defeat(), false);
  assert.equal(hero.update(0.51), true);
  assert.equal(hero.health, 100);
  assert.equal(hero.hit(10), false);
});
