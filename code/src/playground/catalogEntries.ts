import type { MapAssets } from "../world/maps/types.ts";
import type { MapPlacementKind } from "../world/maps/editorSchema.ts";
import type { PrefabDefinition } from "../world/maps/prefabDefinitions.ts";
import type { EnemyDefinition } from "../enemies/enemyDefinitions.ts";

export const CATALOG_CATEGORIES = {
  architecture: "Architecture", furniture: "Mobilier", nature: "Nature",
  ground: "Sols et terrains", lighting: "Éclairage", enemy: "Ennemis",
  training: "Entraînement", effects: "Effets", decor: "Décors",
} as const;
export type CatalogCategory = keyof typeof CATALOG_CATEGORIES;
export type CatalogFilter = "all" | "prefabs" | CatalogCategory;
export type CatalogPreview = { model: string } | { prefab: PrefabDefinition };
export interface CatalogEntry {
  id: string;
  kind: MapPlacementKind;
  name: string;
  category: CatalogCategory;
  preview: CatalogPreview;
}

const objectCategories: Readonly<Partial<Record<string, CatalogCategory>>> = {
  wall: "architecture", building_l: "architecture", fantasy_stone_wall_lowpoly: "architecture",
  lantern: "lighting", fantasy_amber_lamp: "lighting",
  tree: "nature", boulder: "nature", flowers: "nature", fantasy_tree_blockout: "nature",
  fantasy_wooden_stool: "furniture", fog_bank: "effects",
};

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr")
    .replace(/[-_]/g, " ").trim();
}

function displayName(id: string, name?: string): string {
  const label = name?.trim() || id.replace(/[-_]/g, " ");
  return label.charAt(0).toLocaleUpperCase("fr") + label.slice(1);
}

export function catalogType(entry: CatalogEntry): string {
  if (entry.kind === "prefab") return "Bloc modulaire";
  if (entry.kind === "tile") return "Tuile de terrain";
  if (entry.kind === "enemy") return entry.category === "training" ? "Cible d’entraînement" : "Créature";
  return "Modèle 3D";
}

export function buildCatalogEntries(assets: MapAssets, enemies: readonly EnemyDefinition[]): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const [id, asset] of Object.entries(assets.prefabs ?? {})) {
    entries.push({ id, kind: "prefab", name: displayName(id, asset.name),
      category: id.startsWith("lamp-") ? "lighting" : asset.category, preview: { prefab: asset } });
  }
  for (const [id, asset] of Object.entries(assets.objects)) {
    const category = objectCategories[id] ?? (id.startsWith("nature_") ? "nature" : "decor");
    entries.push({ id, kind: "object", name: displayName(id, asset.name), category, preview: { model: asset.model } });
  }
  for (const [id, asset] of Object.entries(assets.tiles)) {
    entries.push({ id, kind: "tile", name: displayName(id, asset.name), category: "ground", preview: { model: asset.model } });
  }
  for (const enemy of enemies) {
    entries.push({ id: enemy.id, kind: "enemy", name: displayName(enemy.id, enemy.name),
      category: enemy.category === "static" ? "training" : "enemy", preview: { model: enemy.modelPath } });
  }
  const categoryOrder = Object.keys(CATALOG_CATEGORIES);
  return entries.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
    || a.name.localeCompare(b.name, "fr") || a.kind.localeCompare(b.kind));
}

export function matchesCatalogEntry(entry: CatalogEntry, filter: CatalogFilter, query: string): boolean {
  if (filter === "prefabs" && entry.kind !== "prefab") return false;
  if (filter !== "all" && filter !== "prefabs" && entry.category !== filter) return false;
  const haystack = normalizeSearch([entry.name, entry.id, CATALOG_CATEGORIES[entry.category], catalogType(entry)].join(" "));
  return normalizeSearch(query).split(/\s+/).every((term) => haystack.includes(term));
}
