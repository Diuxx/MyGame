import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AVAILABLE_MAPS, isMapId, loadMapData } from "./dataLoader.ts";

test("the blockout arena, prototype arena and nature showcase are hidden from the map selector", () => {
  assert.ok(!AVAILABLE_MAPS.includes("playground"));
  assert.ok(!AVAILABLE_MAPS.includes("prototype-arena"));
  assert.ok(!AVAILABLE_MAPS.includes("nature-showcase"));
  assert.equal(isMapId("playground"), true);
  assert.equal(isMapId("prototype-arena"), true);
  assert.equal(isMapId("nature-showcase"), true);
});

test("the populated Playground still exposes the reusable whitebox catalogue", async () => {
  const originalFetch = globalThis.fetch;
  const fetched: string[] = [];
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const path = String(input);
    fetched.push(path);
    if (!/^\/assets\/[a-z0-9_./-]+\.json$/i.test(path)) {
      return new Response(null, { status: 404 });
    }
    try {
      const body = readFileSync(new URL("../../../public" + path, import.meta.url), "utf8");
      return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
    } catch {
      return new Response(null, { status: 404 });
    }
  };
  try {
    const playground = await loadMapData("playground");
    assert.equal(playground.map.id, "playground");
    assert.equal(playground.map.prefabs?.length, 45);
    assert.ok(playground.map.objects.some((object) =>
      object.id === "fog-bank-center" && object.asset === "fog_bank"));
    const stool = playground.map.objects.find((object) => object.id === "fantasy-wooden-stool-test");
    assert.ok(stool, "the Playground should include the wooden stool preview");
    assert.equal(stool.asset, "fantasy_wooden_stool");
    assert.deepEqual(stool.position, [6, 0, -8]);
    assert.equal(playground.assets.objects[stool.asset].model, "/assets/models/objects/fantasy-wooden-stool.glb");
    assert.ok(playground.assets.prefabs?.["wall-straight"], "whitebox wall should be reusable on an empty map");
    assert.ok(playground.assets.prefabs?.["wall-corner"], "corner wall should also be available");
    assert.ok(playground.assets.prefabs?.["wall-dark"], "dark modular wall should be reusable");
    assert.ok(playground.assets.prefabs?.["lamp-wall-blockout"], "light fixture should be reusable");
    const inn = await loadMapData("prototype-inn");
    assert.equal(inn.map.prefabs?.length, 61);
    assert.equal(inn.map.terrain.tiles[13][8], "fantasy_stone_paving");
    assert.equal(inn.assets.tiles.fantasy_stone_paving.model, "/assets/models/tiles/fantasy-stone-paving-tile.glb");
    const lamp = inn.map.objects.find((object) => object.id === "fantasy-amber-lamp-entrance");
    assert.ok(lamp, "the auberge should place the fantasy street lamp");
    assert.equal(lamp.asset, "fantasy_amber_lamp");
    assert.equal(inn.assets.objects[lamp.asset].model, "/assets/models/objects/fantasy-amber-street-lamp.glb");
    const lampSpot = inn.assets.objects[lamp.asset].spotLight;
    assert.ok(lampSpot, "the lamp asset should include its default local spotlight");
    assert.deepEqual(lampSpot.position, [1.08, 2.92, 0]);
    assert.deepEqual(lampSpot.direction, [0, -1, 0]);
    assert.equal(lampSpot.intensity, 1.6);
    assert.equal(lampSpot.range, 6);
    assert.equal(lampSpot.angle, 72);
    assert.equal(lampSpot.exponent, 1.5);
    const tree = inn.map.objects.find((object) => object.id === "fantasy-faceted-tree-courtyard");
    assert.ok(tree, "the auberge should place the untextured tree blockout");
    assert.equal(tree.asset, "fantasy_tree_blockout");
    assert.equal(inn.assets.objects[tree.asset].model, "/assets/models/nature/fantasy-faceted-tree-blockout.glb");
    assert.deepEqual(tree.position, [-4, 0, 9]);
    const stoneWall = inn.map.objects.find((object) => object.id === "lowpoly-stone-wall-north-test");
    assert.ok(stoneWall, "the inn should place one low-poly wall segment for testing");
    assert.equal(stoneWall.asset, "fantasy_stone_wall_lowpoly");
    assert.deepEqual(stoneWall.position, [1.5, 0, -15.5]);
    assert.equal(inn.assets.objects[stoneWall.asset].model,
      "/assets/models/architecture/lowpoly-stone-wall-segment.glb");
    assert.deepEqual(inn.assets.objects[stoneWall.asset].colliders, [
      { type: "box", position: [0, 1.5, 0], size: [4, 3, 0.66] },
    ]);
    assert.ok(!inn.map.prefabs?.some((prefab) => prefab.id === "wall-straight-004"),
      "the sampled blockout wall should not overlap the custom wall");
    assert.deepEqual(inn.map.spawnPoints[0], {
      id: "entrance", type: "player", position: [0, 0, 13], rotationY: 180,
    });
    assert.equal(inn.assets.prefabs, playground.assets.prefabs, "definitions should be shared");
    assert.equal(fetched.filter((path) => path.endsWith("blockout-prefabs.json")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
