import type { SavedMapProgress } from "./mapEnemySimulation.ts";

export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const PREFIX = "mygame.map-progress.v1.";

export function readMapProgress(storage: ProgressStorage, mapId: string): SavedMapProgress {
  try {
    const encoded = storage.getItem(PREFIX + mapId);
    if (!encoded) return { defeatedIds: [], clearedWaveIds: [] };
    const input: unknown = JSON.parse(encoded);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Objet attendu.");
    const record = input as Record<string, unknown>;
    if (record.version !== 1 || !Array.isArray(record.defeatedIds) || !Array.isArray(record.clearedWaveIds) ||
        ![...record.defeatedIds, ...record.clearedWaveIds].every(
          (id) => typeof id === "string" && /^[a-z0-9_-]{1,80}$/i.test(id))) {
      throw new Error("Format de progression invalide.");
    }
    return { defeatedIds: [...record.defeatedIds], clearedWaveIds: [...record.clearedWaveIds] };
  } catch (error) {
    console.warn("Progression de map illisible :", mapId, error);
    return { defeatedIds: [], clearedWaveIds: [] };
  }
}

export function saveMapProgress(storage: ProgressStorage, mapId: string, state: SavedMapProgress): void {
  storage.setItem(PREFIX + mapId, JSON.stringify({ version: 1, ...state }));
}

export function clearMapProgress(storage: ProgressStorage, mapId: string): void {
  storage.removeItem(PREFIX + mapId);
}
