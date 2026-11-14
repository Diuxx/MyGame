import animationManifest from "../../ANIMATIONS.json" with { type: "json" };

type Movement = { speed: number; facingOffset?: number };
type Window = { from: number; until: number };
type AttackImpact = Window & { doubleHit: boolean; second: Window };
type Definition = {
  id: string;
  displayName: string;
  category: "movement" | "action";
  loop: boolean;
  playbackSpeed: number;
  movement?: Movement;
  dodge?: { distance: number; window: Window };
  impact?: AttackImpact;
};

function locomotion(id: string, displayName: string, movement?: Movement, playbackSpeed = 1): Definition {
  return { id, displayName, category: "movement", loop: true, playbackSpeed, movement };
}

function action(id: string, displayName: string, settings?: Partial<Pick<Definition, "playbackSpeed" | "dodge" | "impact">>): Definition {
  return { id, displayName, category: "action", loop: false, playbackSpeed: 1, ...settings };
}

export const HERO_ANIMATIONS = {
  run: locomotion("run", "Course", { speed: 4.5 }),
  walk: locomotion("walk", "Marche", { speed: 3 }, 1.3),
  crouch: locomotion("crouch-walk", "Marche accroupie", { speed: 1.5, facingOffset: 0 }),
  idle: locomotion("idle", "Repos"),
  combatIdle: locomotion("combat-idle", "Repos en combat"),
  left: locomotion("strafe-left", "Pas à gauche", { speed: 1.5, facingOffset: Math.PI / 2 }),
  right: locomotion("strafe-right", "Pas à droite", { speed: 1.5, facingOffset: -Math.PI / 2 }),
  backward: locomotion("walk-backward", "Marche arrière", { speed: 1.5, facingOffset: Math.PI }),
  dodge: action("dodge", "Esquive", {
    playbackSpeed: 2.5,
    dodge: { distance: 2, window: { from: 0.15, until: 0.9 } },
  }),
  attack: action("attack", "Attaque à l’épée", {
    playbackSpeed: 2,
    impact: { from: 0.23, until: 0.5, doubleHit: true, second: { from: 0.5, until: 0.8 } },
  }),
  jump: action("jump", "Saut", { playbackSpeed: 1.5 }),
  stop: action("stop", "Arrêt brusque après sprint"),
};

export const ANIMATION_DEFINITIONS = Object.values(HERO_ANIMATIONS);
const definitions = new Map(ANIMATION_DEFINITIONS.map((definition) => [definition.id, definition]));
const legacyIds = new Map(animationManifest.animations.map(({ name, source }) => [name, source]));
legacyIds.set(HERO_ANIMATIONS.combatIdle.id, "Idle_5");
export const getAnimationDefinition = (id: string) => definitions.get(id);

export const ANIMATION_RANGES = {
  playback: { min: 0.25, max: 2.5, step: 0.05 },
  movement: { min: 0.5, max: 8, step: 0.1 },
  distance: { min: 0, max: 10, step: 0.1 },
  progress: { min: 0, max: 1, step: 0.01 },
};

export type AnimationSetting = {
  playbackSpeed: number;
  movement?: { speed: number; sync: boolean };
  dodge?: { distance: number; window: Window };
  impact?: AttackImpact;
};
export type AnimationSettings = Record<string, AnimationSetting>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function number(value: unknown, fallback: number, { min, max }: { min: number; max: number }): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function windowSettings(value: unknown, defaults: Window): Window {
  const { from, until } = record(value);
  const start = number(from, defaults.from, ANIMATION_RANGES.progress);
  const end = number(until, defaults.until, ANIMATION_RANGES.progress);
  return { from: start, until: Math.max(start, end) };
}

export function createAnimationSettings(saved?: unknown): AnimationSettings {
  const entries = record(saved);
  return Object.fromEntries(ANIMATION_DEFINITIONS.map((definition) => {
    const legacyId = legacyIds.get(definition.id);
    const value = record(entries[definition.id] ?? (legacyId ? entries[legacyId] : undefined));
    const settings: AnimationSetting = {
      playbackSpeed: number(value.playbackSpeed, definition.playbackSpeed, ANIMATION_RANGES.playback),
    };
    if (definition.movement) {
      const { speed, sync } = record(value.movement);
      settings.movement = { speed: number(speed, definition.movement.speed, ANIMATION_RANGES.movement), sync: sync === true };
    }
    if (definition.dodge) {
      const dodge = record(value.dodge);
      settings.dodge = {
        distance: number(dodge.distance, definition.dodge.distance, ANIMATION_RANGES.distance),
        window: windowSettings(dodge.window, definition.dodge.window),
      };
    }
    if (definition.impact) {
      const impact = record(value.impact);
      settings.impact = {
        ...windowSettings(impact, definition.impact),
        doubleHit: typeof impact.doubleHit === "boolean" ? impact.doubleHit : definition.impact.doubleHit,
        second: windowSettings(impact.second, definition.impact.second),
      };
    }
    return [definition.id, settings];
  }));
}

export function createAttackHits(impact: AttackImpact) {
  const windows = impact.doubleHit ? [impact, impact.second] : [impact];
  return windows.map(({ from, until }) => ({ window: { from, until }, triggered: false }));
}

export function effectivePlaybackSpeed(definition: Definition, settings: AnimationSetting): number {
  const speed = settings.movement?.sync && definition.movement
    ? definition.playbackSpeed * settings.movement.speed / definition.movement.speed
    : settings.playbackSpeed;
  return number(speed, definition.playbackSpeed, ANIMATION_RANGES.playback);
}
