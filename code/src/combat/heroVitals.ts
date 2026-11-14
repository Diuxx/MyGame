/** Minimal hero health and respawn rules, independent of the renderer and input. */
export function createHeroVitals(maxHealth = 100, respawnDelay = 2) {
  if (!Number.isFinite(maxHealth) || maxHealth <= 0 ||
      !Number.isFinite(respawnDelay) || respawnDelay < 0) {
    throw new Error("Paramètres de vie du héros invalides.");
  }
  let health = maxHealth;
  let remaining = 0;
  let invulnerability = 0;
  return {
    get health() { return health; },
    get maxHealth() { return maxHealth; },
    get isAlive() { return health > 0; },
    get respawnRemaining() { return remaining; },
    hit(damage: number, dodging = false): boolean {
      if (!Number.isFinite(damage) || damage <= 0 || health <= 0 || dodging || invulnerability > 0) return false;
      health = Math.max(0, health - Math.max(1, Math.floor(damage)));
      if (health === 0) remaining = respawnDelay;
      return true;
    },
    update(seconds: number): boolean {
      if (!Number.isFinite(seconds) || seconds < 0) throw new Error("Delta de vie invalide.");
      if (health > 0) {
        invulnerability = Math.max(0, invulnerability - seconds);
        return false;
      }
      remaining -= seconds;
      if (remaining > 0) return false;
      health = maxHealth;
      remaining = 0;
      invulnerability = 1.5;
      return true;
    },
    reset(): void { health = maxHealth; remaining = 0; invulnerability = 0; },
  };
}
