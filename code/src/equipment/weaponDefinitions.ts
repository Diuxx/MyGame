export interface WeaponDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly slot: "mainHand";
  readonly icon: string;
  readonly model?: string;
  readonly stats: Readonly<{ attack: number }>;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Définition invalide : ${name}.`);
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, name: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`Statistique invalide : ${name}.`);
  }
  return value;
}

/** Data-only catalogue. Never give the renderer or equipment state a mutable definition. */
export function parseWeaponDefinitions(value: unknown): readonly WeaponDefinition[] {
  const catalog = record(value, "weapons");
  if (catalog.version !== 1 || !Array.isArray(catalog.weapons) || catalog.weapons.length === 0) {
    throw new Error("Catalogue d'armes ou version invalide.");
  }

  const ids = new Set<string>();
  const definitions = catalog.weapons.map((candidate: unknown) => {
    const entry = record(candidate, "weapon");
    const { id, name, type, slot, icon, model } = entry;
    if (typeof id !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(id) || ids.has(id)) {
      throw new Error(`Identifiant d'arme invalide ou dupliqué : ${String(id)}.`);
    }
    if (typeof name !== "string" || !name.trim() || name.length > 80 ||
        typeof type !== "string" || !/^[a-z][a-z0-9-]{0,39}$/.test(type) ||
        slot !== "mainHand") {
      throw new Error(`Métadonnées de l'arme ${id} invalides.`);
    }
    if (typeof icon !== "string" ||
        !/^\/assets\/weapons\/icons\/[a-z0-9-]+\.(?:webp|png|svg)$/.test(icon)) {
      throw new Error(`Icône invalide pour ${id}.`);
    }
    if (model !== undefined && (typeof model !== "string" ||
        !/^\/assets\/weapons\/models\/[a-z0-9-]+\.glb$/.test(model))) {
      throw new Error(`Modèle 3D invalide pour ${id}.`);
    }
    const stats = record(entry.stats, `stats de ${id}`);
    ids.add(id);
    return Object.freeze({
      id, name: name.trim(), type, slot, icon,
      ...(typeof model === "string" ? { model } : {}),
      stats: Object.freeze({ attack: integer(stats.attack, `${id}.attack`) }),
    }) as WeaponDefinition;
  });
  return Object.freeze(definitions);
}
