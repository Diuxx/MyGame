import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { MapModelRegistry } from "./modelRegistry.ts";
import { createEditableModel } from "./editableModel.ts";

async function modelUrl(): Promise<string> {
  const data = await readFile(new URL("../../../public/assets/training/dummy-straw.glb", import.meta.url));
  return "data:model/gltf-binary;base64," + data.toString("base64");
}

test("editable instances retain shared source materials and restore their own previews", async (t) => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const registry = new MapModelRegistry(scene);
  t.after(async () => {
    await registry.dispose();
    engine.dispose();
  });
  const path = await modelUrl();
  const a = new TransformNode("a", scene);
  const b = new TransformNode("b", scene);
  const missing = () => { throw new Error("Unexpected fallback"); };
  const first = createEditableModel(scene, a, registry, undefined, path, missing);
  const second = createEditableModel(scene, b, registry, undefined, path, missing);
  assert.equal(await first.load(), true);
  assert.equal(await second.load(), true);
  const aMesh = a.getChildMeshes().find((mesh) => mesh.getTotalVertices() > 0);
  const bMesh = b.getChildMeshes().find((mesh) => mesh.getTotalVertices() > 0);
  assert.ok(aMesh && bMesh);
  const initialMaterial = aMesh.material;
  const otherMaterial = bMesh.material;

  first.setAppearance({ tint: "#ff4433", scale: 1.2 });
  assert.notEqual(aMesh.material, initialMaterial);
  assert.equal(bMesh.material, otherMaterial);
  const previewMaterial = aMesh.material;

  first.setAppearance({ scale: 1 });
  assert.equal(aMesh.material, initialMaterial);
  assert.equal(bMesh.material, otherMaterial);
  assert.equal(scene.materials.includes(previewMaterial!), false);

  first.dispose();
  first.dispose(); // Idempotent cleanup.
  assert.equal(aMesh.isDisposed(), true);
  assert.equal(bMesh.isDisposed(), false);
  second.dispose();
  assert.equal(bMesh.isDisposed(), true);
});

test("a failed replacement keeps the previous instance alive", async (t) => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const registry = new MapModelRegistry(scene);
  t.after(async () => {
    await registry.dispose();
    engine.dispose();
  });
  const path = await modelUrl();
  const holder = new TransformNode("holder", scene);
  const editorTarget = { editorKind: "object", editorId: "dummy" } as const;
  const model = createEditableModel(scene, holder, registry, undefined, path,
    () => { throw new Error("Fallback failed"); }, true, undefined, editorTarget);
  assert.equal(await model.load(), true);
  const oldMesh = holder.getChildMeshes().find((mesh) => mesh.getTotalVertices() > 0);
  assert.ok(oldMesh);
  assert.equal(oldMesh.metadata?.editorId, "dummy");
  assert.equal(oldMesh.isPickable, false);
  const previousWarning = console.warn;
  console.warn = () => {};
  try {
    await assert.rejects(model.load({ model: "data:model/gltf-binary;base64,Z2xURgAAAAA=" }),
      /Fallback failed/);
  } finally {
    console.warn = previousWarning;
  }
  assert.equal(oldMesh.isDisposed(), false);
  assert.equal(holder.getChildMeshes().includes(oldMesh), true);
  assert.equal(await model.load({ scale: 2 }), true);
  const newMesh = holder.getChildMeshes().find((mesh) => mesh.getTotalVertices() > 0);
  assert.ok(newMesh && newMesh !== oldMesh);
  assert.equal(newMesh.metadata?.editorId, "dummy");
  assert.equal(newMesh.isPickable, false);
  model.dispose();
});
