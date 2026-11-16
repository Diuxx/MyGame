import assert from "node:assert/strict";
import test from "node:test";
import { createEditorDrafts } from "./editorDrafts.ts";
import { createEditorLayers, defaultLayerForObject, defaultLayerForPrefab } from "./editorLayers.ts";
import { angleSnap, gridSnap } from "./editorSnapping.ts";
import type { MapDefinition } from "../world/maps/types.ts";

const source: MapDefinition = {
  version: 1, id: "zone", name: "Test", tileSize: 2,
  terrain: { origin: [0,0,0], tiles: [[null]], groundCollider: { enabled: false, thickness: 0.1 } },
  objects: [], prefabs: [], spawnPoints: [{ id: "hero", type: "player", position: [0,0,0], rotationY: 0 }],
};

test("drafts are manually restorable only for the exact authored base map", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  const drafts = createEditorDrafts(storage);
  assert.equal(drafts.read(source), undefined);
  const edited = structuredClone(source);
  edited.name = "Changed";
  drafts.save(edited, drafts.fingerprint(source));
  const found = drafts.read(source)!;
  assert.equal(found.name, "Changed");
  found.name = "Mutated";
  assert.equal(drafts.read(source)?.name, "Changed");
  assert.throws(() => drafts.read({ ...source, name: "new upstream version" }), /ne correspond plus/);
  drafts.remove(source.id);
  assert.equal(drafts.read(source), undefined);
});

test("layers distinguish editor locks from physical position", () => {
  const layers = createEditorLayers();
  assert.equal(layers.canSelect("architecture"), true);
  layers.update("architecture", { locked: true });
  assert.equal(layers.canSelect("architecture"), false);
  layers.update("architecture", { locked: false, visible: false });
  assert.equal(layers.canSelect("architecture"), false);
  layers.ensure("custom");
  assert.equal(layers.canSelect("custom"), true);
  layers.clearCustom();
  assert.equal(layers.all().some(({ id }) => id === "custom"), false);
  assert.equal(defaultLayerForObject({ id: "a", asset: "b", position: [0,0,0], rotationY: 0 }), "decoration");
  assert.equal(defaultLayerForPrefab({ id: "a", prefab: "wall", position: [0,0,0], rotationY: 0, scale: 1 },
    { wall: { name: "Wall", category: "architecture", parts: [], colliders: [] } }), "architecture");
});

test("grid and angle increments are deterministic and reject invalid sizes", () => {
  assert.equal(gridSnap(1.26, 0.5), 1.5);
  assert.equal(angleSnap(47, 15), 45);
  assert.throws(() => gridSnap(1, 0), /invalide/);
});

test("editor layer settings remain independent of spatial height", () => {
  const layers = createEditorLayers();
  layers.update("architecture", { visible: false, locked: true });
  const values = layers.all().find((item) => item.id === "architecture");
  assert.deepEqual(values, { id: "architecture", visible: false, locked: true });
  assert.equal(source.spawnPoints[0].position[1], 0);
});
