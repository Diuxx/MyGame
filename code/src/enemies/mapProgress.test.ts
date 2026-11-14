import test from "node:test";
import assert from "node:assert/strict";
import { readMapProgress, saveMapProgress, clearMapProgress } from "./mapProgress.ts";

test("persist and reset boss deaths / completed waves by map", () => {
  const data = new Map<string, string>();
  const store = { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); } };
  const record = { defeatedIds: ["boss"], clearedWaveIds: ["intro"] };
  saveMapProgress(store, "dojo", record);
  assert.deepEqual(readMapProgress(store, "dojo"), record);
  assert.deepEqual(readMapProgress(store, "forest"), { defeatedIds: [], clearedWaveIds: [] });
  clearMapProgress(store, "dojo");
  assert.deepEqual(readMapProgress(store, "dojo"), { defeatedIds: [], clearedWaveIds: [] });
});
