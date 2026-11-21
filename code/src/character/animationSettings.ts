import animationManifest from "../../ANIMATIONS.json" with { type: "json" };
import { animationFlag, animationNumber, animationWindow } from "./heroTuning.ts";
import { createTransitionSettings, type TransitionSettings } from "./transitionSettings.ts";

type Window = { from: number; until: number };
type AttackImpact = Window & { doubleHit: boolean; second: Window };
export type ActionCancelSettings = Partial<Record<"runFrom" | "attackFrom" | "dodgeFrom", number>>;

/** Attack chaining values live in ANIMATIONS.json, not in the controller. */
export interface AttackComboSettings {
  enabled: boolean;
  maxChain: number;
  inputBufferMs: number;
  resetAfterMs: number;
  chainWindow: Window;
  followUp: { animation: string; startProgress: number; blendSeconds: number };
}
const CANCEL_KEYS = ["runFrom", "attackFrom", "dodgeFrom"] as const;
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
  blend: { min: 0, max: 0.5, step: 0.01 },
  comboChain: { min: 1, max: 6, step: 1 },
  comboBuffer: { min: 0, max: 500, step: 10 },
  comboReset: { min: 0, max: 3000, step: 50 },
};

export type AnimationSetting = {
  playbackSpeed: number;
  movement?: { speed: number; sync: boolean };
  dodge?: { distance: number; window: Window };
  impact?: AttackImpact;
  cancel?: ActionCancelSettings;
  blendOutSeconds?: number;
  combo?: AttackComboSettings;
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
  const extra = record(settings);
  if (extra.cancel !== undefined) {
    if (!extra.cancel || typeof extra.cancel !== "object" || Array.isArray(extra.cancel)) {
      throw new Error(`ANIMATIONS.json · ${field}.cancel : objet attendu.`);
    }
    const cancel = record(extra.cancel);
    definition.cancel = {};
    for (const key of CANCEL_KEYS) {
      if (cancel[key] !== undefined) {
        definition.cancel[key] = animationNumber(cancel[key], `${field}.cancel.${key}`, 0, 1);
      }
    }
  }
  if (extra.blendOutSeconds !== undefined) {
    definition.blendOutSeconds = animationNumber(extra.blendOutSeconds,
      field + ".blendOutSeconds", ANIMATION_RANGES.blend.min, ANIMATION_RANGES.blend.max);
  }
  if (extra.combo !== undefined) {
    if (!definition.impact) throw new Error(`ANIMATIONS.json · ${field}.combo : animation sans impact.`);
    definition.combo = validateComboSettings(extra.combo, definition.impact, field + ".combo");
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
  attackFollowUp: requireDefinition("attack-2", "action", "impact"),
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

/** Validate playable combo windows, including the existing attack impact timeline. */
function validateComboSettings(value: unknown, impact: AttackImpact, field: string): AttackComboSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`ANIMATIONS.json · ${field} : objet attendu.`);
  }
  const input = record(value);
  const chainWindow = animationWindow(input.chainWindow as Window, field + ".chainWindow");
  const followUp = record(input.followUp);
  const followUpAnimation = followUp.animation;
  const followUpDefinition = animationManifest.animations.find(({ name }) => name === followUpAnimation);
  const followUpSettings = (animationManifest.settings as Record<string, { impact?: unknown }>)[String(followUpAnimation)];
  if (typeof followUpAnimation !== "string" || followUpDefinition?.category !== "action" ||
      !followUpSettings?.impact) {
    throw new Error(`ANIMATIONS.json · ${field}.followUp.animation : clip d’action avec impact attendu.`);
  }
  const maxChain = animationNumber(input.maxChain, field + ".maxChain", 1, 6);
  if (!Number.isInteger(maxChain)) throw new Error(`ANIMATIONS.json · ${field}.maxChain : entier attendu.`);
  const inputBufferMs = animationNumber(input.inputBufferMs, field + ".inputBufferMs", 0, 500);
  const resetAfterMs = animationNumber(input.resetAfterMs, field + ".resetAfterMs", 0, 3000);
  const startProgress = animationNumber(followUp.startProgress, field + ".followUp.startProgress", 0, 1);
  const blendSeconds = animationNumber(followUp.blendSeconds, field + ".followUp.blendSeconds", 0, 0.5);
  const finalImpactUntil = impact.doubleHit ? Math.max(impact.until, impact.second.until) : impact.until;
  if (chainWindow.from < finalImpactUntil) {
    throw new Error(`ANIMATIONS.json · ${field}.chainWindow : la chaîne commence avant le dernier impact.`);
  }
  if (startProgress >= impact.from) {
    throw new Error(`ANIMATIONS.json · ${field}.followUp.startProgress : doit précéder le premier impact.`);
  }
  return {
    enabled: animationFlag(input.enabled, field + ".enabled"),
    maxChain, inputBufferMs, resetAfterMs, chainWindow,
    followUp: { animation: followUpAnimation, startProgress, blendSeconds },
  };
}

function comboSettings(value: unknown, defaults: AttackComboSettings, impact: AttackImpact): AttackComboSettings {
  const source = record(value);
  const chainWindow = windowSettings(source.chainWindow, defaults.chainWindow);
  const finalImpactUntil = impact.doubleHit ? Math.max(impact.until, impact.second.until) : impact.until;
  const followUp = record(source.followUp);
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : defaults.enabled,
    maxChain: Math.round(number(source.maxChain, defaults.maxChain, ANIMATION_RANGES.comboChain)),
    inputBufferMs: number(source.inputBufferMs, defaults.inputBufferMs, ANIMATION_RANGES.comboBuffer),
    resetAfterMs: number(source.resetAfterMs, defaults.resetAfterMs, ANIMATION_RANGES.comboReset),
    chainWindow: { from: Math.max(chainWindow.from, finalImpactUntil), until: Math.max(chainWindow.until, chainWindow.from, finalImpactUntil) },
    followUp: {
      animation: defaults.followUp.animation,
      startProgress: Math.min(number(followUp.startProgress, defaults.followUp.startProgress, ANIMATION_RANGES.progress), Math.max(0, impact.from - 0.01)),
      blendSeconds: number(followUp.blendSeconds, defaults.followUp.blendSeconds, ANIMATION_RANGES.blend),
    },
  };
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
    if (definition.cancel) {
      const cancel = record(value.cancel);
      settings.cancel = {};
      for (const key of CANCEL_KEYS) {
        if (definition.cancel[key] !== undefined) {
          settings.cancel[key] = number(cancel[key], definition.cancel[key]!, ANIMATION_RANGES.progress);
        }
      }
    }
    if (definition.blendOutSeconds !== undefined) {
      settings.blendOutSeconds = number(value.blendOutSeconds, definition.blendOutSeconds, ANIMATION_RANGES.blend);
    }
    if (definition.combo && settings.impact) {
      settings.combo = comboSettings(value.combo, definition.combo, settings.impact);
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

/** Imports only validated tuning values; metadata and asset paths remain version-controlled. */
export function parseAnimationManifest(value: unknown): {
  settings: AnimationSettings;
  transitions: TransitionSettings;
} {
  const input = record(value);
  if (!Array.isArray(input.animations)) {
    throw new Error("ANIMATIONS.json · animations : liste attendue.");
  }
  const expected = animationManifest.animations.map((animation) => animation.name);
  const received = input.animations.map((animation: unknown) => record(animation).name);
  if (received.length !== expected.length || received.some((name: unknown, index: number) => name !== expected[index])) {
    throw new Error("ANIMATIONS.json · clips incompatibles avec le héros actuel.");
  }
  if (!input.settings || typeof input.settings !== "object" || Array.isArray(input.settings)) {
    throw new Error("ANIMATIONS.json · settings : objet attendu.");
  }
  const imported = record(input.settings);
  const checkNumber = (value: unknown, field: string, min: number, max: number): void => {
    animationNumber(value, field, min, max);
  };
  const checkWindow = (value: unknown, field: string): void => {
    const window = record(value);
    const from = animationNumber(window.from, field + ".from", 0, 1);
    animationNumber(window.until, field + ".until", from, 1);
  };

  for (const definition of ANIMATION_DEFINITIONS) {
    const value = imported[definition.id];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`ANIMATIONS.json · settings.${definition.id} : objet attendu.`);
    }
    const entry = record(value);
    const field = "settings." + definition.id;
    checkNumber(entry.playbackSpeed, field + ".playbackSpeed",
      ANIMATION_RANGES.playback.min, ANIMATION_RANGES.playback.max);
    if (definition.movement) {
      const movement = record(entry.movement);
      checkNumber(movement.speed, field + ".movement.speed",
        ANIMATION_RANGES.movement.min, ANIMATION_RANGES.movement.max);
      animationFlag(movement.sync, field + ".movement.sync");
    }
    if (definition.dodge) {
      const dodge = record(entry.dodge);
      checkNumber(dodge.distance, field + ".dodge.distance",
        ANIMATION_RANGES.distance.min, ANIMATION_RANGES.distance.max);
      checkWindow(dodge.window, field + ".dodge.window");
    }
    if (definition.impact) {
      const impact = record(entry.impact);
      checkWindow(impact, field + ".impact");
      animationFlag(impact.doubleHit, field + ".impact.doubleHit");
      checkWindow(impact.second, field + ".impact.second");
    }
    if (entry.cancel !== undefined) {
      if (!definition.cancel || !entry.cancel || typeof entry.cancel !== "object" || Array.isArray(entry.cancel)) {
        throw new Error(`ANIMATIONS.json · ${field}.cancel : valeur incompatible.`);
      }
      const cancel = record(entry.cancel);
      for (const key of CANCEL_KEYS) {
        if (cancel[key] !== undefined) {
          if (definition.cancel[key] === undefined) throw new Error(`ANIMATIONS.json · ${field}.cancel.${key} : interruption non supportée.`);
          checkNumber(cancel[key], `${field}.cancel.${key}`, 0, 1);
        }
      }
    }
    if (entry.blendOutSeconds !== undefined) {
      if (definition.blendOutSeconds === undefined) {
        throw new Error(`ANIMATIONS.json · ${field}.blendOutSeconds : transition non supportée.`);
      }
      checkNumber(entry.blendOutSeconds, field + ".blendOutSeconds",
        ANIMATION_RANGES.blend.min, ANIMATION_RANGES.blend.max);
    }
    if (entry.combo !== undefined) {
      if (!definition.combo || !definition.impact) {
        throw new Error(`ANIMATIONS.json · ${field}.combo : non supporté.`);
      }
      const impact = record(entry.impact);
      const combo = validateComboSettings(entry.combo, {
        ...animationWindow(impact as Window, field + ".impact"),
        doubleHit: animationFlag(impact.doubleHit, field + ".impact.doubleHit"),
        second: animationWindow(impact.second as Window, field + ".impact.second"),
      }, field + ".combo");
      if (combo.followUp.animation !== definition.combo.followUp.animation) {
        throw new Error(`ANIMATIONS.json · ${field}.combo.followUp.animation : clip incompatible.`);
      }
    }
  }
  const transitionValues = record(input.transitions);
  for (const key of ["move", "idle", "slowDown"] as const) {
    checkNumber(transitionValues[key], "transitions." + key, 0.03, 1);
  }
  return {
    settings: createAnimationSettings(imported),
    transitions: createTransitionSettings(input.transitions),
  };
}
