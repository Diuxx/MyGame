import { mapEnemyCatalogPath, validateMapAssets, validateMapDefinition } from "./validation.ts";
import type { MapAssets, MapDefinition } from "./types";
import { loadEnemyDefinitions } from "../../enemies/enemyDefinitions.ts";
import { parsePrefabCatalog } from "./prefabDefinitions.ts";

const MAPS = {
  playground: "/assets/maps/playground.json",
  dojo: "/assets/maps/dojo.json",
  forest: "/assets/maps/forest.json",
  "prototype-forest": "/assets/maps/prototype-forest.json",
  "prototype-arena": "/assets/maps/prototype-arena.json",
  "nature-showcase": "/assets/maps/nature-showcase.json",
  "prototype-inn": "/assets/maps/prototype-inn.json",
} as const;
export type MapId = keyof typeof MAPS;
export const AVAILABLE_MAPS: readonly MapId[] = Object.keys(MAPS) as MapId[];

async function fetchJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new Error("Connexion impossible pour " + url, { cause });
  }
  if (!response.ok) throw new Error("Fichier " + url + " inaccessible (HTTP " + response.status + ").");
  try {
    return await response.json() as unknown;
  } catch (cause) {
    throw new Error("JSON illisible : " + url, { cause });
  }
}

export function isMapId(value: string): value is MapId {
  return Object.hasOwn(MAPS, value);
}

let defaultCatalog: Promise<ReturnType<typeof parseAssetCatalog>> | undefined;
let reusablePrefabs: Promise<ReturnType<typeof parsePrefabCatalog>> | undefined;

/** All maps can place blockout prefabs, even when they contain no instances yet. */
function loadReusablePrefabs() {
  reusablePrefabs ??= fetchJson("/assets/definitions/blockout-prefabs.json")
    .then(parsePrefabCatalog)
    .catch((error: unknown) => {
      reusablePrefabs = undefined;
      throw error;
    });
  return reusablePrefabs;
}

export function parseAssetCatalog(raw: unknown) {
  const assets = validateMapAssets(raw);
  const enemyCatalog = loadEnemyDefinitions((raw as { enemies?: unknown }).enemies);
  return { assets, enemyCatalog };
}

export function loadAssetCatalog() {
  defaultCatalog ??= fetchJson("/assets/definitions/assets.json").then(parseAssetCatalog).catch((error: unknown) => {
    defaultCatalog = undefined;
    throw error;
  });
  return defaultCatalog;
}

/** Validate all data and references before loading a single GLB. */
export async function loadMapData(id: MapId): Promise<{
  assets: MapAssets;
  map: MapDefinition;
  enemyCatalog: ReturnType<typeof loadEnemyDefinitions>;
}> {
  const [{ assets, enemyCatalog: defaults }, rawMap, prefabs] = await Promise.all([
    loadAssetCatalog(),
    fetchJson(MAPS[id]),
    loadReusablePrefabs(),
  ]);
  const path = mapEnemyCatalogPath(rawMap);
  const overrides = path ? loadEnemyDefinitions(await fetchJson(path)) : [];
  const enemyCatalog = [...new Map([...defaults, ...overrides].map((enemy) => [enemy.id, enemy])).values()];
  const withPrefabs = { ...assets, prefabs };
  const map = validateMapDefinition(rawMap, withPrefabs, new Set(enemyCatalog.map((enemy) => enemy.id)));
  if (map.id !== id) throw new Error("Identifiant de map inattendu : " + map.id);
  return { assets: withPrefabs, map, enemyCatalog };
}
