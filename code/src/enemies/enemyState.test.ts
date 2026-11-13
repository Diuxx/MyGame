import assert from "node:assert/strict";
import test from "node:test";
import { applyDamage, regenerate } from "../combat/combat.ts";
import { configureEnemy, createEnemy, resetEnemy } from "./enemyState.ts";
import { loadEnemyDefinitions, type EnemyDefinition } from "./enemyDefinitions.ts";

const definition: EnemyDefinition = {
  id: "dummy", name: "Dummy", modelPath: "/dummy.glb", category: "static",
  stats: { maxHealth: 100, defense: 8, attackDamage: 0, movementSpeed: 0 },
  hurtbox: { shape: "cylinder", radius: 0.5, height: 2, offset: [0, 1, 0] },
  immortal: true,
  regeneration: { enabled: true, delay: 5, healthPerSecond: 20 },
};
const spawn = () => createEnemy("test", definition, [0, 0, 2], definition);

test("immortal enemies still take damage and remain targetable at 1 HP", () => {
  const enemy = spawn();
  applyDamage(enemy, 1000);
  assert.equal(enemy.health, 1);
  assert.equal(applyDamage(enemy, 25), true);
  assert.equal(enemy.defeated, false);
  configureEnemy(enemy, { ...enemy, immortal: false });
  applyDamage(enemy, 25);
  assert.equal(enemy.health, 0);
  assert.equal(enemy.defeated, true);
  assert.equal(applyDamage(enemy, 25), false);
  regenerate(enemy, 100);
  assert.equal(enemy.health, 0);
  resetEnemy(enemy);
  assert.equal(enemy.health, 100);
  assert.equal(enemy.defeated, false);
  assert.equal(enemy.immortal, false);
  assert.equal(enemy.sinceHit, 0);
});

test("stats, health and regeneration settings are independent per instance", () => {
  const first = spawn();
  const second = spawn();
  configureEnemy(first, { ...first, stats: { ...first.stats, maxHealth: 80 },
    regeneration: { ...first.regeneration, enabled: false } });
  applyDamage(first, 25);
  regenerate(first, 100);
  assert.equal(first.health, 63);
  assert.equal(second.health, 100);
  assert.equal(second.regeneration.enabled, true);
  assert.equal(definition.stats.maxHealth, 100);
  resetEnemy(first);
  assert.equal(first.health, 80);
});

test("JSON validation rejects duplicate IDs and malformed stats, regeneration and hurtboxes", () => {
  assert.equal(loadEnemyDefinitions([definition])[0].id, "dummy");
  assert.throws(() => loadEnemyDefinitions([definition, definition]), /Identifiant/);
  assert.throws(() => loadEnemyDefinitions([{ ...definition, stats: { ...definition.stats, maxHealth: 0 } }]), /maxHealth/);
  assert.throws(() => loadEnemyDefinitions([{ ...definition, regeneration: { enabled: true, delay: -1 } }]), /régénération/);
  assert.throws(() => loadEnemyDefinitions([{ ...definition, hurtbox: { ...definition.hurtbox, radius: 0 } }]), /zone de touche/);
});


test("instance ID is not overwritten when settings are an archetype", () => {
  const enemy = createEnemy("dummy-42", definition, [1, 0, 2], definition);
  assert.equal(enemy.id, "dummy-42");
  assert.equal(enemy.definition.id, "dummy");
  assert.notStrictEqual(enemy.stats, definition.stats);
  assert.notStrictEqual(enemy.regeneration, definition.regeneration);
});
