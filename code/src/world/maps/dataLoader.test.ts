import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadMapData } from "./dataLoader.ts";

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
    assert.ok(playground.assets.prefabs?.["wall-straight"], "whitebox wall should be reusable on an empty map");
    assert.ok(playground.assets.prefabs?.["wall-corner"], "corner wall should also be available");
    assert.ok(playground.assets.prefabs?.["wall-dark"], "dark modular wall should be reusable");
    assert.ok(playground.assets.prefabs?.["lamp-wall-blockout"], "light fixture should be reusable");
    const inn = await loadMapData("prototype-inn");
    assert.equal(inn.map.prefabs?.length, 62);
    assert.deepEqual(inn.map.spawnPoints[0], {
      id: "entrance", type: "player", position: [0, 0, 13], rotationY: 180,
    });
    assert.equal(inn.assets.prefabs, playground.assets.prefabs, "definitions should be shared");
    assert.equal(fetched.filter((path) => path.endsWith("blockout-prefabs.json")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
