import { validateMapAssets, validateMapDefinition } from "./validation";
import type { MapAssets, MapDefinition } from "./types";
import { loadEnemyDefinitions } from "../../enemies/enemyDefinitions";
import fieldEnemyDefinitions from "../../enemies/fieldEnemyDefinitions.json";

const MAPS = {
  dojo: "/assets/maps/dojo.json",
  forest: "/assets/maps/forest.json",
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

/** Validate all data and references before loading a single GLB. */
export async function loadMapData(id: MapId): Promise<{
  assets: MapAssets;
  map: MapDefinition;
  enemyCatalog: ReturnType<typeof loadEnemyDefinitions>;
}> {
  const [rawAssets, rawMap] = await Promise.all([
    fetchJson("/assets/definitions/assets.json"),
    fetchJson(MAPS[id]),
  ]);
  const assets = validateMapAssets(rawAssets);
  const enemyCatalog = loadEnemyDefinitions(fieldEnemyDefinitions);
  const map = validateMapDefinition(rawMap, assets, new Set(enemyCatalog.map((enemy) => enemy.id)));
  if (map.id !== id) throw new Error("Identifiant de map inattendu : " + map.id);
  return { assets, map, enemyCatalog };
}
