/** JSON-only visual overrides; do not embed files or Babylon objects in map data. */
export interface VisualOverride {
  model?: string;
  texture?: string;
  tint?: string;
  scale?: number;
}
export type InteractionKind = "pickup" | "inspect" | "interact";
export interface WorldInteraction {
  id: string;
  kind: InteractionKind;
  label: string;
  position: readonly [number, number, number];
  range: number;
  itemId?: string;
}
const ID = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const FILE_PATH = /^\/assets\/(?!.*(?:\.\.|\/\/|\\|[?#]))[a-z0-9_./-]+$/i;
export function parseVisualOverride(raw: unknown): VisualOverride | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("visual : objet attendu.");
  const input = raw as Record<string, unknown>;
  const result: VisualOverride = {};
  if (input.model !== undefined) {
    if (typeof input.model !== "string" || !FILE_PATH.test(input.model) || !/\.glb$/i.test(input.model)) {
      throw new Error("visual.model : chemin GLB sous /assets/ attendu.");
    }
    result.model = input.model;
  }
  if (input.texture !== undefined) {
    if (typeof input.texture !== "string" || !FILE_PATH.test(input.texture) || !/\.(png|jpe?g|webp)$/i.test(input.texture)) {
      throw new Error("visual.texture : chemin d'image sous /assets/ attendu.");
    }
    result.texture = input.texture;
  }
  if (input.tint !== undefined) {
    if (typeof input.tint !== "string" || !/^#[0-9a-f]{6}$/i.test(input.tint)) {
      throw new Error("visual.tint : couleur #RRGGBB attendue.");
    }
    result.tint = input.tint;
  }
  if (input.scale !== undefined) {
    if (typeof input.scale !== "number" || !Number.isFinite(input.scale) || input.scale < 0.05 || input.scale > 10) {
      throw new Error("visual.scale : valeur entre 0.05 et 10 attendue.");
    }
    result.scale = input.scale;
  }
  return result;
}

export function parseWorldInteractions(raw: unknown): WorldInteraction[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 100) throw new Error("interactions : 100 entrées maximum.");
  const ids = new Set<string>();
  return raw.map((value, index): WorldInteraction => {
    const path = "interactions[" + index + "]";
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(path + " : objet attendu.");
    const item = value as Record<string, unknown>;
    if (typeof item.id !== "string" || !ID.test(item.id) || ids.has(item.id)) throw new Error(path + " : id invalide ou dupliqué.");
    ids.add(item.id);
    if (item.kind !== "pickup" && item.kind !== "inspect" && item.kind !== "interact") {
      throw new Error(path + " : type d'interaction inconnu.");
    }
    if (typeof item.label !== "string" || !item.label.trim() || item.label.length > 80) {
      throw new Error(path + " : label invalide.");
    }
    if (!Array.isArray(item.position) || item.position.length !== 3 ||
        !item.position.every((coord) => typeof coord === "number" && Number.isFinite(coord))) {
      throw new Error(path + " : position invalide.");
    }
    if (typeof item.range !== "number" || !Number.isFinite(item.range) || item.range <= 0 || item.range > 10) {
      throw new Error(path + " : distance d'interaction invalide.");
    }
    if (item.kind === "pickup" && (typeof item.itemId !== "string" || !ID.test(item.itemId))) {
      throw new Error(path + " : itemId attendu pour un ramassage.");
    }
    return {
      id: item.id, kind: item.kind, label: item.label,
      position: [item.position[0], item.position[1], item.position[2]],
      range: item.range, ...(item.kind === "pickup" ? { itemId: item.itemId as string } : {}),
    };
  });
}
