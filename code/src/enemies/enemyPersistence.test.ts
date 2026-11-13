import assert from "node:assert/strict";
import test from "node:test";
import { createEnemy } from "./enemyState.ts";
import { parseEnemyInstances, serializeEnemyInstances } from "./enemyPersistence.ts";
import type { EnemyDefinition } from "./enemyDefinitions.ts";

const definition: EnemyDefinition = {
  id: "dummy", name: "Dummy", modelPath: "/dummy.glb", category: "static",
  stats: { maxHealth: 100, defense: 0, attackDamage: 0, movementSpeed: 0 },
  hurtbox: { shape: "cylinder", radius: 0.5, height: 2, offset: [0, 1, 0] },
  immortal: true,
  regeneration: { enabled: true, delay: 5, healthPerSecond: 20 },
};

test("enemy presets round-trip without persisting mutable health", () => {
  const enemy = createEnemy("dummy-7", definition, [2, 0, 1], definition);
  enemy.health = 17;
  const result = parseEnemyInstances(serializeEnemyInstances([enemy]), [definition]);
  assert.equal(result[0].definitionId, "dummy");
  assert.deepEqual(result[0].position, [2, 0, 1]);
  assert.equal(result[0].settings.stats.maxHealth, 100);
  assert.equal("health" in result[0], false);
  assert.equal(enemy.id, "dummy-7");
});

test("rejects invalid version, unknown type, coordinates and settings", () => {
  const base = JSON.parse(serializeEnemyInstances([createEnemy("dummy-9", definition, [0, 0, 0], definition)]));
  assert.throws(() => parseEnemyInstances("{invalid", [definition]), /illisible/);
  assert.throws(() => parseEnemyInstances(JSON.stringify({ ...base, version: 2 }), [definition]), /version/);
  assert.throws(() => parseEnemyInstances(JSON.stringify({ ...base, instances: [{ ...base.instances[0], definitionId: "other" }] }), [definition]), /inconnu/);
  assert.throws(() => parseEnemyInstances(JSON.stringify({ ...base, instances: [{ ...base.instances[0], position: [0, null, 0] }] }), [definition]), /Position/);
  assert.throws(() => parseEnemyInstances(JSON.stringify({ ...base, instances: [{ ...base.instances[0], settings: { ...base.instances[0].settings, stats: { ...base.instances[0].settings.stats, maxHealth: -2 } } }] }), [definition]), /maxHealth/);
});

test("custom collision settings persist and legacy snapshots still load", () => {
  const enemy = createEnemy("dummy-10", definition, [0, 0, 0], definition);
  enemy.collision = { solid: false, radius: 1.25 };
  const saved = serializeEnemyInstances([enemy]);
  assert.deepEqual(parseEnemyInstances(saved, [definition])[0].settings.collision, enemy.collision);
  const old = JSON.parse(saved);
  delete old.instances[0].settings.collision;
  assert.equal(parseEnemyInstances(JSON.stringify(old), [definition])[0].settings.collision, undefined);
  old.instances[0].settings.collision = { solid: true, radius: -1 };
  assert.throws(() => parseEnemyInstances(JSON.stringify(old), [definition]), /Collision/);
});
