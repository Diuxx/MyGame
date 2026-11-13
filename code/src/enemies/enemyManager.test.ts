import assert from "node:assert/strict";
import test from "node:test";
import { createEnemy } from "./enemyState.ts";
import { createEnemyManager } from "./enemyManager.ts";
import type { EnemyDefinition } from "./enemyDefinitions.ts";

const definition: EnemyDefinition = {
  id: "dummy", name: "Dummy", modelPath: "/dummy.glb", category: "static",
  stats: { maxHealth: 100, defense: 0, attackDamage: 0, movementSpeed: 0 },
  hurtbox: { shape: "cylinder", radius: 0.5, height: 2, offset: [0, 1, 0] },
  immortal: true,
  regeneration: { enabled: true, delay: 5, healthPerSecond: 20 },
};

test("manager uses instance IDs and shared combat rules", () => {
  const manager = createEnemyManager();
  const first = createEnemy("dummy-1", definition, [0, 0, 2], definition);
  const second = createEnemy("dummy-2", definition, [5, 0, 0], definition);
  manager.add(first);
  manager.add(second);
  assert.throws(() => manager.add(first), /déjà utilisé/);
  assert.equal(manager.strike([0, 0, 0], 0), true);
  assert.equal(first.health, 75);
  assert.equal(second.health, 100);
  manager.update(6);
  assert.equal(first.health, 95);
  manager.remove(first.id);
  assert.deepEqual(manager.list().map(({ id }) => id), ["dummy-2"]);
  manager.clear();
  assert.equal(manager.list().length, 0);
});

test("enemy colliders block movement and can be disabled per instance", () => {
  const manager = createEnemyManager();
  const enemy = createEnemy("dummy-3", definition, [0, 0, 3], definition);
  manager.add(enemy);
  const blocked = manager.resolveMovement([0, 0, 0], { x: 0, z: 10 }, 0.4);
  assert.ok(blocked.z < 2.2);
  enemy.collision = { solid: false, radius: 0.5 };
  assert.deepEqual(manager.resolveMovement([0, 0, 0], { x: 0, z: 10 }, 0.4), { x: 0, z: 10 });
  enemy.collision.solid = true;
  enemy.defeated = true;
  assert.deepEqual(manager.resolveMovement([0, 0, 0], { x: 0, z: 10 }, 0.4), { x: 0, z: 10 });
});

test("custom attack range and damage affect enemy health rather than only debug visuals", () => {
  const manager = createEnemyManager();
  const enemy = createEnemy("far-target", definition, [0, 0, 4], definition);
  manager.add(enemy);
  assert.equal(manager.strike([0, 0, 0], 0), false);
  assert.equal(manager.strike([0, 0, 0], 0,
    { damage: 37, range: 4, radius: 0.3, height: 1 }), true);
  assert.equal(enemy.health, 63);
});
