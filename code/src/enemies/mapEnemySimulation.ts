import { applyDamage, intersectsSwing, type Position, type SwordSwing } from "../combat/combat.ts";
import { intersectsMeleeHitbox } from "../combat/hitDetection.ts";
import { resolveCircleMovement, type GroundStep } from "../combat/bodyCollision.ts";
import type { EnemyDefinition } from "./enemyDefinitions.ts";
import { createEnemy, getEnemyCollision, resetEnemy, type Enemy } from "./enemyState.ts";
import type { EnemySkill, MapEncounterConfig, MapEnemySpawn, MapWave } from "./mapEnemyConfig.ts";

export type EnemyActivity = "inactive" | "idle" | "patrol" | "chase" | "return" | "windup" | "dead";
export type EnemyEvent =
  | { type: "hitHero"; id: string; damage: number; skill: EnemySkill }
  | { type: "death"; id: string; persistent: boolean }
  | { type: "respawn"; id: string }
  | { type: "waveStarted" | "waveCleared"; id: string }
  | { type: "bossPhase"; id: string; phase: number }
  | { type: "message"; id: string; message: string };

export interface SavedMapProgress {
  defeatedIds: string[];
  clearedWaveIds: string[];
}

export interface FieldEnemy {
  spec: MapEnemySpawn;
  entity: Enemy;
  state: EnemyActivity;
  yaw: number;
  cooldown: number;
  windup: number;
  skill: EnemySkill;
  phaseIndex: number;
  patrolIndex: number;
  respawnIn: number;
  nextSkill: number;
}

export interface EnemySimulationOptions {
  move?: (start: Position, desired: GroundStep, radius: number) => GroundStep;
}
const PLAYER_BOX = { shape: "cylinder", radius: 0.4, height: 1.8, offset: [0, 0.9, 0] } as const;
const HERO_RADIUS = 0.4;

function distance(a: Position, b: Position): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}
function heading(from: Position, to: Position): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}
function stepTowards(from: Position, to: Position, speed: number, delta: number): GroundStep {
  const dx = to[0] - from[0], dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  const travel = Math.min(length, speed * delta);
  return length < 1e-6 ? { x: 0, z: 0 } : { x: dx / length * travel, z: dz / length * travel };
}

export function createMapEnemySimulation(
  config: MapEncounterConfig,
  definitions: readonly EnemyDefinition[],
  progress: SavedMapProgress = { defeatedIds: [], clearedWaveIds: [] },
  options: EnemySimulationOptions = {},
) {
  const catalog = new Map(definitions.map((definition) => [definition.id, definition]));
  const permanentlyDead = new Set(progress.defeatedIds);
  const cleared = new Set(progress.clearedWaveIds);
  const waveStarted = new Set<string>();
  const triggeredEvents = new Set<string>();
  const eventQueue: EnemyEvent[] = [];
  const actors = new Map<string, FieldEnemy>();
  const waves = config.waves;

  for (const spec of config.enemySpawns) {
    const definition = catalog.get(spec.enemyId);
    if (!definition) throw new Error("Type d'ennemi absent : " + spec.enemyId);
    // Each placed enemy owns its hurtbox and stats; editing one must not
    // mutate the catalogue or another placement of the same archetype.
    const instanceDefinition = structuredClone(definition);
    if (spec.overrides?.hurtboxRadius && instanceDefinition.hurtbox.shape === "cylinder") {
      instanceDefinition.hurtbox.radius = spec.overrides.hurtboxRadius;
    }
    const settings = {
      ...instanceDefinition,
      stats: { ...instanceDefinition.stats,
        movementSpeed: spec.overrides?.movementSpeed ?? instanceDefinition.stats.movementSpeed },
      collision: spec.overrides?.collisionRadius
        ? { solid: true, radius: spec.overrides.collisionRadius }
        : instanceDefinition.collision,
    };
    const entity = createEnemy(spec.id, instanceDefinition, spec.position, settings);
    const disabled = spec.persistDeath && permanentlyDead.has(spec.id);
    if (disabled) { entity.health = 0; entity.defeated = true; }
    actors.set(spec.id, {
      spec, entity, state: disabled || spec.activation.mode === "wave" ? "inactive" : "idle",
      yaw: spec.rotationY * Math.PI / 180, cooldown: 0, windup: 0, skill: "slash",
      phaseIndex: -1, patrolIndex: 0, respawnIn: 0, nextSkill: 0,
    });
  }

  function notify(type: "enemyDefeated" | "waveCleared" | "bossPhase", target: string): void {
    for (const entry of config.events) {
      if (triggeredEvents.has(entry.id) || entry.when.type !== type || entry.when.target !== target) continue;
      triggeredEvents.add(entry.id);
      eventQueue.push({ type: "message", id: entry.id, message: entry.message });
    }
  }

  function activateWave(wave: MapWave): void {
    if (waveStarted.has(wave.id) || cleared.has(wave.id)) return;
    waveStarted.add(wave.id);
    for (const actor of actors.values()) {
      if (actor.spec.activation.mode !== "wave" || actor.spec.activation.waveId !== wave.id) continue;
      if (actor.spec.persistDeath && permanentlyDead.has(actor.spec.id)) continue;
      actor.state = "idle";
    }
    eventQueue.push({ type: "waveStarted", id: wave.id });
  }

  function checkWaves(): void {
    for (const [index, wave] of waves.entries()) {
      if (cleared.has(wave.id)) continue;
      if (!waveStarted.has(wave.id)) {
        const previous = waves[index - 1];
        if ((index === 0 && wave.starts === "always") ||
            (wave.starts === "afterPrevious" && !!previous && cleared.has(previous.id))) {
          activateWave(wave);
        }
      }
      if (!waveStarted.has(wave.id)) continue;
      const members = [...actors.values()].filter((actor) =>
        actor.spec.activation.mode === "wave" && actor.spec.activation.waveId === wave.id);
      if (members.length && members.every((actor) => actor.entity.defeated)) {
        cleared.add(wave.id);
        eventQueue.push({ type: "waveCleared", id: wave.id });
        notify("waveCleared", wave.id);
      }
    }
  }
  checkWaves();

  function move(actor: FieldEnemy, target: Position, delta: number): void {
    const from = actor.entity.position;
    const desired = stepTowards(from, target, actor.entity.stats.movementSpeed, delta);
    const radius = getEnemyCollision(actor.entity).radius;
    const step = options.move?.(from, desired, radius) ?? desired;
    // Other active enemies remain solid; no Babylon.js dependency.
    const others = [...actors.values()].filter((other) =>
      other !== actor && !other.entity.defeated && other.state !== "inactive")
      .map((other) => ({
        x: other.entity.position[0], z: other.entity.position[2],
        radius: getEnemyCollision(other.entity).radius,
      }));
    const allowed = resolveCircleMovement(from, step, radius, others);
    actor.entity.position = [from[0] + allowed.x, from[1], from[2] + allowed.z];
    if (Math.hypot(desired.x, desired.z) > 0.001) actor.yaw = heading(from, target);
  }

  function startAttack(actor: FieldEnemy): void {
    const phase = actor.spec.boss?.phases[actor.phaseIndex];
    const skills = actor.spec.ai.skills;
    actor.skill = phase?.skill ?? skills[actor.nextSkill++ % skills.length];
    // Healing only makes sense below full health.
    if (actor.skill === "heal" && actor.entity.health >= actor.entity.stats.maxHealth * 0.8) {
      actor.skill = "slash";
    }
    actor.state = "windup";
    const speedMultiplier = phase?.attackSpeedMultiplier ?? 1;
    const baseWindup = actor.skill === "bolt" ? 0.65 : actor.skill === "cleave" ? 0.8 : 0.45;
    actor.windup = baseWindup * speedMultiplier;
    actor.cooldown = actor.spec.ai.attackCooldown * speedMultiplier;
  }

  function completeAttack(actor: FieldEnemy, player: Position, playerAlive: boolean): void {
    actor.state = "chase";
    if (actor.skill === "heal") {
      actor.entity.health = Math.min(actor.entity.stats.maxHealth,
        actor.entity.health + actor.entity.stats.maxHealth * 0.2);
      return;
    }
    if (!playerAlive) return;
    const range = actor.spec.ai.attackRange;
    const hit = actor.skill === "bolt"
      ? distance(actor.entity.position, player) <= range + HERO_RADIUS
      : intersectsMeleeHitbox(actor.entity.position, actor.yaw, player, PLAYER_BOX, {
        range: actor.skill === "cleave" ? range + 0.4 : range,
        radius: actor.skill === "cleave" ? 1.1 : 0.5,
        elevation: 1, verticalRadius: 0.7,
      });
    if (hit) eventQueue.push({
      type: "hitHero", id: actor.spec.id,
      damage: Math.ceil(actor.entity.stats.attackDamage * (actor.skill === "cleave" ? 1.5 : 1)),
      skill: actor.skill,
    });
  }

  function phaseChanges(actor: FieldEnemy): void {
    const phases = actor.spec.boss?.phases ?? [];
    let reached = actor.phaseIndex;
    const ratio = actor.entity.health / actor.entity.stats.maxHealth;
    for (const [index, phase] of phases.entries()) {
      if (ratio <= phase.belowHealth) reached = index;
    }
    if (reached > actor.phaseIndex) {
      for (let phase = actor.phaseIndex + 1; phase <= reached; phase++) {
        eventQueue.push({ type: "bossPhase", id: actor.spec.id, phase: phase + 2 });
        notify("bossPhase", actor.spec.id);
      }
      actor.phaseIndex = reached;
    }
  }

  function recordDeath(actor: FieldEnemy): void {
    if (actor.state === "dead") return;
    actor.state = "dead";
    actor.windup = 0;
    actor.respawnIn = actor.spec.respawn.mode === "afterDelay" ? actor.spec.respawn.delaySeconds : 0;
    if (actor.spec.persistDeath) permanentlyDead.add(actor.spec.id);
    eventQueue.push({ type: "death", id: actor.spec.id, persistent: actor.spec.persistDeath });
    notify("enemyDefeated", actor.spec.id);
    checkWaves();
  }

  function update(delta: number, player: Position, playerAlive = true): void {
    if (!Number.isFinite(delta) || delta < 0) throw new Error("Delta de simulation invalide.");
    for (const actor of actors.values()) {
      if (actor.state === "inactive") continue;
      if (actor.entity.defeated) {
        recordDeath(actor);
        if (actor.spec.respawn.mode === "afterDelay") {
          actor.respawnIn -= delta;
          if (actor.respawnIn <= 0) {
            resetEnemy(actor.entity);
            actor.entity.position = [...actor.spec.position];
            actor.state = "idle";
            actor.phaseIndex = -1;
            actor.cooldown = 0;
            eventQueue.push({ type: "respawn", id: actor.spec.id });
          }
        }
        continue;
      }
      phaseChanges(actor);
      actor.cooldown = Math.max(0, actor.cooldown - delta);
      if (actor.state === "windup") {
        actor.windup -= delta;
        if (actor.windup <= 0) completeAttack(actor, player, playerAlive);
        continue;
      }
      const home = actor.spec.position;
      const playerDistance = distance(actor.entity.position, player);
      const homeDistance = distance(actor.entity.position, home);
      // A guard protects a smaller perimeter; aggressive and ranged profiles
      // can pursue targets throughout their full leash radius.
      const pursuitRadius = actor.spec.ai.profile === "guard"
        ? actor.spec.ai.leashRadius * 0.75
        : actor.spec.ai.leashRadius;
      const beyondLeash = distance(home, player) > pursuitRadius;
      if (!playerAlive || beyondLeash) {
        if (actor.state === "chase" || actor.state === "return") actor.state = "return";
      } else if (actor.state !== "return" && playerDistance <= actor.spec.ai.aggroRadius) {
        actor.state = "chase";
      }
      if (actor.state === "chase" && playerAlive && !beyondLeash) {
        if (playerDistance <= actor.spec.ai.attackRange && actor.cooldown === 0) {
          actor.yaw = heading(actor.entity.position, player);
          startAttack(actor);
        } else if (actor.spec.ai.profile === "ranged" && playerDistance < actor.spec.ai.attackRange * 0.48) {
          const away: Position = [
            actor.entity.position[0] * 2 - player[0], actor.entity.position[1],
            actor.entity.position[2] * 2 - player[2],
          ];
          move(actor, away, delta);
        } else if (playerDistance > actor.spec.ai.attackRange * 0.86) {
          move(actor, player, delta);
        }
      } else if (actor.state === "return" || homeDistance > actor.spec.ai.leashRadius * 0.95) {
        actor.state = "return";
        if (homeDistance <= 0.08) {
          actor.state = "idle";
          actor.entity.position = [...home];
        } else move(actor, home, delta);
      } else if (actor.spec.ai.profile === "patrol" && actor.spec.ai.patrol.length) {
        actor.state = "patrol";
        const target = actor.spec.ai.patrol[actor.patrolIndex];
        if (distance(actor.entity.position, target) < 0.15) {
          actor.patrolIndex = (actor.patrolIndex + 1) % actor.spec.ai.patrol.length;
        } else move(actor, target, delta);
      } else actor.state = "idle";
    }
    checkWaves();
  }

  function strike(origin: Position, yaw: number, swing: SwordSwing): boolean {
    let any = false;
    // Snapshot targets: a wave unlocked by this hit must not be hit by the same swing.
    const candidates = [...actors.values()].filter((actor) =>
      actor.state !== "inactive" && !actor.entity.defeated);
    for (const actor of candidates) {
      if (intersectsSwing(origin, yaw, actor.entity.position,
        actor.entity.definition.hurtbox, actor.yaw, swing) &&
        applyDamage(actor.entity, swing.damage)) {
        any = true;
        if (actor.entity.defeated) recordDeath(actor);
        else phaseChanges(actor);
      }
    }
    return any;
  }

  function resolveHeroMovement(start: Position, step: GroundStep, heroRadius: number): GroundStep {
    const obstacles = [...actors.values()].filter((actor) =>
      actor.state !== "inactive" && !actor.entity.defeated && getEnemyCollision(actor.entity).solid)
      .map((actor) => ({ x: actor.entity.position[0], z: actor.entity.position[2],
        radius: getEnemyCollision(actor.entity).radius }));
    return resolveCircleMovement(start, step, heroRadius, obstacles);
  }

  return {
    list: () => [...actors.values()],
    update, strike, resolveHeroMovement,
    events: (): EnemyEvent[] => eventQueue.splice(0),
    progress: (): SavedMapProgress => ({
      defeatedIds: [...permanentlyDead], clearedWaveIds: [...cleared],
    }),
    resetProgress(): void {
      permanentlyDead.clear();
      cleared.clear();
      waveStarted.clear();
      triggeredEvents.clear();
      for (const actor of actors.values()) {
        resetEnemy(actor.entity);
        actor.entity.position = [...actor.spec.position];
        actor.state = actor.spec.activation.mode === "wave" ? "inactive" : "idle";
        actor.phaseIndex = -1;
        actor.cooldown = 0;
      }
      checkWaves();
    },
  };
}

export type MapEnemySimulation = ReturnType<typeof createMapEnemySimulation>;
