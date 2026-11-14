import assert from "node:assert/strict";
import test from "node:test";
import { buildMapObstacles, resolveMapMovement } from "./mapCollision.ts";
import type { MapAssets, MapDefinition } from "./types.ts";

const assets: MapAssets = {
  version: 1,
  tiles: { floor: { model: "/assets/tiles/floor.glb", walkable: true } },
  objects: {
    wall: { model: "/assets/objects/wall.glb", blocksNavigation: true, colliders: [
      { type: "box", position: [1, 1, 0], size: [2, 2, 0.3] },
    ] },
    tree: { model: "/assets/objects/tree.glb", blocksNavigation: true, colliders: [
      { type: "cylinder", position: [0, 1, 0], radius: 0.5, height: 2 },
    ] },
  },
};
const level: MapDefinition = {
  version: 1, id: "test", name: "Test", tileSize: 2,
  terrain: { origin: [0, 0, 0], tiles: [["floor", "floor"], ["floor", "floor"]],
    groundCollider: { enabled: true, thickness: 0.2 } },
  objects: [
    { id: "wall-1", asset: "wall", position: [3, 0, 3], rotationY: 90 },
    { id: "tree-1", asset: "tree", position: [0, 0, 3], rotationY: 0 },
  ],
  spawnPoints: [],
};

test("compound local offsets and box rotation produce stable world geometry", () => {
  const result = buildMapObstacles(level, assets);
  assert.ok(Math.abs(result[0].x - 3) < 0.000001);
  assert.ok(Math.abs(result[0].z - 2) < 0.000001);
  assert.ok(result[0].type === "box" && Math.abs(result[0].yaw - Math.PI / 2) < 1e-9);
  assert.deepEqual(result[1], { type: "circle", x: 0, z: 3, radius: 0.5, minY: 0, maxY: 2 });
});

test("continuous collision stops a fast dash at a tree instead of tunneling", () => {
  const obstacles = buildMapObstacles(level, assets);
  const step = resolveMapMovement([0, 0, 0], { x: 0, z: 5 }, 0.4, obstacles);
  assert.ok(step.z > 2 && step.z < 2.11);
});

test("oriented wall stops the hero and permits tangent sliding", () => {
  const obstacles = buildMapObstacles(level, assets);
  const step = resolveMapMovement([1.5, 0, 2], { x: 4, z: 0 }, 0.3, obstacles);
  assert.ok(step.x > 0 && step.x < 4);
  const slide = resolveMapMovement([3.5, 0, 1.4], { x: 0, z: 1.2 }, 0.3, obstacles);
  assert.ok(Number.isFinite(slide.z));
});

test("nonblocking above-ground decorations do not block a grounded hero", () => {
  const obstacle = { type: "box" as const, x: 0, z: 2, width: 1, depth: 1, yaw: 0, minY: 4, maxY: 6 };
  assert.deepEqual(resolveMapMovement([0, 0, 0], { x: 0, z: 3 }, 0.3, [obstacle]),
    { x: 0, z: 3 });
});

test("terrain bounds account for the hero radius", () => {
  const desired = resolveMapMovement([2, 0, 2], { x: 10, z: 10 }, 0.5, [],
    { minX: 0, maxX: 4, minZ: 0, maxZ: 4 });
  assert.deepEqual(desired, { x: 1.5, z: 1.5 });
});

test("composed rectangles block separate arms, not an enclosing huge circle", () => {
  const walls = [
    { type: "box" as const, x: 1, z: 0, width: 2, depth: 0.4, yaw: 0, minY: 0, maxY: 2 },
    { type: "box" as const, x: 0, z: 1, width: 0.4, depth: 2, yaw: 0, minY: 0, maxY: 2 },
  ];
  const open = resolveMapMovement([2, 0, 2], { x: 0.25, z: 0.25 }, 0.2, walls);
  assert.deepEqual(open, { x: 0.25, z: 0.25 });
  const blocked = resolveMapMovement([1, 0, -2], { x: 0, z: 4 }, 0.2, walls);
  assert.ok(blocked.z < 2);
});

test("editing one placed collider changes only that object's collision footprint", () => {
  const edited: MapDefinition = structuredClone(level);
  const before = buildMapObstacles(edited, assets);
  edited.objects[0].position = [5, 0, 5];
  edited.objects[0].colliders = [
    { type: "box", position: [0, 1, 0], size: [4, 2, 0.5] },
  ];
  const after = buildMapObstacles(edited, assets);
  assert.notDeepEqual(after[0], before[0]);
  assert.deepEqual(after[1], before[1]); // tree unaffected
  assert.equal(after[0].type, "box");
  if (after[0].type === "box") assert.equal(after[0].width, 4);
});
