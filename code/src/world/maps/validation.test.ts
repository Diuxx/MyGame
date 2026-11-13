import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { terrainBounds, tileCenter, validateMapAssets, validateMapDefinition } from "./validation.ts";

const load = (path: string): unknown => JSON.parse(readFileSync(
  new URL("../../../public/assets/" + path, import.meta.url), "utf8"));

const assets = validateMapAssets(load("definitions/assets.json"));
const dojo = validateMapDefinition(load("maps/dojo.json"), assets);

test("example maps and composite collider assets validate", () => {
  assert.equal(dojo.terrain.tiles.length, 8);
  assert.equal(dojo.terrain.tiles[0].length, 8);
  assert.equal(assets.objects.building_l.colliders.length, 2);
  assert.equal(validateMapDefinition(load("maps/forest.json"), assets).id, "forest");
});

test("tile centers use corner origin and column X / row Z", () => {
  assert.deepEqual(tileCenter(dojo, 0, 0), [1, 0, 1]);
  assert.deepEqual(tileCenter(dojo, 2, 3), [7, 0, 5]);
  assert.deepEqual(terrainBounds(dojo), { minX: 0, maxX: 16, minZ: 0, maxZ: 16 });
  assert.deepEqual(dojo.objects[0].position, [3, 0, 0]);
});

test("unknown assets, non-rectangular grids and bad versions are rejected", () => {
  const raw = load("maps/dojo.json") as Record<string, any>;
  assert.throws(() => validateMapDefinition({ ...raw, version: 2 }, assets), /version/);
  const terrain = raw.terrain;
  assert.throws(() => validateMapDefinition({ ...raw, terrain: { ...terrain, tiles: [["wood"], ["wood", "stone"]] } }, assets), /rectangulaire/);
  assert.throws(() => validateMapDefinition({ ...raw, terrain: { ...terrain, tiles: [["missing"]] } }, assets), /inconnue/);
  assert.throws(() => validateMapDefinition({ ...raw, tileSize: 0 }, assets), /tileSize/);
  assert.throws(() => validateMapDefinition({ ...raw, objects: [{ ...raw.objects[0], asset: "unknown" }] }, assets), /inconnu/);
});

test("duplicate object and spawn identifiers are rejected", () => {
  const raw = load("maps/dojo.json") as Record<string, any>;
  assert.throws(() => validateMapDefinition({ ...raw, objects: [raw.objects[0], raw.objects[0]] }, assets), /dupliqué/);
  assert.throws(() => validateMapDefinition({ ...raw, spawnPoints: [raw.spawnPoints[0], raw.spawnPoints[0]] }, assets), /dupliqué/);
});

test("composite collider dimensions and coordinates must be valid", () => {
  const raw = load("definitions/assets.json") as Record<string, any>;
  const wall = raw.objects.wall;
  const mutated = { ...raw, objects: { ...raw.objects, wall: { ...wall,
    colliders: [{ type: "box", position: [0, 0, 0], size: [2, -3, 0.3] }] } } };
  assert.throws(() => validateMapAssets(mutated), /size/);
  mutated.objects.wall.colliders = [{ type: "capsule", position: [0, 1, 0], radius: 0.5, height: 1 }];
  assert.throws(() => validateMapAssets(mutated), /non pris en charge/);
  mutated.objects.wall.colliders = [{ type: "cylinder", position: [0, null, 0], radius: 0.5, height: 1 }];
  assert.throws(() => validateMapAssets(mutated), /position/);
});
