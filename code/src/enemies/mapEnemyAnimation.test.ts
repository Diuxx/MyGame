import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { MapModelRegistry } from "../world/maps/modelRegistry.ts";
import { createMapEnemyAnimation } from "./mapEnemyAnimation.ts";

test("enemy animation follows actual displacement and blends without restarting", () => {
  function clip(name: string) {
    return {
      name, isStarted: false, weight: -1, starts: 0,
      start() { this.isStarted = true; this.starts++; },
      stop() { this.isStarted = false; },
    };
  }
  const idleClip = clip("Idle");
  const runClip = clip("Run");
  const player = createMapEnemyAnimation([idleClip, runClip]);
  player.update("idle", false, 0.1);
  assert.equal(player.activeName, "Idle");
  player.update("chase", true, 0.075);
  assert.equal(player.activeName, "Run");
  assert.equal(runClip.weight, 0.5);
  assert.equal(idleClip.weight, 0.5);
  player.update("chase", true, 0.075);
  assert.equal(runClip.starts, 1);
  assert.equal(idleClip.isStarted, false);
  player.update("chase", false, 0.15);
  assert.equal(player.activeName, "Idle");
  player.update("return", true, 0.15);
  assert.equal(player.activeName, "Run");
  player.update("windup", true, 0.15);
  assert.equal(player.activeName, "Idle");
  player.update("dead", false, 0.1);
  assert.equal(player.activeName, undefined);
  player.update("idle", false, 0.1);
  assert.equal(idleClip.isStarted, true);
  assert.equal(runClip.isStarted, false);
  player.update("inactive", false, 0.1);
  assert.equal(idleClip.isStarted, false);
  const missingRun = createMapEnemyAnimation([idleClip]);
  missingRun.update("chase", true, 0.1);
  assert.equal(missingRun.activeName, "Idle");
});

async function glb(path: string): Promise<string> {
  const bytes = await readFile(new URL("../../public/" + path, import.meta.url));
  return "data:model/gltf-binary;base64," + bytes.toString("base64");
}

test("the goblin's external clips bind to independent instances and reject incompatible models", async (t) => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const registry = new MapModelRegistry(scene);
  t.after(async () => {
    await registry.dispose();
    engine.dispose();
  });
  const [goblin, idle, run, dummy] = await Promise.all([
    glb("assets/models/enemies/goblin.glb"), glb("assets/animations/common/dwarf-idle.glb"),
    glb("assets/animations/common/mutant-run.glb"), glb("assets/training/dummy-straw.glb"),
  ]);
  const holder = new TransformNode("test", scene);
  const clips = { Idle: idle, Run: run };
  const first = await registry.instantiate(goblin, holder, clips);
  const second = await registry.instantiate(goblin, holder, clips);
  assert.ok(first && second);
  assert.deepEqual(first.animationGroups.map(({ name }) => name), ["Idle", "Run"]);
  assert.deepEqual(second.animationGroups.map(({ name }) => name), ["Idle", "Run"]);
  const firstIdle = first.animationGroups[0];
  const secondIdle = second.animationGroups[0];
  assert.notEqual(firstIdle.targetedAnimations[0].target, secondIdle.targetedAnimations[0].target);
  const firstPlayer = createMapEnemyAnimation(first.animationGroups);
  const secondPlayer = createMapEnemyAnimation(second.animationGroups);
  firstPlayer.update("chase", true, 0.1);
  secondPlayer.update("idle", false, 0.1);
  assert.equal(first.animationGroups[1].isStarted, true);
  assert.ok(!second.animationGroups[1].isStarted);
  first.dispose();
  assert.equal(secondIdle.isStarted, true);
  second.dispose();
  assert.equal(scene.animationGroups.length, 0);

  const warn = t.mock.method(console, "warn", () => {});
  const incompatible = await registry.instantiate(dummy, holder, clips);
  assert.ok(incompatible);
  assert.deepEqual(incompatible.animationGroups, []);
  incompatible.dispose();
  assert.match(String(warn.mock.calls[0].arguments.at(-1)), /pose de repos incompatible/);
  const missingClip = await registry.instantiate(goblin, holder, { Idle: idle, Run: dummy });
  assert.deepEqual(missingClip?.animationGroups.map(({ name }) => name), ["Idle"]);
  missingClip?.dispose();
  assert.match(String(warn.mock.calls.at(-1)?.arguments.at(-1)), /Clip absent : Run/);
  assert.equal(await registry.instantiate(idle, holder, clips), null);
  const brokenFile = "data:model/gltf-binary;base64,Z2xURgAAAAA=";
  assert.equal(await registry.instantiate(brokenFile, holder), null);
  assert.match(String(warn.mock.calls.at(-1)?.arguments[0]), /fichier GLB absent ou illisible/);
});
