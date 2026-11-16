import type { MapDefinition } from "../world/maps/types.ts";

export interface EditorDraft {
  schema: 1;
  mapId: string;
  sourceFingerprint: string;
  content: MapDefinition;
}

const PREFIX = "mygame.world-editor.draft.v1.";
function fingerprint(source: MapDefinition): string {
  const json = JSON.stringify(source);
  let hash = 2166136261;
  for (let i = 0; i < json.length; i++) {
    hash = Math.imul(hash ^ json.charCodeAt(i), 16777619);
  }
  return (hash >>> 0).toString(16) + ":" + json.length;
}

/** Storage is injected so failures and quota limitations remain explicit and testable. */
export function createEditorDrafts(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">) {
  const key = (mapId: string) => PREFIX + mapId;
  return {
    fingerprint,
    save(source: MapDefinition, originalFingerprint: string): void {
      const draft: EditorDraft = {
        schema: 1, mapId: source.id, sourceFingerprint: originalFingerprint,
        content: structuredClone(source),
      };
      storage.setItem(key(source.id), JSON.stringify(draft));
    },
    read(source: MapDefinition): MapDefinition | undefined {
      const raw = storage.getItem(key(source.id));
      if (!raw) return undefined;
      const item: unknown = JSON.parse(raw);
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("Brouillon local invalide.");
      }
      const draft = item as Partial<EditorDraft>;
      if (draft.schema !== 1 || draft.mapId !== source.id || !draft.content ||
          draft.sourceFingerprint !== fingerprint(source)) {
        throw new Error("Ce brouillon ne correspond plus à la version de la map chargée.");
      }
      return structuredClone(draft.content);
    },
    remove(mapId: string): void { storage.removeItem(key(mapId)); },
  };
}
