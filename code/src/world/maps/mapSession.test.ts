import assert from "node:assert/strict";
import test from "node:test";
import { createMapSession } from "./mapSession.ts";

test("successful swaps activate next and dispose previous exactly once", async () => {
  const events: string[] = [];
  const session = createMapSession(async (id) => ({
    activate() { events.push("activate " + id); },
    dispose() { events.push("dispose " + id); },
  }));
  await session.load("dojo");
  await session.load("forest");
  session.unload();
  assert.deepEqual(events, ["activate dojo", "activate forest", "dispose dojo", "dispose forest"]);
});

test("failed replacement preserves the previous active map", async () => {
  const events: string[] = [];
  const session = createMapSession(async (id) => {
    if (id === "broken") throw new Error("invalid JSON");
    return { activate() { events.push("active " + id); }, dispose() { events.push("dispose " + id); } };
  });
  await session.load("dojo");
  await assert.rejects(() => session.load("broken"), /invalid JSON/);
  assert.ok(session.active);
  assert.deepEqual(events, ["active dojo"]);
  await session.dispose();
  assert.deepEqual(events, ["active dojo", "dispose dojo"]);
});

test("late older load is discarded without replacing the current level", async () => {
  const events: string[] = [];
  let resolveSlow: ((value: { activate(): void; dispose(): void }) => void) | undefined;
  const session = createMapSession(async (id) => {
    if (id === "slow") return await new Promise<{ activate(): void; dispose(): void }>((resolve) => { resolveSlow = resolve; });
    return { activate() { events.push("active fast"); }, dispose() { events.push("dispose fast"); } };
  });
  const slow = session.load("slow");
  await session.load("fast");
  resolveSlow?.({ activate() { events.push("active slow"); }, dispose() { events.push("dispose slow"); } });
  await slow;
  assert.deepEqual(events, ["active fast", "dispose slow"]);
  await session.dispose();
  assert.deepEqual(events.at(-1), "dispose fast");
});
