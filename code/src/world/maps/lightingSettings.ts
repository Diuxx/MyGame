import type { EnvironmentSettings } from "./environmentSettings";
import type { MapPosition } from "./types";

/** Authored light configuration; no Babylon.js or editor dependencies. */
export type MapLightType = "point" | "spot" | "directional" | "hemispheric";
export interface LightShadows {
  enabled: boolean;
  darkness: number;
  resolution: 512 | 1024 | 2048;
}
export interface MapLight {
  id: string;
  type: MapLightType;
  enabled: boolean;
  position: MapPosition;
  direction: MapPosition;
  color: string;
  intensity: number;
  range: number;
  angle: number; // Spot cone in degrees.
  exponent: number;
  groundColor: string;
  shadows: LightShadows;
}
export interface LightingSettings {
  world: {
    enabled: boolean;
    ambient: { enabled: boolean; color: string; groundColor: string; intensity: number };
    sun: {
      enabled: boolean;
      color: string;
      intensity: number;
      direction: MapPosition;
      shadows: LightShadows;
    };
  };
  map: { enabled: boolean; lights: MapLight[] };
}

export const MAX_MAP_LIGHTS = 32;
const ID = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const HEX = /^#[0-9a-f]{6}$/i;

function object(raw: unknown, path: string): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(path + " : objet JSON attendu.");
  }
  return raw as Record<string, unknown>;
}
function flag(raw: unknown, fallback: boolean, path: string): boolean {
  if (raw === undefined) return fallback;
  if (typeof raw !== "boolean") throw new Error(path + " : booléen attendu.");
  return raw;
}
function number(raw: unknown, fallback: number, min: number, max: number, path: string): number {
  if (raw === undefined) return fallback;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < min || raw > max) {
    throw new Error(path + " : nombre attendu entre " + min + " et " + max + ".");
  }
  return raw;
}
function color(raw: unknown, fallback: string, path: string): string {
  if (raw === undefined) return fallback;
  if (typeof raw !== "string" || !HEX.test(raw)) throw new Error(path + " : couleur #RRGGBB attendue.");
  return raw;
}
function vector(raw: unknown, fallback: MapPosition, path: string, direction = false): MapPosition {
  if (raw === undefined) return [...fallback];
  if (!Array.isArray(raw) || raw.length !== 3) throw new Error(path + " : trois coordonnées attendues.");
  const result = raw.map((v, i) => number(v, 0, -10000, 10000, path + "[" + i + "]")) as number[];
  if (direction && Math.hypot(...result) < 0.001) throw new Error(path + " : direction non nulle attendue.");
  return [result[0], result[1], result[2]];
}
function shadows(raw: unknown, fallback: LightShadows, path: string): LightShadows {
  if (raw === undefined) return { ...fallback };
  const value = object(raw, path);
  const resolution = number(value.resolution, fallback.resolution, 512, 2048, path + ".resolution");
  if (resolution !== 512 && resolution !== 1024 && resolution !== 2048) {
    throw new Error(path + ".resolution : 512, 1024 ou 2048 attendu.");
  }
  return {
    enabled: flag(value.enabled, fallback.enabled, path + ".enabled"),
    darkness: number(value.darkness, fallback.darkness, 0, 1, path + ".darkness"),
    resolution,
  };
}

export function defaultLighting(environment: EnvironmentSettings): LightingSettings {
  return {
    world: {
      enabled: true,
      ambient: {
        enabled: true,
        color: environment.ambient.color,
        groundColor: "#333333",
        intensity: environment.ambient.intensity,
      },
      sun: {
        enabled: true,
        color: environment.sun.color,
        intensity: environment.sun.intensity,
        direction: [...environment.sun.direction],
        shadows: { ...environment.sun.shadows },
      },
    },
    map: { enabled: true, lights: [] },
  };
}

export function defaultMapLight(id: string, type: MapLightType = "point"): MapLight {
  return {
    id, type, enabled: true,
    position: [0, 2.5, 0], direction: [0, -1, 0],
    color: "#FFB368", intensity: 1.5, range: 8, angle: 45, exponent: 2,
    groundColor: "#333333",
    shadows: { enabled: false, darkness: 0.3, resolution: 512 },
  };
}

function parseMapLight(raw: unknown, index: number): MapLight {
  const path = "lighting.map.lights[" + index + "]";
  const value = object(raw, path);
  if (typeof value.id !== "string" || !ID.test(value.id)) {
    throw new Error(path + ".id : identifiant invalide.");
  }
  if (value.type !== "point" && value.type !== "spot" &&
    value.type !== "directional" && value.type !== "hemispheric") {
    throw new Error(path + ".type : type de lumière inconnu.");
  }
  const defaults = defaultMapLight(value.id, value.type);
  const result: MapLight = {
    ...defaults,
    enabled: flag(value.enabled, defaults.enabled, path + ".enabled"),
    position: vector(value.position, defaults.position, path + ".position"),
    direction: vector(value.direction, defaults.direction, path + ".direction", true),
    color: color(value.color, defaults.color, path + ".color"),
    intensity: number(value.intensity, defaults.intensity, 0, 20, path + ".intensity"),
    range: number(value.range, defaults.range, 0.1, 200, path + ".range"),
    angle: number(value.angle, defaults.angle, 5, 170, path + ".angle"),
    exponent: number(value.exponent, defaults.exponent, 0, 32, path + ".exponent"),
    groundColor: color(value.groundColor, defaults.groundColor, path + ".groundColor"),
    shadows: shadows(value.shadows, defaults.shadows, path + ".shadows"),
  };
  if (result.type === "hemispheric" && result.shadows.enabled) {
    throw new Error(path + " : HemisphericLight ne peut pas projeter d'ombres.");
  }
  return result;
}

/** Missing lighting is migrated from the existing environment without changing the look. */
export function parseLightingSettings(raw: unknown, environment: EnvironmentSettings): LightingSettings {
  const defaults = defaultLighting(environment);
  if (raw === undefined) return defaults;
  const data = object(raw, "lighting");
  const world = data.world === undefined ? {} : object(data.world, "lighting.world");
  const ambient = world.ambient === undefined ? {} : object(world.ambient, "lighting.world.ambient");
  const sun = world.sun === undefined ? {} : object(world.sun, "lighting.world.sun");
  const map = data.map === undefined ? {} : object(data.map, "lighting.map");
  if (map.lights !== undefined && !Array.isArray(map.lights)) {
    throw new Error("lighting.map.lights : tableau attendu.");
  }
  const lights = (map.lights ?? []) as unknown[];
  if (lights.length > MAX_MAP_LIGHTS) throw new Error("lighting.map.lights : maximum 32 lumières.");
  const parsedLights = lights.map(parseMapLight);
  const ids = new Set(parsedLights.map((light) => light.id));
  if (ids.size !== parsedLights.length) throw new Error("lighting.map.lights : identifiants dupliqués.");

  return {
    world: {
      enabled: flag(world.enabled, true, "lighting.world.enabled"),
      ambient: {
        enabled: flag(ambient.enabled, true, "lighting.world.ambient.enabled"),
        color: color(ambient.color, defaults.world.ambient.color, "lighting.world.ambient.color"),
        groundColor: color(ambient.groundColor, defaults.world.ambient.groundColor,
          "lighting.world.ambient.groundColor"),
        intensity: number(ambient.intensity, defaults.world.ambient.intensity, 0, 3,
          "lighting.world.ambient.intensity"),
      },
      sun: {
        enabled: flag(sun.enabled, true, "lighting.world.sun.enabled"),
        color: color(sun.color, defaults.world.sun.color, "lighting.world.sun.color"),
        intensity: number(sun.intensity, defaults.world.sun.intensity, 0, 4,
          "lighting.world.sun.intensity"),
        direction: vector(sun.direction, defaults.world.sun.direction, "lighting.world.sun.direction", true),
        shadows: shadows(sun.shadows, defaults.world.sun.shadows, "lighting.world.sun.shadows"),
      },
    },
    map: {
      enabled: flag(map.enabled, true, "lighting.map.enabled"),
      lights: parsedLights,
    },
  };
}
