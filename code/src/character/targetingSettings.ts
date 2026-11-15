import manifest from "../../TARGETING.json" with { type: "json" };

export interface TargetingSettings {
  version: 1;
  enabled: boolean;
  acquireRadius: number;
  releaseRadius: number;
  turnSpeed: number;
  movementReference: "camera" | "target";
  showTargetRing: boolean;
  showDebugRadius: boolean;
}

export const TARGETING_SETTINGS_KEY = "mon-rpg.playground.target-lock.v1";
export const TARGETING_RANGES = {
  acquireRadius: { min: 2, max: 20, step: 0.5 },
  releaseRadius: { min: 2, max: 25, step: 0.5 },
  turnSpeed: { min: 2, max: 25, step: 1 },
} as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function checkedNumber(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`TARGETING.json · ${field} : nombre hors limites.`);
  }
  return value;
}
function checkedBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`TARGETING.json · ${field} : booléen attendu.`);
  return value;
}
/** Strictly validate the committed or imported manifest. */
export function parseTargetingManifest(value: unknown): TargetingSettings {
  const input = record(value);
  if (input.version !== 1) throw new Error("TARGETING.json · version incompatible.");
  if (input.movementReference !== "camera" && input.movementReference !== "target") {
    throw new Error("TARGETING.json · movementReference : camera ou target attendu.");
  }
  const acquireRadius = checkedNumber(input.acquireRadius, "acquireRadius", 2, 20);
  const releaseRadius = checkedNumber(input.releaseRadius, "releaseRadius", 2, 25);
  if (releaseRadius < acquireRadius) {
    throw new Error("TARGETING.json · releaseRadius doit être supérieur ou égal à acquireRadius.");
  }
  return {
    version: 1,
    enabled: checkedBoolean(input.enabled, "enabled"),
    acquireRadius, releaseRadius,
    turnSpeed: checkedNumber(input.turnSpeed, "turnSpeed", 2, 25),
    movementReference: input.movementReference,
    showTargetRing: checkedBoolean(input.showTargetRing, "showTargetRing"),
    showDebugRadius: checkedBoolean(input.showDebugRadius, "showDebugRadius"),
  };
}

const DEFAULTS = parseTargetingManifest(manifest);
function number(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value)) : fallback;
}
/** Forgiving for temporary UI overrides; versioned JSON remains the source of truth. */
export function createTargetingSettings(saved?: unknown): TargetingSettings {
  const value = record(saved);
  const acquireRadius = number(value.acquireRadius, DEFAULTS.acquireRadius, 2, 20);
  const releaseRadius = Math.max(acquireRadius, number(value.releaseRadius, DEFAULTS.releaseRadius, 2, 25));
  return {
    version: 1,
    enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULTS.enabled,
    acquireRadius, releaseRadius,
    turnSpeed: number(value.turnSpeed, DEFAULTS.turnSpeed, 2, 25),
    movementReference: value.movementReference === "camera" || value.movementReference === "target"
      ? value.movementReference : DEFAULTS.movementReference,
    showTargetRing: typeof value.showTargetRing === "boolean" ? value.showTargetRing : DEFAULTS.showTargetRing,
    showDebugRadius: typeof value.showDebugRadius === "boolean" ? value.showDebugRadius : DEFAULTS.showDebugRadius,
  };
}

export function serializeTargetingManifest(value: TargetingSettings): string {
  return JSON.stringify(parseTargetingManifest(value), null, 2) + "\n";
}
