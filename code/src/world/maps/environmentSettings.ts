/** Map-authored environment, independent of rendering library. */
export interface EnvironmentSettings {
  background: string;
  ambient: { color: string; intensity: number };
  sun: {
    color: string; intensity: number; direction: readonly [number, number, number];
    shadows: { enabled: boolean; darkness: number; resolution: 512 | 1024 | 2048 };
  };
  fog: { enabled: boolean; color: string; density: number };
}

export const DEFAULT_ENVIRONMENT: EnvironmentSettings = {
  background: "#B9C9C5",
  ambient: { color: "#DAE2EA", intensity: 0.7 },
  sun: {
    color: "#FFF0D6", intensity: 0.8, direction: [-0.7, -1.4, 0.5],
    shadows: { enabled: true, darkness: 0.28, resolution: 1024 },
  },
  fog: { enabled: false, color: "#B9C9C5", density: 0.005 },
};

function object(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(name + " : objet attendu.");
  }
  return value as Record<string, unknown>;
}

function color(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^#[\da-f]{6}$/i.test(value)) {
    throw new Error(name + " : couleur #RRGGBB attendue.");
  }
  return value;
}

function bounded(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(name + " : valeur attendue entre " + min + " et " + max + ".");
  }
  return value;
}

function boolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new Error(name + " : booléen attendu.");
  return value;
}

export function parseEnvironmentSettings(value: unknown): EnvironmentSettings {
  if (value === undefined) return structuredClone(DEFAULT_ENVIRONMENT);
  const data = object(value, "environment");
  const ambient = object(data.ambient, "environment.ambient");
  const sun = object(data.sun, "environment.sun");
  const shadows = object(sun.shadows, "environment.sun.shadows");
  const fog = object(data.fog, "environment.fog");
  if (!Array.isArray(sun.direction) || sun.direction.length !== 3) {
    throw new Error("environment.sun.direction : trois coordonnées attendues.");
  }
  const direction: [number, number, number] = [
    bounded(sun.direction[0], "sun.direction.x", -10, 10),
    bounded(sun.direction[1], "sun.direction.y", -10, -0.01),
    bounded(sun.direction[2], "sun.direction.z", -10, 10),
  ];
  if (Math.hypot(...direction) < 0.01) throw new Error("sun.direction doit être non nulle.");
  const resolution = shadows.resolution;
  if (resolution !== 512 && resolution !== 1024 && resolution !== 2048) {
    throw new Error("sun.shadows.resolution : 512, 1024 ou 2048 attendu.");
  }
  return {
    background: color(data.background, "environment.background"),
    ambient: {
      color: color(ambient.color, "environment.ambient.color"),
      intensity: bounded(ambient.intensity, "ambient.intensity", 0, 3),
    },
    sun: {
      color: color(sun.color, "environment.sun.color"),
      intensity: bounded(sun.intensity, "sun.intensity", 0, 4),
      direction,
      shadows: {
        enabled: boolean(shadows.enabled, "shadows.enabled"),
        darkness: bounded(shadows.darkness, "shadows.darkness", 0, 1),
        resolution,
      },
    },
    fog: {
      enabled: boolean(fog.enabled, "fog.enabled"),
      color: color(fog.color, "fog.color"),
      density: bounded(fog.density, "fog.density", 0, 0.1),
    },
  };
}
