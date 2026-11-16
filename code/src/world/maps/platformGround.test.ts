import assert from "node:assert/strict";
import test from "node:test";
import { NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { parseTerrainVisual } from "./zoneContent.ts";
import { createZoneScene } from "./zoneScene.ts";
import type { MapDefinition } from "./types.ts";

function definition(): MapDefinition {
  return {
    version: 1, id: "platform-test", name: "Platform test", tileSize: 2,
    terrain: {
      origin: [-4, 0, -4], tiles: Array.from({ length: 4 }, () => Array(4).fill(null)),
      groundCollider: { enabled: true, thickness: .2 },
      primitiveGround: { color: "#EEEEEE" },
      visual: { style: "platform", thickness: 1.2, sideColor: "#D8D8D8" },
    },
    objects: [], spawnPoints: [],
  };
}

test("platform visual parameters validate independently of existing maps", () => {
  assert.deepEqual(parseTerrainVisual(undefined), undefined);
  assert.deepEqual(parseTerrainVisual({ style: "flat" }), { style: "flat" });
  assert.deepEqual(parseTerrainVisual({ style: "platform" }),
    { style: "platform", thickness: 1.2, sideColor: "#D8D8D8" });
  assert.throws(() => parseTerrainVisual({ style: "round" }), /flat ou platform/);
  assert.throws(() => parseTerrainVisual({ style: "platform", thickness: 0 }), /thickness/);
  assert.throws(() => parseTerrainVisual({ style: "platform", thickness: 9 }), /thickness/);
  assert.throws(() => parseTerrainVisual({ style: "platform", sideColor: "red" }), /couleur/);
});

test("platform slab has six faces, a flat top at terrain Y and vertical sides", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const root = new TransformNode("root", scene);
  const map = definition();
  const zone = createZoneScene(scene, root, map);
  const body = scene.getMeshByName("zone-platform:platform-test");
  assert.ok(body);
  assert.equal(body.getTotalIndices(), 36);
  body.computeWorldMatrix(true);
  const bounds = body.getBoundingInfo().boundingBox;
  assert.ok(Math.abs(bounds.maximumWorld.y) < 1e-8);
  assert.ok(Math.abs(bounds.minimumWorld.y + 1.2) < 1e-8);
  assert.ok(Math.abs(bounds.maximumWorld.x - 4) < 1e-8);
  assert.ok(Math.abs(bounds.minimumWorld.x + 4) < 1e-8);
  assert.ok(Math.abs(bounds.maximumWorld.z - 4) < 1e-8);
  assert.ok(Math.abs(bounds.minimumWorld.z + 4) < 1e-8);
  zone.dispose();
  root.dispose();
  assert.equal(scene.meshes.length, 0);
  scene.dispose();
  engine.dispose();
});

test("terrain resize and style switches reuse and dispose the same slab safely", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const root = new TransformNode("root", scene);
  const map = definition();
  const zone = createZoneScene(scene, root, map);
  map.terrain.tiles = Array.from({ length: 6 }, () => Array(5).fill(null));
  map.terrain.origin = [-5, 0, -6];
  zone.resizeGround();
  const platform = scene.getMeshByName("zone-platform:platform-test");
  assert.ok(platform);
  platform.computeWorldMatrix(true);
  const bounds = platform.getBoundingInfo().boundingBox;
  assert.ok(Math.abs(bounds.maximumWorld.x - 5) < 1e-8);
  assert.ok(Math.abs(bounds.minimumWorld.z + 6) < 1e-8);
  map.terrain.visual = { style: "flat" };
  zone.refreshGround();
  assert.equal(scene.getMeshByName("zone-platform:platform-test"), null);
  map.terrain.visual = { style: "platform", thickness: 2, sideColor: "#BBBBBB" };
  zone.refreshGround();
  zone.refreshGround();
  assert.equal(scene.meshes.filter((mesh) => mesh.name === "zone-platform:platform-test").length, 1);
  zone.dispose();
  root.dispose();
  assert.equal(scene.meshes.length, 0);
  scene.dispose();
  engine.dispose();
});
