import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMapEnemySimulation } from "./mapEnemySimulation.ts";
import { loadEnemyDefinitions, type EnemyDefinition } from "./enemyDefinitions.ts";
import { buildMapObstacles, mapBounds, resolveMapMovement } from "../world/maps/mapCollision.ts";
import { validateMapAssets, validateMapDefinition } from "../world/maps/validation.ts";
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

test("the dojo goblin spawns clear of obstacles and waits, pursues, returns and respawns", () => {
  const load = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
  const catalog = loadEnemyDefinitions(load("./fieldEnemyDefinitions.json"));
  const assets = validateMapAssets(load("../../public/assets/definitions/assets.json"));
  const dojo = validateMapDefinition(load("../../public/assets/maps/dojo.json"), assets,
    new Set(catalog.map(({ id }) => id)));
  const spec = dojo.enemySpawns?.find(({ id }) => id === "goblin-poc");
  const hero = dojo.spawnPoints.find(({ type }) => type === "player");
  assert.ok(spec && hero);
  const obstacles = buildMapObstacles(dojo, assets);
  const bounds = mapBounds(dojo);
  const game = createMapEnemySimulation({ enemySpawns: [spec], waves: [], events: [] }, catalog, undefined,
    { move: (start, step, radius) => resolveMapMovement(start, step, radius, obstacles, bounds) });
  const [goblin] = game.list();
  assert.equal(goblin.state, "idle");
  game.update(0.5, hero.position);
  assert.deepEqual(goblin.entity.position, spec.position);
  assert.equal(goblin.state, "idle");

  const [x, y, z] = spec.position;
  const target = [x + 2, y, z] as const;
  game.update(0.5, target);
  assert.equal(goblin.state, "chase");
  assert.deepEqual(goblin.entity.position, [x + 1, y, z]);
  game.update(0.1, target);
  assert.equal(goblin.state, "windup");
  game.update(0.5, target);
  assert.ok(game.events().some(({ type }) => type === "hitHero"));

  const outsideLeash = [x + 7, y, z] as const;
  game.update(0.25, outsideLeash);
  assert.equal(goblin.state, "return");
  assert.deepEqual(goblin.entity.position, [x + 0.5, y, z]);
  game.update(0.25, outsideLeash);
  game.update(0.1, outsideLeash);
  assert.equal(goblin.state, "idle");
  assert.deepEqual(goblin.entity.position, spec.position);
  assert.equal(goblin.yaw, spec.rotationY * Math.PI / 180);

  assert.ok(game.strike([x, y, z - 1], 0, { damage: 100, range: 2, radius: 0.5, height: 0.7 }));
  game.update(9.9, outsideLeash);
  assert.equal(goblin.state, "dead");
  game.update(0.1, outsideLeash);
  assert.equal(goblin.state, "idle");
  assert.deepEqual(goblin.entity.position, spec.position);
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

test("patrol follows successive waypoints without aggro", () => {
  const patrol: MapEnemySpawn = {
    ...spawn, position: [0, 0, 0],
    ai: { ...spawn.ai, profile: "patrol", patrol: [[0, 0, 0], [3, 0, 0]] },
  };
  const game = sim({ enemySpawns: [patrol] });
  game.update(0.1, [50, 0, 50]);
  game.update(0.5, [50, 0, 50]);
  assert.equal(game.list()[0].state, "patrol");
  assert.ok(game.list()[0].entity.position[0] > 0.5);
});

test("heal is a real ability and does not damage the hero", () => {
  const healer: MapEnemySpawn = {
    ...spawn, position: [0, 0, 1],
    ai: { ...spawn.ai, skills: ["heal"] },
  };
  const game = sim({ enemySpawns: [healer] });
  game.list()[0].entity.health = 35;
  game.update(0.1, [0, 0, 0]);
  assert.equal(game.list()[0].skill, "heal");
  game.update(0.6, [0, 0, 0]);
  assert.equal(game.list()[0].entity.health, 55);
  assert.equal(game.events().filter((event) => event.type === "hitHero").length, 0);
});

test("persisted first wave unlocks only the next wave on reload", () => {
  const config: MapEncounterConfig = {
    enemySpawns: [
      { ...spawn, id: "first-actor", activation: { mode: "wave", waveId: "first" },
        respawn: { mode: "never" } },
      { ...spawn, id: "second-actor", activation: { mode: "wave", waveId: "second" },
        respawn: { mode: "never" } },
    ],
    waves: [{ id: "first", starts: "always" }, { id: "second", starts: "afterPrevious" }],
    events: [],
  };
  const game = createMapEnemySimulation(config, [definition],
    { defeatedIds: [], clearedWaveIds: ["first"] });
  assert.equal(game.list()[0].state, "inactive");
  assert.equal(game.list()[1].state, "idle");
});

test("guard protects a shorter perimeter than aggressive melee enemies", () => {
  const guard = sim();
  const aggressive = sim({ enemySpawns: [{
    ...spawn, ai: { ...spawn.ai, profile: "aggressive" },
  }] });
  guard.update(0.1, [0, 0, 2]);
  aggressive.update(0.1, [0, 0, 2]);
  guard.update(0.2, [0, 0, -3]);
  aggressive.update(0.2, [0, 0, -3]);
  assert.equal(guard.list()[0].state, "return");
  assert.equal(aggressive.list()[0].state, "chase");
});

test("per-instance movement, collision and hurtbox overrides do not mutate other enemies", () => {
  const first = { ...spawn, id: "fast", overrides: {
    movementSpeed: 5, collisionRadius: 0.9, hurtboxRadius: 0.75,
  } };
  const second = { ...spawn, id: "normal", position: [5, 0, 4] as const };
  const game = sim({ enemySpawns: [first, second] });
  const [fast, normal] = game.list();
  assert.equal(fast.entity.stats.movementSpeed, 5);
  assert.equal(normal.entity.stats.movementSpeed, 2);
  assert.equal(fast.entity.collision?.radius, 0.9);
  assert.equal(normal.entity.collision, undefined);
  assert.equal(fast.entity.definition.hurtbox.shape, "cylinder");
  if (fast.entity.definition.hurtbox.shape === "cylinder") {
    assert.equal(fast.entity.definition.hurtbox.radius, 0.75);
  }
  if (normal.entity.definition.hurtbox.shape === "cylinder") {
    assert.equal(normal.entity.definition.hurtbox.radius, 0.4);
  }
  assert.equal(definition.hurtbox.shape, "cylinder");
  if (definition.hurtbox.shape === "cylinder") assert.equal(definition.hurtbox.radius, 0.4);
});
