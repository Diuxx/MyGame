import assert from "node:assert/strict";
import test from "node:test";
import { createEditorCommands, groupEditorCommands } from "./editorCommands.ts";
import { copyPrefabs, pastePrefabs } from "./editorClipboard.ts";
import { resizeTerrain } from "./editorTerrain.ts";
import type { PrefabPlacement } from "../world/maps/prefabDefinitions.ts";
import type { MapDefinition } from "../world/maps/types.ts";

test("editor commands undo, redo and invalidate redo on new changes", async () => {
  let value = 0;
  const h = createEditorCommands(2);
  const increment = (amount: number) => ({
    label: "increase", run: () => { value += amount; }, undo: () => { value -= amount; },
  });
  await h.execute(increment(2));
  await h.execute(increment(3));
  assert.equal(value, 5);
  assert.equal(await h.undo(), true);
  assert.equal(value, 2);
  assert.equal(await h.redo(), true);
  assert.equal(value, 5);
  await h.undo();
  await h.execute(increment(7));
  assert.equal(value, 9);
  assert.equal(h.canRedo, false);
  await h.undo();
  await h.undo();
  assert.equal(value, 0);
  await h.redo();
  assert.equal(value, 2);
});

test("failed commands don't enter the history, groups roll back partial execution", async () => {
  const items: number[] = [];
  const add = (n: number) => ({
    label: "add", run: () => { items.push(n); }, undo: () => { items.pop(); },
  });
  const h = createEditorCommands();
  await assert.rejects(h.execute(groupEditorCommands("test", [
    add(1), { label: "fail", run: () => { throw new Error("bad"); }, undo: () => {} },
  ])), /bad/);
  assert.deepEqual(items, []);
  assert.equal(h.canUndo, false);
  await h.execute(groupEditorCommands("two", [add(1), add(2)]));
  assert.deepEqual(items, [1, 2]);
  await h.undo();
  assert.deepEqual(items, []);
});

test("clipboard preserves relative positions and creates unique independent copies", () => {
  const one: PrefabPlacement = { id: "wall", prefab: "wall-straight", position: [0, 2, 0], rotationY: 15, scale: 1 };
  const two: PrefabPlacement = { ...one, id: "wall-2", position: [4, 2, 2] };
  const source = [one, two];
  const clipboard = copyPrefabs(source);
  const result = pastePrefabs(clipboard, [10, 5, 10], new Set(["wall-copy-1"]));
  assert.deepEqual(result.map((item) => item.position), [[8,5,9], [12,5,11]]);
  assert.equal(result[0].id, "wall-copy-2");
  assert.equal(result[1].id, "wall-2-copy-1");
  result[0].position = [1,1,1];
  assert.deepEqual(source[0].position, [0,2,0]);
});

const map: MapDefinition = {
  version: 1, id: "test", name: "Test", tileSize: 2,
  terrain: { origin: [-4, 0, -4], tiles: Array.from({ length: 4 }, () => Array(4).fill(null)),
    groundCollider: { enabled: true, thickness: 0.2 }, primitiveGround: { color: "#FFFFFF" } },
  objects: [], spawnPoints: [{ id: "hero", type: "player", position: [0,0,0], rotationY: 0 }],
};
test("terrain resize validates centered growth and keeps existing data", () => {
  const grown = resizeTerrain(map, { width: 16, depth: 16 }, "center");
  assert.deepEqual(grown.origin, [-8, 0, -8]);
  assert.equal(grown.tiles.length, 8);
  assert.equal(grown.tiles[0].length, 8);
  assert.equal(map.terrain.tiles.length, 4);
  assert.throws(() => resizeTerrain(map, { width: 6, depth: 6 }, "center"), /cellules par paires/);
  assert.throws(() => resizeTerrain(map, { width: 11, depth: 12 }, "origin"), /multiple positif/);
  assert.throws(() => resizeTerrain(map, { width: 1024, depth: 1024 }, "origin"), /4096/);
});

test("terrain cannot shrink across a wall even if the wall pivot remains inside", async () => {
  const { parsePrefabCatalog } = await import("../world/maps/prefabDefinitions.ts");
  const { readFileSync } = await import("node:fs");
  const catalog = parsePrefabCatalog(JSON.parse(readFileSync(
    new URL("../../public/assets/definitions/blockout-prefabs.json", import.meta.url), "utf8")));
  const source: MapDefinition = structuredClone(map);
  source.prefabs = [{ id: "perimeter-wall", prefab: "wall-straight",
    position: [1,0,0], rotationY: 0, scale: 1 }];
  assert.throws(() => resizeTerrain(source, { width: 6, depth: 8 }, "origin", catalog),
    /dépasser un mur/);
  assert.equal(source.terrain.tiles[0].length, 4);
});
