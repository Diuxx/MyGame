import animationManifest from "../../ANIMATIONS.json" with { type: "json" };
import { animationFlag, animationNumber, animationWindow } from "./heroTuning.ts";
import { createTransitionSettings, type TransitionSettings } from "./transitionSettings.ts";

type Window = { from: number; until: number };
type AttackImpact = Window & { doubleHit: boolean; second: Window };
type Definition = AnimationSetting & {
  id: string;
  displayName: string;
  category: "movement" | "action" | "lifecycle";
  loop: boolean;
  movement?: AnimationSetting["movement"] & {
    facingOffset?: number;
    syncReference: { speed: number; playbackSpeed: number };
  };
};

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

function readDefinition(clip: typeof animationManifest.animations[number]): Definition {
  const { name: id, displayName, category, loop } = clip;
  const settings = (animationManifest.settings as Partial<AnimationSettings>)[id];
  const field = "settings." + id;
  if (!settings || typeof displayName !== "string" || !displayName.trim() ||
      (category !== "movement" && category !== "action" && category !== "lifecycle")) {
    throw new Error(`ANIMATIONS.json · définition invalide pour ${id}.`);
  }
  const definition: Definition = {
    id, displayName, category, loop: animationFlag(loop, id + ".loop"),
    playbackSpeed: animationNumber(settings.playbackSpeed, field + ".playbackSpeed",
      ANIMATION_RANGES.playback.min, ANIMATION_RANGES.playback.max),
  };
  if (settings.movement) {
    const reference = "syncReference" in clip ? clip.syncReference : undefined;
    definition.movement = {
      speed: animationNumber(settings.movement.speed, field + ".movement.speed",
        ANIMATION_RANGES.movement.min, ANIMATION_RANGES.movement.max),
      sync: animationFlag(settings.movement.sync, field + ".movement.sync"),
      syncReference: {
        speed: animationNumber(reference?.speed, id + ".syncReference.speed", 0.001),
        playbackSpeed: animationNumber(reference?.playbackSpeed, id + ".syncReference.playbackSpeed", 0.001),
      },
      ...("facingOffset" in clip ? { facingOffset: animationNumber(clip.facingOffset, id + ".facingOffset", -Infinity) } : {}),
    };
  }
  if (settings.dodge) {
    definition.dodge = {
      distance: animationNumber(settings.dodge.distance, field + ".dodge.distance", 0, ANIMATION_RANGES.distance.max),
      window: animationWindow(settings.dodge.window, field + ".dodge.window"),
    };
  }
  if (settings.impact) {
    definition.impact = {
      ...animationWindow(settings.impact, field + ".impact"),
      doubleHit: animationFlag(settings.impact.doubleHit, field + ".impact.doubleHit"),
      second: animationWindow(settings.impact.second, field + ".impact.second"),
    };
  }
  return definition;
}

const definitions = new Map<string, Definition>();
for (const clip of animationManifest.animations) {
  if (definitions.has(clip.name)) throw new Error("ANIMATIONS.json · clip dupliqué : " + clip.name);
  definitions.set(clip.name, readDefinition(clip));
}
export const getAnimationDefinition = (id: string) => definitions.get(id);

function requireDefinition(id: string, category: Definition["category"], setting?: "movement" | "dodge" | "impact"): Definition {
  const definition = getAnimationDefinition(id);
  if (!definition || definition.category !== category || (setting && !definition[setting])) {
    throw new Error("ANIMATIONS.json · configuration requise pour " + id + ".");
  }
  return definition;
}

export const HERO_ANIMATIONS = {
  run: requireDefinition("run", "movement", "movement"),
  walk: requireDefinition("walk", "movement", "movement"),
  combatStance: requireDefinition("combat-stance", "movement", "movement"),
  idle: requireDefinition("idle", "movement"),
  dodge: requireDefinition("dodge", "action", "dodge"),
  attack: requireDefinition("attack", "action", "impact"),
  jump: requireDefinition("jump", "action"),
  stop: requireDefinition("stop", "action"),
  dying: requireDefinition("dying", "lifecycle"),
};
const standardAnimations = Object.values(HERO_ANIMATIONS);
export const ANIMATION_DEFINITIONS = [
  ...standardAnimations,
  ...Array.from(definitions.values()).filter((definition) => !standardAnimations.includes(definition)),
];
const legacyIds = new Map(animationManifest.animations.flatMap(({ name, source }) => source ? [[name, source] as const] : []));

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

export function createAnimationSettings(saved?: unknown, resetAttackTiming = false): AnimationSettings {
  const entries = record(saved);
  return Object.fromEntries(ANIMATION_DEFINITIONS.map((definition) => {
    const legacyId = legacyIds.get(definition.id);
    const legacyCombat = definition === HERO_ANIMATIONS.combatStance
      ? entries["crouch-walk"] ?? entries.Cautious_Crouch_Walk_Forward_inplace
      : undefined;
    const value = record(entries[definition.id] ?? (legacyId ? entries[legacyId] : undefined) ?? legacyCombat);
    const settings: AnimationSetting = {
      playbackSpeed: number(value.playbackSpeed, definition.playbackSpeed, ANIMATION_RANGES.playback),
    };
    if (definition.movement) {
      const { speed, sync } = record(value.movement);
      settings.movement = {
        speed: number(speed, definition.movement.speed, ANIMATION_RANGES.movement),
        sync: typeof sync === "boolean" ? sync : definition.movement.sync,
      };
    }
    if (definition.dodge) {
      const dodge = record(value.dodge);
      settings.dodge = {
        distance: number(dodge.distance, definition.dodge.distance, ANIMATION_RANGES.distance),
        window: windowSettings(dodge.window, definition.dodge.window),
      };
    }
    if (definition.impact) {
      const impact = resetAttackTiming ? {} : record(value.impact);
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
  const reference = definition.movement?.syncReference;
  const speed = settings.movement?.sync && reference
    ? reference.playbackSpeed * settings.movement.speed / reference.speed
    : settings.playbackSpeed;
  return number(speed, definition.playbackSpeed, ANIMATION_RANGES.playback);
}

export function serializeAnimationManifest(settings: AnimationSettings, transitions: TransitionSettings): string {
  return JSON.stringify({
    ...animationManifest,
    settings: createAnimationSettings(settings),
    transitions: createTransitionSettings(transitions),
  }, null, 2) + "\n";
}
