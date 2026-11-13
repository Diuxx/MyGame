import type {
  MapAssets, MapCollider, MapDefinition, MapPosition, MapBounds,
} from "./types.ts";

const IDENTIFIER = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const MODEL_PATH = /^\/assets\/(?!.*(?:\.\.|\/\/|\\|[?#]))[a-z0-9_./-]+\.glb$/i;
const MAX_TILES = 4096;
const MAX_OBJECTS = 256;

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(label + " : objet JSON attendu.");
  }
  return value as Record<string, unknown>;
}

function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(label + " : tableau attendu.");
  return value as unknown[];
}

function finite(value: unknown, label: string, min = -Infinity, max = Infinity): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(label + " : valeur numérique invalide.");
  }
  return value;
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw new Error(label + " : identifiant invalide.");
  }
  return value;
}

function position(value: unknown, label: string): MapPosition {
  const values = list(value, label);
  if (values.length !== 3) throw new Error(label + " : trois coordonnées attendues.");
  return [
    finite(values[0], label + ".x"),
    finite(values[1], label + ".y"),
    finite(values[2], label + ".z"),
  ];
}

function modelPath(value: unknown, label: string): string {
  if (typeof value !== "string" || !MODEL_PATH.test(value)) {
    throw new Error(label + " : chemin GLB attendu sous /assets/.");
  }
  return value;
}

function collider(value: unknown, label: string): MapCollider {
  const shape = record(value, label);
  const local = position(shape.position, label + ".position");
  if (shape.type === "box") {
    const size = position(shape.size, label + ".size");
    for (const dimension of size) finite(dimension, label + ".size", 0.000001);
    return { type: "box", position: local, size };
  }
  if (shape.type === "cylinder") {
    return {
      type: "cylinder",
      position: local,
      radius: finite(shape.radius, label + ".radius", 0.000001),
      height: finite(shape.height, label + ".height", 0.000001),
    };
  }
  throw new Error(label + " : collider non pris en charge (box ou cylinder seulement).");
}

function versions(value: unknown, label: string): Record<string, unknown> {
  const item = record(value, label);
  if (item.version !== 1) throw new Error(label + " : version JSON non prise en charge (1 attendue).");
  return item;
}

export function validateMapAssets(value: unknown): MapAssets {
  const input = versions(value, "assets.json");
  const rawTiles = record(input.tiles, "tiles");
  const rawObjects = record(input.objects, "objects");
  if (!Object.keys(rawTiles).length) throw new Error("tiles : catalogue vide.");
  const tiles: MapAssets["tiles"] = {};
  const objects: MapAssets["objects"] = {};
  for (const [id, raw] of Object.entries(rawTiles)) {
    identifier(id, "tile");
    const item = record(raw, "tiles." + id);
    if (typeof item.walkable !== "boolean") throw new Error(id + " : walkable doit être un booléen.");
    tiles[id] = { model: modelPath(item.model, id), walkable: item.walkable };
  }
  for (const [id, raw] of Object.entries(rawObjects)) {
    identifier(id, "objet");
    const item = record(raw, "objects." + id);
    if (typeof item.blocksNavigation !== "boolean") {
      throw new Error(id + " : blocksNavigation doit être un booléen.");
    }
    const rawColliders = item.colliders === undefined ? [] : list(item.colliders, id + ".colliders");
    if (rawColliders.length > 16) throw new Error(id + " : trop de colliders (maximum 16).");
    objects[id] = {
      model: modelPath(item.model, id),
      blocksNavigation: item.blocksNavigation,
      colliders: rawColliders.map((shape, index) => collider(shape, id + ".colliders[" + index + "]")),
    };
  }
  return { version: 1, tiles, objects };
}

export function validateMapDefinition(value: unknown, assets: MapAssets): MapDefinition {
  const input = versions(value, "map.json");
  const id = identifier(input.id, "map.id");
  if (typeof input.name !== "string" || !input.name.trim()) throw new Error("map.name invalide.");
  const tileSize = finite(input.tileSize, "tileSize", 0.01, 100);
  const terrain = record(input.terrain, "terrain");
  const origin = position(terrain.origin, "terrain.origin");
  const rows = list(terrain.tiles, "terrain.tiles");
  if (!rows.length || rows.length > MAX_TILES) throw new Error("terrain : nombre de lignes invalide.");
  let columns = -1;
  let count = 0;
  const tiles = rows.map((raw, rowIndex) => {
    const line = list(raw, "terrain.tiles[" + rowIndex + "]");
    if (columns === -1) columns = line.length;
    if (!columns || line.length !== columns) throw new Error("terrain : grille non rectangulaire.");
    count += line.length;
    if (count > MAX_TILES) throw new Error("terrain : maximum " + MAX_TILES + " tiles.");
    return line.map((value, columnIndex) => {
      if (typeof value !== "string" || !Object.hasOwn(assets.tiles, value)) {
        throw new Error("Tile inconnue à [" + rowIndex + "][" + columnIndex + "] : " + String(value));
      }
      return value;
    });
  });

  const ground = record(terrain.groundCollider, "groundCollider");
  if (typeof ground.enabled !== "boolean") throw new Error("groundCollider.enabled invalide.");
  const thickness = finite(ground.thickness, "groundCollider.thickness", 0.000001, 100);

  const objectIds = new Set<string>();
  const rawObjects = list(input.objects, "objects");
  if (rawObjects.length > MAX_OBJECTS) throw new Error("Maximum " + MAX_OBJECTS + " objets.");
  const objects = rawObjects.map((raw, index) => {
    const item = record(raw, "objects[" + index + "]");
    const objectId = identifier(item.id, "objects[" + index + "].id");
    if (objectIds.has(objectId)) throw new Error("Objet dupliqué : " + objectId);
    objectIds.add(objectId);
    if (typeof item.asset !== "string" || !Object.hasOwn(assets.objects, item.asset)) {
      throw new Error("Asset d'objet inconnu : " + String(item.asset));
    }
    return {
      id: objectId,
      asset: item.asset,
      position: position(item.position, objectId + ".position"),
      rotationY: finite(item.rotationY, objectId + ".rotationY"),
    };
  });

  const rawSpawns = list(input.spawnPoints, "spawnPoints");
  const spawnIds = new Set<string>();
  const spawnPoints = rawSpawns.map((raw, index) => {
    const spawn = record(raw, "spawnPoints[" + index + "]");
    const spawnId = identifier(spawn.id, "spawn.id");
    if (spawnIds.has(spawnId)) throw new Error("Spawn dupliqué : " + spawnId);
    spawnIds.add(spawnId);
    if (spawn.type !== "player" && spawn.type !== "enemy") {
      throw new Error("Spawn " + spawnId + " : type invalide.");
    }
    return {
      id: spawnId,
      type: spawn.type,
      position: position(spawn.position, spawnId + ".position"),
      rotationY: finite(spawn.rotationY, spawnId + ".rotationY"),
    };
  });
  return {
    version: 1, id, name: input.name,
    tileSize, terrain: { origin, tiles, groundCollider: { enabled: ground.enabled, thickness } },
    objects, spawnPoints,
  };
}

export function tileCenter(map: MapDefinition, row: number, column: number): MapPosition {
  const origin = map.terrain.origin;
  return [
    origin[0] + (column + 0.5) * map.tileSize,
    origin[1],
    origin[2] + (row + 0.5) * map.tileSize,
  ];
}

export function terrainBounds(map: MapDefinition): MapBounds {
  const [x, , z] = map.terrain.origin;
  return {
    minX: x, maxX: x + map.terrain.tiles[0].length * map.tileSize,
    minZ: z, maxZ: z + map.terrain.tiles.length * map.tileSize,
  };
}
