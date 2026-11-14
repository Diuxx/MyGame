import assert from "node:assert/strict";
import test from "node:test";
import { parseMapEncounters } from "./mapEnemyConfig.ts";

const catalog = new Set(["guard", "boss"]);
const basic = {
  id: "enemy-1", enemyId: "guard", position: [2, 0, 3], rotationY: 0,
  activation: { mode: "always" }, respawn: { mode: "afterDelay", delaySeconds: 5 },
  ai: { profile: "guard", aggroRadius: 6, leashRadius: 10, attackRange: 1.5,
    attackCooldown: 2, skills: ["slash"] },
};
test("optional encounters preserve existing map files", () => {
  assert.deepEqual(parseMapEncounters({}, catalog), { enemySpawns: [], waves: [], events: [] });
});
test("validate references, ranges, duplicate IDs and incompatible persistence", () => {
  assert.equal(parseMapEncounters({ enemySpawns: [basic] }, catalog).enemySpawns[0].ai.profile, "guard");
  assert.throws(() => parseMapEncounters({ enemySpawns: [{ ...basic, enemyId: "ghost" }] }, catalog), /inconnu/);
  assert.throws(() => parseMapEncounters({ enemySpawns: [basic, basic] }, catalog), /dupliqué/);
  assert.throws(() => parseMapEncounters({ enemySpawns: [{ ...basic, ai: { ...basic.ai, leashRadius: 1 } }] }, catalog), /leashRadius/);
  assert.throws(() => parseMapEncounters({ enemySpawns: [{ ...basic, persistDeath: true }] }, catalog), /incompatible/);
});
test("wave and boss phase definitions validate all references", () => {
  const boss = { ...basic, enemyId: "boss", id: "boss-1", activation: { mode: "wave", waveId: "finale" },
    respawn: { mode: "never" }, persistDeath: true,
    boss: { phases: [{ belowHealth: 0.7, attackSpeedMultiplier: 0.8, skill: "cleave" },
      { belowHealth: 0.3, attackSpeedMultiplier: 0.5, skill: "bolt" }] } };
  const value = { waves: [{ id: "finale", starts: "always" }], enemySpawns: [boss],
    events: [{ id: "win", when: { type: "enemyDefeated", target: "boss-1" }, message: "Victory" }] };
  assert.equal(parseMapEncounters(value, catalog).enemySpawns[0].boss?.phases.length, 2);
  assert.throws(() => parseMapEncounters({ ...value, waves: [] }, catalog), /Vague inconnue/);
  assert.throws(() => parseMapEncounters({ ...value, enemySpawns: [{ ...boss,
    boss: { phases: [...boss.boss.phases].reverse() } }] }, catalog), /décroissantes/);
});

test("wave actors cannot respawn and first wave must be immediately startable", () => {
  assert.throws(() => parseMapEncounters({
    waves: [{ id: "intro", starts: "always" }],
    enemySpawns: [{ ...basic, activation: { mode: "wave", waveId: "intro" } }],
  }, catalog), /respawn/);
  assert.throws(() => parseMapEncounters({
    waves: [{ id: "intro", starts: "afterPrevious" }], enemySpawns: [],
  }, catalog), /première vague/);
});
