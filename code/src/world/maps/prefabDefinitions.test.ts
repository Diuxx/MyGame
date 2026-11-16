import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { buildMapObstacles, resolveMapMovement } from "./mapCollision.ts";
import { createPrefabRenderer } from "./prefabRenderer.ts";
import {
  parsePrefabCatalog, parsePrefabPlacements, rotateLocal, type PrefabPlacement,
} from "./prefabDefinitions.ts";
import { validateMapAssets, validateMapDefinition } from "./validation.ts";
import { createNavigationData } from "./navigationData.ts";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL("../../../public/assets/" + path, import.meta.url), "utf8"));
}

const catalog = parsePrefabCatalog(readJson("definitions/blockout-prefabs.json"));
const assets = { ...validateMapAssets(readJson("definitions/assets.json")), prefabs: catalog };
const inn = validateMapDefinition(readJson("maps/prototype-inn.json"), assets);

test("the whitebox inn is composed of reusable prefabs without new tiles or textures", () => {
  assert.equal(inn.id, "prototype-inn");
  assert.ok(Object.keys(catalog).length >= 18);
  assert.ok((inn.prefabs?.length ?? 0) >= 60);
  assert.equal(inn.terrain.tiles.flat().filter(Boolean).length, 0);
  assert.equal(inn.terrain.primitiveGround?.pattern, undefined);
  assert.ok(inn.prefabs?.filter((item) => item.prefab === "table-round").length);
  const ids = inn.prefabs?.map((item) => item.id) ?? [];
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(inn.spawnPoints[0].position, [0, 0, 13]);
});

test("prefab catalogue rejects bad schema and unknown/duplicate placements", () => {
  assert.throws(() => parsePrefabCatalog({ version: 2, prefabs: {} }), /version 1/);
  assert.throws(() => parsePrefabCatalog({ version: 1, prefabs: {
    bad: { name: "x", category: "architecture", parts: [
      { kind: "box", position: [0,0,0], size: [1,0,1] },
    ], colliders: [] },
  } }), /nombre invalide/);
  const one = { id: "a", prefab: "table-round", position: [0,0,0], rotationY: 90, scale: 1 };
  assert.equal(parsePrefabPlacements([one], catalog)[0].prefab, "table-round");
  assert.throws(() => parsePrefabPlacements([one, one], catalog), /dupliqué/);
  assert.throws(() => parsePrefabPlacements([{ ...one, prefab: "other" }], catalog), /inconnu/);
  assert.throws(() => parsePrefabPlacements([{ ...one, scale: -1 }], catalog), /scale/);
  assert.throws(() => parsePrefabPlacements([one]), /catalogue non chargé/);
  assert.throws(() => validateMapDefinition({
    ...inn, prefabs: [{ ...one, prefab: "other" }],
  }, assets), /inconnu/);
});

test("rotated and scaled prefabs create independent colliders and navigation entries", () => {
  const original: PrefabPlacement = {
    id: "wall-a", prefab: "wall-straight", position: [0, 0, 0], rotationY: 90, scale: 2,
  };
  const other: PrefabPlacement = {
    id: "wall-b", prefab: "wall-straight", position: [10, 0, 0], rotationY: 0, scale: 1,
  };
  const map = { ...inn, objects: [], primitives: [], prefabs: [original, other] };
  const obstacles = buildMapObstacles(map, assets);
  assert.equal(obstacles.length, 2);
  const wallA = obstacles[0];
  const wallB = obstacles[1];
  assert.equal(wallA.type, "box");
  assert.equal(wallB.type, "box");
  if (wallA.type !== "box" || wallB.type !== "box") return;
  assert.equal(wallA.width, 8);
  assert.equal(wallA.depth, .8);
  assert.ok(Math.abs(wallA.yaw - Math.PI / 2) < 0.001);
  assert.equal(wallB.x, 10);
  assert.equal(wallB.width, 4);
  assert.deepEqual(rotateLocal(2, 0, Math.PI / 2), { x: 0 + Math.cos(Math.PI / 2) * 2, z: -2 });
  const movement = resolveMapMovement([10, 0, -4], { x: 0, z: 8 }, .4, obstacles);
  assert.ok(movement.z < 4);
  assert.deepEqual(createNavigationData(map, assets).blockingObjects.map((item) => item.id),
    ["wall-a", "wall-b"]);
  other.position = [15, 0, 0];
  assert.equal(buildMapObstacles(map, assets)[1].x, 15);
});

test("unit source meshes are shared and fully disposed across repeated scene loads", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  for (let i = 0; i < 3; i++) {
    const root = new TransformNode("test-root-" + i, scene);
    const placements: PrefabPlacement[] = [
      { id: "a", prefab: "table-round", position: [0,0,0], rotationY: 0, scale: 1 },
      { id: "b", prefab: "table-round", position: [3,0,0], rotationY: 45, scale: 2 },
    ];
    const renderer = createPrefabRenderer(scene, root, catalog, placements);
    assert.equal(scene.meshes.filter((mesh) => mesh.name === "prefab-unit-cylinder").length, 1);
    assert.ok(scene.meshes.some((mesh) => mesh.name === "prefab:b:0"));
    renderer.setEditing(true);
    renderer.move("b", [4,0,4]);
    renderer.rotate("b", 90);
    renderer.scale("b", 1.25);
    renderer.setColliderDebug(true);
    renderer.remove("a");
    assert.ok(!scene.meshes.some((mesh) => mesh.name === "prefab:a:0"));
    renderer.dispose();
    renderer.dispose();
    root.dispose();
    assert.equal(scene.meshes.length, 0);
  }
  scene.dispose();
  engine.dispose();
});

test("window walls block passage while the door frame preserves the entrance", () => {
  const wall: PrefabPlacement = {
    id: "window", prefab: "wall-window", position: [0,0,0], rotationY: 0, scale: 1,
  };
  const doorway: PrefabPlacement = {
    id: "door", prefab: "door-frame", position: [10,0,0], rotationY: 0, scale: 1,
  };
  const map = { ...inn, objects: [], primitives: [], prefabs: [wall, doorway] };
  const obstacles = buildMapObstacles(map, assets);
  const wallStep = resolveMapMovement([0,0,-4], { x: 0, z: 8 }, .4, obstacles);
  assert.ok(wallStep.z < 4);
  const doorStep = resolveMapMovement([10,0,-4], { x: 0, z: 8 }, .4, obstacles);
  assert.ok(Math.abs(doorStep.z - 8) < 0.01);
});

test("axis-scaled prefab colliders follow the individual world dimensions", () => {
  const wall: PrefabPlacement = {
    id: "stretched", prefab: "wall-straight", position: [0,0,0],
    rotationY: 90, scale: 1, scaleAxes: [2, 1, 0.5],
  };
  const obstacle = buildMapObstacles({ ...inn, objects: [], primitives: [], prefabs: [wall] }, assets)[0];
  assert.equal(obstacle.type, "box");
  if (obstacle.type !== "box") return;
  assert.equal(obstacle.width, 8);
  assert.equal(obstacle.depth, 0.2);
  assert.equal(obstacle.maxY - obstacle.minY, 3);
  assert.ok(Math.abs(obstacle.yaw - Math.PI / 2) < 1e-10);
  const parsed = parsePrefabPlacements([wall], catalog)[0];
  assert.deepEqual(parsed.scaleAxes, [2,1,0.5]);
  assert.throws(() => parsePrefabPlacements([{ ...wall, scaleAxes: [1,0,1] }], catalog), /nombre invalide/);
});

test("colored blockout modules preserve validated surfaces and share their masters", () => {
  const dark = catalog["wall-dark"];
  const fixture = catalog["lamp-wall-blockout"];
  assert.equal(dark.parts[0].color, "#454858");
  assert.equal(fixture.parts[2].emissive, "#D07A36");
  const invalid = structuredClone(readJson("definitions/blockout-prefabs.json")) as {
    prefabs: Record<string, { parts: { color?: string; emissive?: string }[] }>;
  };
  invalid.prefabs["wall-dark"].parts[0].color = "dark";
  assert.throws(() => parsePrefabCatalog(invalid), /\.color.*couleur/);
  invalid.prefabs["wall-dark"].parts[0].color = "#454858";
  invalid.prefabs["lamp-wall-blockout"].parts[2].emissive = "orange";
  assert.throws(() => parsePrefabCatalog(invalid), /\.emissive.*couleur/);

  const engine = new NullEngine();
  const scene = new Scene(engine);
  const root = new TransformNode("prefab-colors-test", scene);
  const placements: PrefabPlacement[] = [
    { id: "dark-a", prefab: "wall-dark", position: [-4, 0, 0], rotationY: 0, scale: 1 },
    { id: "dark-b", prefab: "wall-dark", position: [4, 0, 0], rotationY: 0, scale: 1 },
    { id: "lamp", prefab: "lamp-wall-blockout", position: [0, 0, 0], rotationY: 0, scale: 1 },
  ];
  const renderer = createPrefabRenderer(scene, root, catalog, placements);
  assert.equal(scene.meshes.filter((mesh) =>
    mesh.name === "prefab-unit-box:#454858:#000000").length, 1);
  assert.ok(scene.materials.some((material) => material.name === "blockout-material:#FFD49A:#D07A36"));
  renderer.dispose();
  root.dispose();
  assert.equal(scene.meshes.length, 0);
  assert.equal(scene.materials.length, 0);
  scene.dispose();
  engine.dispose();
});

test("the enclosed Playground perimeter blocks movement but the light fixtures do not", () => {
  const playground = validateMapDefinition(readJson("maps/playground.json"), assets);
  const obstacles = buildMapObstacles(playground, assets);
  assert.equal(obstacles.length, 40); // 36 wall sections and four corner pillars.
  const positions = [
    { start: [0, 0, 14] as const, step: { x: 0, z: 10 }, coordinate: "z" as const, limit: 17.5 },
    { start: [0, 0, -14] as const, step: { x: 0, z: -10 }, coordinate: "z" as const, limit: -17.5 },
    { start: [14, 0, 0] as const, step: { x: 10, z: 0 }, coordinate: "x" as const, limit: 17.5 },
    { start: [-14, 0, 0] as const, step: { x: -10, z: 0 }, coordinate: "x" as const, limit: -17.5 },
  ];
  for (const { start, step, coordinate, limit } of positions) {
    const moved = resolveMapMovement(start, step, 0.45, obstacles);
    const final = start[coordinate === "x" ? 0 : 2] + moved[coordinate];
    assert.ok(Math.abs(final) < Math.abs(limit), "The hero must stop before the wall");
  }
});
