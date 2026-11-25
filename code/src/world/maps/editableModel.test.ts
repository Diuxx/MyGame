import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { InstancedMesh, NullEngine, Scene, TransformNode } from "@babylonjs/core";
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

  await first.setAppearance({ tint: "#ff4433", scale: 1.2 });
  assert.notEqual(aMesh.material, initialMaterial);
  assert.equal(bMesh.material, otherMaterial);
  const previewMaterial = aMesh.material;

  await first.setAppearance({ scale: 1 });
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

/** A deterministic static GLB fixture without rig, textures or external files. */
function staticModelUrl(): string {
  const positions = Buffer.alloc(36);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
    positions.writeFloatLE(value, index * 4));
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } }],
    buffers: [{ byteLength: positions.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.length, target: 34962 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3",
      min: [0, 0, 0], max: [1, 1, 0] }],
  };
  const json = Buffer.from(JSON.stringify(document));
  const paddedJson = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(paddedJson);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(header.length + paddedJson.length + 8 + positions.length, 8);
  header.writeUInt32LE(paddedJson.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(positions.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  return "data:model/gltf-binary;base64," +
    Buffer.concat([header, paddedJson, binaryHeader, positions]).toString("base64");
}

test("static scenery shares GPU instances and leaves the group only for custom appearance", async (t) => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const registry = new MapModelRegistry(scene);
  t.after(async () => {
    await registry.dispose();
    engine.dispose();
  });
  const path = staticModelUrl();
  const a = new TransformNode("a", scene);
  const b = new TransformNode("b", scene);
  b.position.x = 5;
  b.rotation.y = 1;
  const missing = () => { throw new Error("Unexpected fallback"); };
  const first = createEditableModel(scene, a, registry, undefined, path, missing,
    true, undefined, { editorKind: "object", editorId: "a" });
  const second = createEditableModel(scene, b, registry, undefined, path, missing,
    true, undefined, { editorKind: "object", editorId: "b" });
  const meshOf = (root: TransformNode) =>
    root.getChildMeshes().find((mesh) => mesh.getTotalVertices() > 0);
  assert.equal(await first.load(), true);
  assert.equal(await second.load({ scale: 2 }), true);
  const aMesh = meshOf(a);
  const bMesh = meshOf(b);
  assert.ok(aMesh instanceof InstancedMesh && bMesh instanceof InstancedMesh);
  assert.equal(aMesh.sourceMesh, bMesh.sourceMesh);
  assert.equal(aMesh.metadata?.editorId, "a");
  assert.equal(bMesh.metadata?.editorId, "b");
  assert.equal(bMesh.isPickable, false);
  assert.equal(b.position.x, 5);
  assert.equal(b.getChildren()[0] instanceof TransformNode, true);
  const holder = b.getChildren()[0] as TransformNode;
  assert.equal(holder.scaling.x, 2);
  const originalMaterial = bMesh.material;

  await first.setAppearance({ tint: "#ff4433" });
  const painted = meshOf(a);
  assert.ok(painted && !(painted instanceof InstancedMesh));
  assert.notEqual(painted.material, originalMaterial);
  assert.equal(bMesh.material, originalMaterial);
  assert.equal(aMesh.isDisposed(), true);
  assert.equal(bMesh.isDisposed(), false);

  await first.setAppearance({ scale: 3 });
  const restored = meshOf(a);
  assert.ok(restored instanceof InstancedMesh);
  assert.equal(restored.sourceMesh, bMesh.sourceMesh);
  assert.equal(restored.material, originalMaterial);
  assert.equal(painted.isDisposed(), true);
  first.dispose();
  assert.equal(bMesh.isDisposed(), false);
  second.dispose();
});
