import type { MapCollider, MapPosition } from "./types.ts";

export type PrefabCategory = "architecture" | "furniture";
export type PrefabPartKind = "box" | "cylinder" | "sphere";

export interface PrefabPart {
  kind: PrefabPartKind;
  position: MapPosition;
  size: MapPosition;
  rotationY: number;
}

export interface PrefabDefinition {
  name: string;
  category: PrefabCategory;
  parts: PrefabPart[];
  colliders: MapCollider[];
}

export type PrefabCatalog = Record<string, PrefabDefinition>;

export interface PrefabPlacement {
  id: string;
  prefab: string;
  position: MapPosition;
  rotationY: number;
  scale: number;
  scaleAxes?: MapPosition;
  layer?: string;
}

const IDENTIFIER = /^[a-z0-9][a-z0-9_-]{0,79}$/i;

function record(raw: unknown, path: string): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(path + " : objet attendu.");
  }
  return raw as Record<string, unknown>;
}

function list(raw: unknown, path: string, maximum: number): unknown[] {
  if (!Array.isArray(raw) || raw.length > maximum) {
    throw new Error(path + " : tableau de " + maximum + " éléments maximum attendu.");
  }
  return raw;
}

function number(raw: unknown, path: string, minimum = -Infinity, maximum = Infinity): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < minimum || raw > maximum) {
    throw new Error(path + " : nombre invalide.");
  }
  return raw;
}

function identifier(raw: unknown, path: string): string {
  if (typeof raw !== "string" || !IDENTIFIER.test(raw)) {
    throw new Error(path + " : identifiant invalide.");
  }
  return raw;
}

function vector(raw: unknown, path: string, minimum = -Infinity): MapPosition {
  if (!Array.isArray(raw) || raw.length !== 3) {
    throw new Error(path + " : trois coordonnées attendues.");
  }
  return [
    number(raw[0], path + ".x", minimum),
    number(raw[1], path + ".y", minimum),
    number(raw[2], path + ".z", minimum),
  ];
}

function parsePart(raw: unknown, path: string): PrefabPart {
  const shape = record(raw, path);
  if (shape.kind !== "box" && shape.kind !== "cylinder" && shape.kind !== "sphere") {
    throw new Error(path + ".kind : forme inconnue.");
  }
  return {
    kind: shape.kind,
    position: vector(shape.position, path + ".position"),
    size: vector(shape.size, path + ".size", 0.01),
    rotationY: number(shape.rotationY ?? 0, path + ".rotationY"),
  };
}

function parseCollider(raw: unknown, path: string): MapCollider {
  const input = record(raw, path);
  const position = vector(input.position, path + ".position");
  if (input.type === "box") {
    return { type: "box", position, size: vector(input.size, path + ".size", 0.01) };
  }
  if (input.type === "cylinder") {
    return {
      type: "cylinder", position,
      radius: number(input.radius, path + ".radius", 0.01),
      height: number(input.height, path + ".height", 0.01),
    };
  }
  throw new Error(path + ".type : box ou cylinder attendu.");
}

export function parsePrefabCatalog(raw: unknown): PrefabCatalog {
  const input = record(raw, "blockout-prefabs.json");
  if (input.version !== 1) throw new Error("blockout-prefabs.json : version 1 attendue.");
  const items = record(input.prefabs, "prefabs");
  if (!Object.keys(items).length || Object.keys(items).length > 64) {
    throw new Error("prefabs : entre 1 et 64 définitions attendues.");
  }
  const result: PrefabCatalog = Object.create(null) as PrefabCatalog;
  for (const [id, rawPrefab] of Object.entries(items)) {
    identifier(id, "prefab.id");
    const prefab = record(rawPrefab, "prefabs." + id);
    if (typeof prefab.name !== "string" || !prefab.name.trim() || prefab.name.length > 80) {
      throw new Error(id + ".name : nom invalide.");
    }
    if (prefab.category !== "architecture" && prefab.category !== "furniture") {
      throw new Error(id + ".category : catégorie inconnue.");
    }
    const parts = list(prefab.parts, id + ".parts", 24)
      .map((value, index) => parsePart(value, id + ".parts[" + index + "]"));
    if (!parts.length) throw new Error(id + " : au moins une forme requise.");
    const colliders = list(prefab.colliders, id + ".colliders", 12)
      .map((value, index) => parseCollider(value, id + ".colliders[" + index + "]"));
    result[id] = {
      name: prefab.name.trim(),
      category: prefab.category,
      parts,
      colliders,
    };
  }
  return result;
}

export function parsePrefabPlacements(raw: unknown, catalog?: PrefabCatalog): PrefabPlacement[] {
  if (raw === undefined) return [];
  const instances = list(raw, "map.prefabs", 256);
  if (instances.length && !catalog) throw new Error("map.prefabs : catalogue non chargé.");
  const used = new Set<string>();
  return instances.map((rawItem, index) => {
    const path = "map.prefabs[" + index + "]";
    const item = record(rawItem, path);
    const id = identifier(item.id, path + ".id");
    if (used.has(id)) throw new Error(path + " : identifiant dupliqué.");
    used.add(id);
    const prefab = identifier(item.prefab, path + ".prefab");
    if (!catalog || !Object.hasOwn(catalog, prefab)) {
      throw new Error(path + " : prefab inconnu : " + prefab);
    }
    return {
      id, prefab,
      position: vector(item.position, path + ".position"),
      rotationY: number(item.rotationY ?? 0, path + ".rotationY"),
      scale: number(item.scale ?? 1, path + ".scale", 0.25, 4),
      ...(item.scaleAxes === undefined ? {} : {
        scaleAxes: vector(item.scaleAxes, path + ".scaleAxes", 0.1),
      }),
      ...(item.layer === undefined ? {} : { layer: identifier(item.layer, path + ".layer") }),
    };
  });
}

/** Pure geometry shared by collisions and the level editor. */
export function rotateLocal(x: number, z: number, radians: number): { x: number; z: number } {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: x * cos + z * sin, z: z * cos - x * sin };
}
