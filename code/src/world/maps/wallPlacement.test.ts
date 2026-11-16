import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parsePrefabCatalog, type PrefabPlacement } from "./prefabDefinitions.ts";
import { wallFitsTerrain, fitWallToTerrain, isNearTerrain, wallFootprint } from "./wallPlacement.ts";
import { validateMapAssets, validateMapDefinition, findTerrainCell } from "./validation.ts";

const data = (path: string): unknown => JSON.parse(readFileSync(
  new URL("../../../public/assets/" + path, import.meta.url), "utf8"));
const catalog = parsePrefabCatalog(data("definitions/blockout-prefabs.json"));
const assets = { ...validateMapAssets(data("definitions/assets.json")), prefabs: catalog };
const inn = validateMapDefinition(data("maps/prototype-inn.json"), assets);
function wall(x: number, z: number, rotationY = 0, axes?: [number, number, number]): PrefabPlacement {
  return { id: "test-wall", prefab: "wall-straight", position: [x, 0, z],
    rotationY, scale: 1, ...(axes ? { scaleAxes: axes } : {}) };
}

test("north and south wall faces snap flush with the same inset", () => {
  const north = fitWallToTerrain(inn, catalog, wall(0, -16));
  const south = fitWallToTerrain(inn, catalog, wall(0, 16));
  assert.ok(Math.abs(north.position[2] + 15.8) < 1e-8);
  assert.ok(Math.abs(south.position[2] - 15.8) < 1e-8);
  assert.equal(wallFitsTerrain(inn, catalog, north), true);
  assert.equal(wallFitsTerrain(inn, catalog, south), true);
  assert.ok(findTerrainCell(inn, south.position[0], south.position[2]));
});

test("east and west wall faces snap flush with the same inset after rotation", () => {
  const west = fitWallToTerrain(inn, catalog, wall(-16, 0, 90));
  const east = fitWallToTerrain(inn, catalog, wall(16, 0, 90));
  assert.ok(Math.abs(west.position[0] + 15.8) < 1e-8);
  assert.ok(Math.abs(east.position[0] - 15.8) < 1e-8);
  assert.equal(wallFitsTerrain(inn, catalog, west), true);
  assert.equal(wallFitsTerrain(inn, catalog, east), true);
});

test("wall fitting supports rotations, stretched length and copied placements", () => {
  const stretched = wall(16, 16, 90, [2, 1, 0.5]);
  const fitted = fitWallToTerrain(inn, catalog, stretched);
  const shape = wallFootprint(catalog["wall-straight"], fitted);
  assert.ok(fitted.position[0] + shape.maxX <= 16 + 1e-8);
  assert.ok(fitted.position[2] + shape.maxZ <= 16 + 1e-8);
  assert.ok(fitted.position[0] + shape.minX >= -16 - 1e-8);
  assert.ok(fitted.position[2] + shape.minZ >= -16 - 1e-8);
  assert.deepEqual(stretched.position, [16, 0, 16], "source / clipboard placement is not mutated");
  assert.equal(fitWallToTerrain(inn, catalog, fitted).position[0], fitted.position[0]);
  const corner = fitWallToTerrain(inn, catalog,
    { ...wall(-16, -16, 180), prefab: "wall-corner" });
  assert.equal(wallFitsTerrain(inn, catalog, corner), true);
});

test("near-edge selection is symmetric, but non-walls retain their old placement rules", () => {
  for (const point of [[-16,0],[16,0],[0,-16],[0,16]]) {
    assert.equal(isNearTerrain(inn, point[0], point[1], 0), true);
  }
  assert.equal(isNearTerrain(inn, 16.25, 0, 0.5), true);
  assert.equal(isNearTerrain(inn, -16.25, 0, 0.5), true);
  assert.equal(isNearTerrain(inn, 16.6, 0, 0.5), false);
  const table = { ...wall(16, 16), prefab: "table-round" };
  assert.deepEqual(fitWallToTerrain(inn, catalog, table), table);
  assert.throws(() => fitWallToTerrain(inn, catalog,
    wall(0, 0, 0, [20, 1, 1])), /trop grand/);
});
