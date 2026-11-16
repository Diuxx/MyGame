import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadMapData } from "./dataLoader.ts";

test("an empty Playground map offers all whitebox blocks for new placement", async () => {
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
    assert.equal(playground.map.prefabs?.length ?? 0, 0);
    assert.ok(playground.assets.prefabs?.["wall-straight"], "whitebox wall should be reusable on an empty map");
    assert.ok(playground.assets.prefabs?.["wall-corner"], "corner wall should also be available");
    const inn = await loadMapData("prototype-inn");
    assert.ok(inn.map.prefabs && inn.map.prefabs.length > 0);
    assert.equal(inn.assets.prefabs, playground.assets.prefabs, "definitions should be shared");
    assert.equal(fetched.filter((path) => path.endsWith("blockout-prefabs.json")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
