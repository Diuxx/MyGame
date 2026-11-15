import type { MapPosition } from "./types.ts";

export interface PrimitiveGround {
  color: string;
}

export interface MapPrimitive {
  id: string;
  kind: "box" | "cylinder" | "sphere";
  position: MapPosition;
  size: MapPosition;
  rotationY: number;
  color: string;
  blocksMovement: boolean;
}

export interface MapExit {
  id: string;
  label: string;
  position: MapPosition;
  triggerRadius: number;
  targetMap: string;
  targetSpawn: string;
  activation: "automatic" | "interact";
}

const IDENTIFIER = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const COLOR = /^#[a-f0-9]{6}$/i;

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(label + " : objet attendu.");
  }
  return value as Record<string, unknown>;
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw new Error(label + " : identifiant invalide.");
  }
  return value;
}

function color(value: unknown, label: string): string {
  if (typeof value !== "string" || !COLOR.test(value)) {
    throw new Error(label + " : couleur #RRGGBB attendue.");
  }
  return value;
}

function finite(value: unknown, label: string, min = -Infinity, max = Infinity): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(label + " : nombre invalide.");
  }
  return value;
}

function vector(value: unknown, label: string, positive = false): MapPosition {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(label + " : trois coordonnées attendues.");
  }
  return [
    finite(value[0], label + ".x", positive ? 0.01 : -Infinity),
    finite(value[1], label + ".y", positive ? 0.01 : -Infinity),
    finite(value[2], label + ".z", positive ? 0.01 : -Infinity),
  ];
}

export function parsePrimitiveGround(raw: unknown): PrimitiveGround | undefined {
  if (raw === undefined) return undefined;
  const input = asObject(raw, "terrain.primitiveGround");
  return { color: color(input.color, "terrain.primitiveGround.color") };
}

export function parseMapPrimitives(raw: unknown): MapPrimitive[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 256) {
    throw new Error("primitives : maximum 256 entrées.");
  }
  const ids = new Set<string>();
  return raw.map((value, index): MapPrimitive => {
    const name = "primitives[" + index + "]";
    const item = asObject(value, name);
    const primitiveId = id(item.id, name + ".id");
    if (ids.has(primitiveId)) throw new Error(name + " : identifiant dupliqué.");
    ids.add(primitiveId);
    if (item.kind !== "box" && item.kind !== "cylinder" && item.kind !== "sphere") {
      throw new Error(name + " : forme inconnue.");
    }
    if (typeof item.blocksMovement !== "boolean") {
      throw new Error(name + ".blocksMovement : booléen attendu.");
    }
    return {
      id: primitiveId,
      kind: item.kind,
      position: vector(item.position, name + ".position"),
      size: vector(item.size, name + ".size", true),
      rotationY: finite(item.rotationY ?? 0, name + ".rotationY"),
      color: color(item.color, name + ".color"),
      blocksMovement: item.blocksMovement,
    };
  });
}

export function parseMapExits(raw: unknown): MapExit[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 32) {
    throw new Error("exits : maximum 32 entrées.");
  }
  const ids = new Set<string>();
  return raw.map((value, index): MapExit => {
    const name = "exits[" + index + "]";
    const item = asObject(value, name);
    const exitId = id(item.id, name + ".id");
    if (ids.has(exitId)) throw new Error(name + " : identifiant dupliqué.");
    ids.add(exitId);
    if (item.activation !== "automatic" && item.activation !== "interact") {
      throw new Error(name + ".activation : automatic ou interact attendu.");
    }
    if (typeof item.label !== "string" || !item.label.trim() || item.label.length > 80) {
      throw new Error(name + ".label : texte invalide.");
    }
    return {
      id: exitId,
      label: item.label.trim(),
      position: vector(item.position, name + ".position"),
      triggerRadius: finite(item.triggerRadius, name + ".triggerRadius", 0.5, 10),
      targetMap: id(item.targetMap, name + ".targetMap"),
      targetSpawn: id(item.targetSpawn, name + ".targetSpawn"),
      activation: item.activation,
    };
  });
}
