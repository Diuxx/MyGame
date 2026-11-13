import assert from "node:assert/strict";
import test from "node:test";
import { applyDamage, intersectsSwing, regenerate, type CombatState } from "./combat.ts";

const spawn = (): CombatState => ({
  stats: { maxHealth: 100, defense: 8 },
  immortal: true,
  regeneration: { enabled: true, delay: 5, healthPerSecond: 20 },
  health: 100,
  defeated: false,
  sinceHit: 0,
});

test("damage floors the attack, applies defense and rejects nonpositive or nonfinite values", () => {
  const enemy = spawn();
  assert.equal(applyDamage(enemy, 25.9), true);
  assert.equal(enemy.health, 83);
  applyDamage(enemy, 2);
  assert.equal(enemy.health, 82);
  for (const invalid of [0, -1, NaN, Infinity]) assert.equal(applyDamage(enemy, invalid), false);
  assert.equal(enemy.health, 82);
});

test("regeneration integrates time beyond the delay and each hit restarts it", () => {
  const enemy = spawn();
  applyDamage(enemy, 70);
  regenerate(enemy, 4);
  assert.equal(enemy.health, 38);
  regenerate(enemy, 1.5);
  assert.equal(enemy.health, 48);
  applyDamage(enemy, 25);
  regenerate(enemy, 5);
  assert.equal(enemy.health, 31);
  regenerate(enemy, 1);
  assert.equal(enemy.health, 51);
  regenerate(enemy, 100);
  assert.equal(enemy.health, 100);
});

test("sword impact respects range, facing and hurtbox height", () => {
  const box = { shape: "cylinder", radius: 0.5, height: 2, offset: [0, 1, 0] } as const;
  assert.equal(intersectsSwing([0, 0, 0], 0, [0, 0, 2], box), true);
  assert.equal(intersectsSwing([0, 0, 0], Math.PI, [0, 0, 2], box), false);
  assert.equal(intersectsSwing([0, 0, 0], 0, [0, 0, 4], box), false);
  assert.equal(intersectsSwing([0, 0, 0], 0, [0, 2, 2], box), false);
  const wooden = { shape: "box", width: 1, depth: 0.8, height: 2, offset: [0, 1, 0] } as const;
  assert.equal(intersectsSwing([0, 0, 0], Math.PI / 2, [2, 0, 0], wooden), true);
  assert.equal(intersectsSwing([0, 0, 0], Math.PI / 2, [2, 0, 2], wooden), false);
});
