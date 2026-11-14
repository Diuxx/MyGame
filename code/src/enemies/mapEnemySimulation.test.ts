import test from "node:test";
import assert from "node:assert/strict";
import { createMapEnemySimulation } from "./mapEnemySimulation.ts";
import type { EnemyDefinition } from "./enemyDefinitions.ts";
import type { MapEncounterConfig, MapEnemySpawn } from "./mapEnemyConfig.ts";

const definition: EnemyDefinition = {
  id: "sentry", name: "Sentinelle", modelPath: "/assets/sentry.glb", category: "animated",
  stats: { maxHealth: 100, defense: 0, attackDamage: 15, movementSpeed: 2 },
  immortal: false, regeneration: { enabled: false, delay: 1, healthPerSecond: 0 },
  hurtbox: { shape: "cylinder", radius: 0.4, height: 1.8, offset: [0, 0.9, 0] },
};
const spawn: MapEnemySpawn = {
  id: "sentry-1", enemyId: "sentry", position: [0, 0, 4], rotationY: 180,
  activation: { mode: "always" }, respawn: { mode: "afterDelay", delaySeconds: 0.5 },
  persistDeath: false,
  ai: { profile: "guard", aggroRadius: 5, attackRange: 1.4,
    leashRadius: 8, attackCooldown: 0.5, patrol: [], skills: ["slash"] },
};
function sim(config: Partial<MapEncounterConfig> = {}) {
  return createMapEnemySimulation({
    enemySpawns: config.enemySpawns ?? [spawn],
    waves: config.waves ?? [],
    events: config.events ?? [],
  }, [definition]);
}
test("guard detects within circle, chases, then returns when player leaves leash", () => {
  const game = sim();
  game.update(0.5, [0, 0, 0]);
  const actor = game.list()[0];
  assert.equal(actor.state, "chase");
  assert.ok(actor.entity.position[2] < 4);
  game.update(1, [0, 0, 20]);
  assert.equal(actor.state, "return");
  game.update(3, [0, 0, 20]);
  assert.ok(Math.abs(actor.entity.position[2] - 4) < 0.1);
});
test("enemy telegraphs before damaging the player, then respects cooldown", () => {
  const game = sim({ enemySpawns: [{ ...spawn, position: [0, 0, 1] }] });
  game.update(0.1, [0, 0, 0]);
  assert.equal(game.list()[0].state, "windup");
  assert.equal(game.events().filter((e) => e.type === "hitHero").length, 0);
  game.update(0.5, [0, 0, 0]);
  assert.deepEqual(game.events().filter((e) => e.type === "hitHero")
    .map((e) => e.type), ["hitHero"]);
});
test("hero damage kills and timed respawn recreates enemy health and position", () => {
  const game = sim({ enemySpawns: [{ ...spawn, position: [0, 0, 1] }] });
  assert.equal(game.strike([0, 0, 0], 0, { damage: 125, range: 2, radius: 0.5, height: 1 }), true);
  assert.equal(game.list()[0].state, "dead");
  assert.equal(game.list()[0].entity.health, 0);
  game.update(0.6, [15, 0, 15]);
  assert.equal(game.list()[0].state, "idle");
  assert.equal(game.list()[0].entity.health, 100);
});
test("waves unlock the boss and its health thresholds emit phase events", () => {
  const opening = { ...spawn, position: [0, 0, 1] as const, activation: { mode: "wave" as const, waveId: "opening" },
    respawn: { mode: "never" as const } };
  const boss: MapEnemySpawn = {
    ...spawn, id: "boss", position: [0, 0, 1], activation: { mode: "wave", waveId: "boss-wave" },
    respawn: { mode: "never" }, persistDeath: true,
    boss: { phases: [
      { belowHealth: 0.7, attackSpeedMultiplier: 0.8, skill: "cleave" },
      { belowHealth: 0.3, attackSpeedMultiplier: 0.5, skill: "bolt" },
    ] },
  };
  const game = sim({ enemySpawns: [opening, boss], waves: [
    { id: "opening", starts: "always" }, { id: "boss-wave", starts: "afterPrevious" },
  ], events: [{ id: "win", when: { type: "enemyDefeated", target: "boss" }, message: "Victory" }] });
  assert.equal(game.list()[1].state, "inactive");
  game.strike([0, 0, 0], 0, { damage: 101, range: 2, radius: 0.5, height: 1 });
  // The first attack hits only the active first-wave enemy.
  assert.equal(game.list()[1].state, "idle");
  assert.ok(game.events().some((e) => e.type === "waveCleared"));
  game.strike([0, 0, 0], 0, { damage: 75, range: 2, radius: 0.5, height: 1 });
  assert.equal(game.list()[1].phaseIndex, 1);
  assert.equal(game.events().filter((e) => e.type === "bossPhase").length, 2);
  game.strike([0, 0, 0], 0, { damage: 50, range: 2, radius: 0.5, height: 1 });
  assert.ok(game.progress().defeatedIds.includes("boss"));
  assert.ok(game.progress().clearedWaveIds.includes("boss-wave"));
});
test("persistent death keeps a defeated boss inactive on map reload", () => {
  const persistent = { ...spawn, id: "boss", persistDeath: true, respawn: { mode: "never" as const } };
  const game = createMapEnemySimulation({ enemySpawns: [persistent], waves: [], events: [] }, [definition],
    { defeatedIds: ["boss"], clearedWaveIds: [] });
  assert.equal(game.list()[0].state, "inactive");
  assert.equal(game.list()[0].entity.defeated, true);
});
test("ranged AI remains at distance and emits a bolt skill", () => {
  const ranged = { ...spawn, position: [0, 0, 4] as const,
    ai: { ...spawn.ai, profile: "ranged" as const, attackRange: 5, skills: ["bolt" as const] } };
  const game = sim({ enemySpawns: [ranged] });
  game.update(0.1, [0, 0, 0]);
  assert.equal(game.list()[0].skill, "bolt");
  game.update(0.7, [0, 0, 0]);
  assert.ok(game.events().some((e) => e.type === "hitHero" && e.skill === "bolt"));
});
