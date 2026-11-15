import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { parseVisualOverride, parseWorldInteractions } from "./editorSchema.ts";
import { createWorldInteractionScene } from "./worldInteractionScene.ts";
import { createWorldInteractions } from "./worldInteractions.ts";

test("visual overrides validate model, textures, tint and scaling", () => {
  assert.deepEqual(parseVisualOverride(undefined), undefined);
  assert.deepEqual(parseVisualOverride({ model: "/assets/models/editor/guard.glb", tint: "#ffaa22", scale: 1.2 }),
    { model: "/assets/models/editor/guard.glb", tint: "#ffaa22", scale: 1.2 });
  assert.throws(() => parseVisualOverride({ model: "/assets/../password.glb" }), /visual.model/);
  assert.throws(() => parseVisualOverride({ texture: "https://example.com/a.png" }), /visual.texture/);
  assert.throws(() => parseVisualOverride({ scale: -1 }), /visual.scale/);
});

test("proximity-based inspect, pickup once and inventory are deterministic", () => {
  const definitions = parseWorldInteractions([
    { id: "loot", kind: "pickup", itemId: "gem", label: "Gemme", position: [2, 0, 2], range: 1.5 },
    { id: "sign", kind: "inspect", label: "Panneau", position: [8, 0, 8], range: 2 },
  ]);
  const system = createWorldInteractions(definitions);
  assert.equal(system.interact([0, 0, 0]), undefined);
  assert.equal(system.nearby([2, 0, 2])?.id, "loot");
  assert.deepEqual(system.interact([2, 0, 2]), { id: "loot", kind: "pickup", itemId: "gem", message: "Ramassé : Gemme" });
  assert.equal(system.interact([2, 0, 2]), undefined);
  assert.deepEqual(system.getInventory(), { gem: 1 });
  assert.equal(system.interact([8, 0, 8])?.kind, "inspect");
  assert.equal(system.interact([8, 0, 8])?.kind, "inspect");
});

test("interaction definitions reject duplicates and invalid gameplay ranges", () => {
  const item = { id: "loot", kind: "pickup", itemId: "gem", label: "Gemme", position: [2, 0, 2], range: 1 };
  assert.throws(() => parseWorldInteractions([item, item]), /dupliqué/);
  assert.throws(() => parseWorldInteractions([{ ...item, range: 0 }]), /distance/);
  assert.throws(() => parseWorldInteractions([{ ...item, position: [1, NaN, 2] }]), /position/);
});

test("moving a pickup updates its model, exported position and interaction range", (t) => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const parent = new TransformNode("map", scene);
  const entries = parseWorldInteractions([
    { id: "loot", kind: "pickup", itemId: "gem", label: "Gemme", position: [2, 0, 2], range: 1 },
  ]);
  const interactions = createWorldInteractionScene(scene, parent, entries);
  t.after(() => {
    interactions.dispose();
    engine.dispose();
  });
  const [mesh] = parent.getChildMeshes();
  assert.deepEqual(mesh.metadata, { editorKind: "interaction", editorId: "loot" });
  interactions.move("loot", [8, 1, -4]);
  assert.deepEqual(mesh.position.asArray(), [8, 1.45, -4]);
  assert.deepEqual(JSON.parse(JSON.stringify(entries))[0].position, [8, 1, -4]);
  assert.equal(interactions.nearby([2, 0, 2]), undefined);
  assert.equal(interactions.interact([8, 1, -4])?.itemId, "gem");
  assert.equal(mesh.isEnabled(), false);
});
