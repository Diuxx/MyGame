import { HERO_TUNING } from "./heroTuning.ts";

export interface TransitionSettings {
  move: number;
  idle: number;
  slowDown: number;
}

export function createTransitionSettings(value?: unknown): TransitionSettings {
  const input = value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const defaults = HERO_TUNING.transition;
  const read = (name: keyof TransitionSettings): number => {
    const setting = input[name];
    return typeof setting === "number" && Number.isFinite(setting)
      ? Math.max(0.03, Math.min(1, setting))
      : defaults[name];
  };
  return { move: read("move"), idle: read("idle"), slowDown: read("slowDown") };
}
