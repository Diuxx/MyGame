export interface HeroCollisionSettings {
  enabled: boolean;
  showHero: boolean;
  showEnemyHurtboxes: boolean;
  showEnemyColliders: boolean;
  radius: number;
  height: number;
  offsetY: number;
}

export const DEFAULT_HERO_COLLISION: HeroCollisionSettings = {
  enabled: true,
  showHero: true,
  showEnemyHurtboxes: false,
  showEnemyColliders: false,
  radius: 0.4,
  height: 1.8,
  offsetY: 0.9,
};

const limits = {
  radius: [0.1, 2],
  height: [0.2, 4],
  offsetY: [-1, 4],
} as const;

/** Validate both values from DOM inputs and saved Playground preferences. */
export function parseHeroCollisionSettings(value: unknown): HeroCollisionSettings {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Réglages de collision manquants ou invalides.");
  }
  const input = value as Record<string, unknown>;
  for (const name of ["enabled", "showHero", "showEnemyHurtboxes", "showEnemyColliders"] as const) {
    if (typeof input[name] !== "boolean") throw new Error(`Option invalide : ${name}`);
  }
  for (const name of ["radius", "height", "offsetY"] as const) {
    const [min, max] = limits[name];
    const numericValue = input[name];
    if (typeof numericValue !== "number" || !Number.isFinite(numericValue) ||
        numericValue < min || numericValue > max) {
      throw new Error(`Valeur de ${name} invalide (entre ${min} et ${max}).`);
    }
  }
  return {
    enabled: input.enabled as boolean,
    showHero: input.showHero as boolean,
    showEnemyHurtboxes: input.showEnemyHurtboxes as boolean,
    showEnemyColliders: input.showEnemyColliders as boolean,
    radius: input.radius as number,
    height: input.height as number,
    offsetY: input.offsetY as number,
  };
}
