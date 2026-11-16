import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadMapData, parseAssetCatalog } from "./dataLoader.ts";
import { parsePrefabCatalog } from "./prefabDefinitions.ts";
import { findTerrainCell, terrainBounds, tileCenter, validateMapAssets, validateMapDefinition } from "./validation.ts";
import { createNavigationData } from "./navigationData.ts";

const load = (path: string): unknown => JSON.parse(readFileSync(
  new URL("../../../public/assets/" + path, import.meta.url), "utf8"));

const assets = {
  ...validateMapAssets(load("definitions/assets.json")),
  prefabs: parsePrefabCatalog(load("definitions/blockout-prefabs.json")),
};
const dojo = validateMapDefinition(load("maps/dojo.json"), assets);

test("example maps and composite collider assets validate", () => {
  assert.equal(dojo.terrain.tiles.length, 8);
  assert.equal(dojo.terrain.tiles[0].length, 8);
  assert.equal(assets.objects.building_l.colliders.length, 2);
  assert.equal(validateMapDefinition(load("maps/forest.json"), assets).id, "forest");
  assert.equal(dojo.lighting?.world.enabled, true);
  assert.equal(validateMapDefinition(load("maps/playground.json"), assets).lighting?.map.lights.length, 5);
});

test("nature showcase accepts textured glTF assets without changing existing maps", () => {
  const showcase = validateMapDefinition(load("maps/nature-showcase.json"), assets);
  assert.equal(showcase.id, "nature-showcase");
  assert.equal(showcase.terrain.primitiveGround?.pattern, "nature");
  assert.ok(showcase.objects.length > 80);
  assert.ok(showcase.objects.every(({ asset }) => assets.objects[asset].model.endsWith(".gltf")));
  assert.ok(showcase.spawnPoints.some(({ type }) => type === "player"));
  const gltf = assets.objects.nature_pine_1;
  assert.equal(gltf.model, "/assets/models/nature-megakit/Pine_1.gltf");
  const invalid = structuredClone(load("definitions/assets.json")) as Record<string, any>;
  invalid.objects.nature_pine_1.model = "/assets/models/../secrets.gltf";
  assert.throws(() => validateMapAssets(invalid), /chemin/);
});

test("tile centers use corner origin and column X / row Z", () => {
  assert.deepEqual(tileCenter(dojo, 0, 0), [1, 0, 1]);
  assert.deepEqual(tileCenter(dojo, 2, 3), [7, 0, 5]);
  assert.deepEqual(terrainBounds(dojo), { minX: 0, maxX: 16, minZ: 0, maxZ: 16 });
  assert.deepEqual(dojo.objects[0].position, [3, 0, 0]);
  assert.deepEqual(findTerrainCell(dojo, 7, 5), { row: 2, column: 3 });
  assert.equal(findTerrainCell(dojo, -0.01, 5), undefined);
  assert.equal(findTerrainCell(dojo, 16, 5), undefined);
});

test("French catalogue names and unpainted floor cells survive map validation", () => {
  const rawAssets = load("definitions/assets.json") as Record<string, any>;
  const rawMap = load("maps/dojo.json") as Record<string, any>;
  const map = validateMapDefinition({ ...rawMap, terrain: { ...rawMap.terrain, tiles: [[null, "water"]] } }, assets);
  assert.equal(assets.objects.boulder.name, "Rocher");
  assert.equal(assets.tiles.water.name, "Eau");
  assert.deepEqual(map.terrain.tiles, [[null, "water"]]);
  assert.deepEqual(findTerrainCell(map, 1, 1), { row: 0, column: 0 });
  assert.deepEqual(createNavigationData(map, assets).walkable, [[true, false]]);
  rawAssets.tiles.water.name = "";
  assert.throws(() => validateMapAssets(rawAssets), /water.name/);
});

test("a level can override enemy stats using a public catalogue while retaining defaults", async (t) => {
  const rawAssets = load("definitions/assets.json");
  const { enemyCatalog } = parseAssetCatalog(rawAssets);
  const guard = enemyCatalog.find(({ id }) => id === "dojo-guard");
  assert.ok(guard);
  const path = "/assets/definitions/enemies-hard.json";
  const overrides = [{ ...guard, stats: { ...guard.stats, maxHealth: 300 } }];
  const rawDojo = load("maps/dojo.json") as object;
  const reusablePrefabs = load("definitions/blockout-prefabs.json");
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const value = input === path ? overrides : input === "/assets/maps/dojo.json"
      ? { ...rawDojo, enemyCatalog: path }
      : input === "/assets/definitions/blockout-prefabs.json" ? reusablePrefabs : rawAssets;
    return Response.json(value);
  });
  const loaded = await loadMapData("dojo");
  assert.equal(loaded.map.enemyCatalog, path);
  assert.equal(loaded.enemyCatalog.find(({ id }) => id === guard.id)?.stats.maxHealth, 300);
  assert.equal(loaded.enemyCatalog.find(({ id }) => id === "dummy-straw")?.category, "static");
  assert.notEqual(guard.stats.maxHealth, 300);
  assert.throws(() => validateMapDefinition({ ...rawDojo, enemyCatalog: "https://example.com/enemies.json" }, assets),
    /enemyCatalog/);
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

test("map instances validate and retain visual/collider overrides and interactions", () => {
  const source = load("maps/dojo.json") as Record<string, any>;
  source.objects[0].visual = {
    model: "/assets/models/editor/wall.glb", tint: "#bbaa99", scale: 1.4,
  };
  source.objects[0].colliders = [{
    type: "box", position: [0, 1, 0], size: [3, 2, 1],
  }];
  const result = validateMapDefinition(source, assets);
  assert.equal(result.objects[0].visual?.model, "/assets/models/editor/wall.glb");
  assert.equal(result.objects[0].colliders?.[0].type, "box");
  assert.equal(result.interactions?.length, 2);
  const invalid = structuredClone(source);
  invalid.objects[0].visual.scale = 0;
  assert.throws(() => validateMapDefinition(invalid, assets), /visual.scale/);
});

test("primitive prototype zones retain their non-GLB ground, geometry and exits", () => {
  for (const id of ["prototype-forest", "prototype-arena"]) {
    const map = validateMapDefinition(load("maps/" + id + ".json"), assets);
    assert.equal(map.id, id);
    assert.ok(map.terrain.primitiveGround);
    assert.equal(map.terrain.tiles.flat().filter(Boolean).length, 0);
    assert.ok(map.primitives?.length);
    assert.ok(map.exits?.length);
    assert.ok(map.exits?.every((exit) => exit.targetSpawn.length > 0));
  }
});

test("Playground is an enclosed modular blockout with five editable lights and two targets", () => {
  const source = load("maps/playground.json") as Record<string, unknown>;
  const catalog = parseAssetCatalog(load("definitions/assets.json")).enemyCatalog;
  const map = validateMapDefinition(source, assets, new Set(catalog.map((enemy) => enemy.id)));
  assert.equal(map.id, "playground");
  assert.deepEqual(map.terrain.origin, [-18, 0, -18]);
  assert.equal(map.terrain.tiles.length, 18);
  assert.equal(map.terrain.tiles[0].length, 18);
  assert.equal(map.terrain.primitiveGround?.pattern, undefined);
  assert.equal(map.terrain.visual?.style, "platform");
  assert.ok(map.terrain.tiles.every((row) => row.every((tile) => tile === null)));
  assert.equal(map.objects.length, 0);
  assert.equal(map.prefabs?.length, 45);
  const walls = map.prefabs?.filter((part) =>
    part.prefab === "wall-dark" || part.prefab === "wall-dark-low") ?? [];
  assert.equal(walls.length, 36);
  assert.equal(walls.filter((part) => part.prefab === "wall-dark-low").length, 18);
  for (const side of ["north", "south", "east", "west"]) {
    assert.equal(walls.filter((wall) => wall.id.startsWith(side + "-wall-")).length, 9);
    assert.ok(map.prefabs?.some((part) => part.id === "sconce-" + side));
  }
  assert.ok(map.prefabs?.some((part) => part.id === "center-light-fixture"));
  assert.equal(map.enemySpawns?.length, 2);
  assert.ok(map.enemySpawns?.every(({ enemyId }) => enemyId === "target-wood"));
  assert.deepEqual(map.enemySpawns?.map(({ position }) => position), [[-5, 0, 3], [5, 0, 3]]);
  assert.deepEqual(map.spawnPoints.find(({ type }) => type === "player")?.position, [0, 0, -10]);

  assert.equal(map.lighting?.world.sun.enabled, false);
  assert.equal(map.lighting?.world.ambient.enabled, true);
  assert.equal(map.lighting?.map.enabled, true);
  assert.equal(map.lighting?.map.lights.length, 5);
  assert.ok(map.lighting?.map.lights.every(({ type, shadows }) =>
    type === "point" && !shadows.enabled));
  assert.deepEqual(map.lighting?.map.lights[0].position, [0, 4.2, 0]);

  const invalid = structuredClone(source) as Record<string, any>;
  invalid.terrain.primitiveGround.pattern = "unknown";
  assert.throws(() => validateMapDefinition(invalid, assets), /motif inconnu/);
});
