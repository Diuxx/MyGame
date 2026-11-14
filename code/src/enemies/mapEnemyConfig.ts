import type { Position } from "../combat/combat.ts";

export type AIProfile = "guard" | "patrol" | "aggressive" | "ranged";
export type EnemySkill = "slash" | "cleave" | "bolt" | "heal";
export type Activation = { mode: "always" } | { mode: "wave"; waveId: string };
export type Respawn = { mode: "never" } | { mode: "afterDelay"; delaySeconds: number };
export interface AISettings {
  profile: AIProfile;
  aggroRadius: number;
  attackRange: number;
  leashRadius: number;
  attackCooldown: number;
  patrol: Position[];
  skills: EnemySkill[];
}
export interface BossPhase {
  belowHealth: number;
  attackSpeedMultiplier: number;
  skill: EnemySkill;
}
export interface MapEnemySpawn {
  id: string;
  enemyId: string;
  position: Position;
  rotationY: number;
  activation: Activation;
  respawn: Respawn;
  ai: AISettings;
  persistDeath: boolean;
  boss?: { phases: BossPhase[] };
}
export interface MapWave {
  id: string;
  starts: "always" | "afterPrevious";
}
export interface MapEncounterEvent {
  id: string;
  when: { type: "enemyDefeated" | "waveCleared" | "bossPhase"; target: string };
  message: string;
}
export interface MapEncounterConfig {
  enemySpawns: MapEnemySpawn[];
  waves: MapWave[];
  events: MapEncounterEvent[];
}

const ID = /^[a-z0-9][a-z0-9_-]{0,79}$/i;

function data(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(path + " : objet attendu.");
  }
  return value as Record<string, unknown>;
}
function entries(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(path + " : tableau attendu.");
  return value as unknown[];
}
function id(value: unknown, path: string): string {
  if (typeof value !== "string" || !ID.test(value)) throw new Error(path + " : identifiant invalide.");
  return value;
}
function value(value: unknown, path: string, min = -Infinity, max = Infinity): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(path + " : nombre invalide (" + min + " à " + max + ").");
  }
  return value;
}
function position(valueAt: unknown, path: string): Position {
  const items = entries(valueAt, path);
  if (items.length !== 3) throw new Error(path + " : trois coordonnées attendues.");
  return [value(items[0], path), value(items[1], path), value(items[2], path)];
}
function choice<T extends string>(candidate: unknown, allowed: readonly T[], path: string): T {
  if (typeof candidate !== "string" || !allowed.includes(candidate as T)) {
    throw new Error(path + " : valeur inconnue " + String(candidate));
  }
  return candidate as T;
}
function distinct(items: readonly { id: string }[], path: string): void {
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error(path + " : identifiant dupliqué.");
}

const SKILLS = ["slash", "cleave", "bolt", "heal"] as const;

function parseAI(raw: unknown, path: string): AISettings {
  const ai = data(raw, path);
  const profile = choice(ai.profile, ["guard", "patrol", "aggressive", "ranged"], path + ".profile");
  const attackRange = value(ai.attackRange, path + ".attackRange", 0.3, 12);
  const aggroRadius = value(ai.aggroRadius, path + ".aggroRadius", attackRange, 30);
  const leashRadius = value(ai.leashRadius, path + ".leashRadius", aggroRadius, 40);
  const skills = entries(ai.skills, path + ".skills").map((skill, index) =>
    choice(skill, SKILLS, path + ".skills[" + index + "]"));
  if (!skills.length) throw new Error(path + ".skills : au moins une compétence requise.");
  const patrol = ai.patrol === undefined ? [] : entries(ai.patrol, path + ".patrol").map((pos, index) =>
    position(pos, path + ".patrol[" + index + "]"));
  if (profile === "patrol" && !patrol.length) throw new Error(path + " : patrol requiert des points.");
  return {
    profile, attackRange, aggroRadius, leashRadius,
    attackCooldown: value(ai.attackCooldown, path + ".attackCooldown", 0.25, 30),
    patrol, skills,
  };
}

function parseSpawn(raw: unknown, index: number, catalog: ReadonlySet<string>): MapEnemySpawn {
  const path = "enemySpawns[" + index + "]";
  const item = data(raw, path);
  const enemyId = id(item.enemyId, path + ".enemyId");
  if (!catalog.has(enemyId)) throw new Error(path + " : type d'ennemi inconnu : " + enemyId);
  const rawActivation = data(item.activation, path + ".activation");
  const mode = choice(rawActivation.mode, ["always", "wave"], path + ".activation.mode");
  const activation: Activation = mode === "wave"
    ? { mode, waveId: id(rawActivation.waveId, path + ".activation.waveId") }
    : { mode };
  const rawRespawn = data(item.respawn, path + ".respawn");
  const respawnMode = choice(rawRespawn.mode, ["never", "afterDelay"], path + ".respawn.mode");
  const respawn: Respawn = respawnMode === "afterDelay"
    ? { mode: respawnMode, delaySeconds: value(rawRespawn.delaySeconds, path + ".delaySeconds", 0.1, 3600) }
    : { mode: respawnMode };
  const persistDeath = item.persistDeath === undefined ? false : item.persistDeath;
  if (typeof persistDeath !== "boolean") throw new Error(path + " : persistDeath booléen attendu.");
  if (persistDeath && respawn.mode !== "never") throw new Error(path + " : persistance incompatible avec respawn.");
  let boss: MapEnemySpawn["boss"];
  if (item.boss !== undefined) {
    const settings = data(item.boss, path + ".boss");
    const phases = entries(settings.phases, path + ".boss.phases").map((rawPhase, phaseIndex) => {
      const phase = data(rawPhase, path + ".boss.phases[" + phaseIndex + "]");
      return {
        belowHealth: value(phase.belowHealth, "boss.belowHealth", 0.01, 0.99),
        attackSpeedMultiplier: value(phase.attackSpeedMultiplier, "boss.attackSpeedMultiplier", 0.25, 3),
        skill: choice(phase.skill, SKILLS, "boss.skill"),
      };
    });
    if (!phases.length || phases.length > 5 ||
        phases.some((phase, i) => i > 0 && phase.belowHealth >= phases[i - 1].belowHealth)) {
      throw new Error(path + " : phases de boss décroissantes attendues.");
    }
    boss = { phases };
  }
  return {
    id: id(item.id, path + ".id"), enemyId,
    position: position(item.position, path + ".position"),
    rotationY: value(item.rotationY, path + ".rotationY"),
    activation, respawn, ai: parseAI(item.ai, path + ".ai"),
    persistDeath, ...(boss ? { boss } : {}),
  };
}

/** All checks run before a map is constructed; legacy maps simply get empty encounters. */
export function parseMapEncounters(valueAt: unknown, catalog: ReadonlySet<string>): MapEncounterConfig {
  const root = data(valueAt, "map");
  const waves = (root.waves === undefined ? [] : entries(root.waves, "waves")).map((raw, index): MapWave => {
    const wave = data(raw, "waves[" + index + "]");
    return {
      id: id(wave.id, "waves.id"),
      starts: choice(wave.starts, ["always", "afterPrevious"], "waves.starts"),
    };
  });
  if (waves.length > 20) throw new Error("Maximum 20 vagues.");
  distinct(waves, "waves");
  const spawns = (root.enemySpawns === undefined ? [] : entries(root.enemySpawns, "enemySpawns"))
    .map((raw, index) => parseSpawn(raw, index, catalog));
  if (spawns.length > 80) throw new Error("Maximum 80 ennemis par map.");
  distinct(spawns, "enemySpawns");
  for (const spawn of spawns) {
    if (spawn.activation.mode === "wave" && !waves.some((wave) => wave.id === spawn.activation.waveId)) {
      throw new Error("Vague inconnue : " + spawn.activation.waveId);
    }
  }
  const events = (root.events === undefined ? [] : entries(root.events, "events")).map((raw, index): MapEncounterEvent => {
    const entry = data(raw, "events[" + index + "]");
    const when = data(entry.when, "events.when");
    const type = choice(when.type, ["enemyDefeated", "waveCleared", "bossPhase"], "events.when.type");
    const target = id(when.target, "events.when.target");
    if (type === "waveCleared" ? !waves.some((wave) => wave.id === target)
      : !spawns.some((spawn) => spawn.id === target && (type !== "bossPhase" || !!spawn.boss))) {
      throw new Error("events : cible inconnue " + target);
    }
    if (typeof entry.message !== "string" || !entry.message.trim() || entry.message.length > 200) {
      throw new Error("events : message invalide.");
    }
    return { id: id(entry.id, "events.id"), when: { type, target }, message: entry.message };
  });
  if (events.length > 50) throw new Error("Maximum 50 événements.");
  distinct(events, "events");
  return { enemySpawns: spawns, waves, events };
}
