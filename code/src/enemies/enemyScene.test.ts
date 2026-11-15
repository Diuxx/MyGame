import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { NullEngine, Scene, type AbstractMesh, type ShadowGenerator } from "@babylonjs/core";
import { loadEnemyDefinitions } from "./enemyDefinitions.ts";
import { createEnemyScene } from "./enemyScene.ts";

test("playground targets share a GLB source but own their scene instances", async (t) => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const casters = new Set<AbstractMesh>();
  const shadows = {
    addShadowCaster(mesh: AbstractMesh) { casters.add(mesh); },
    removeShadowCaster(mesh: AbstractMesh) { casters.delete(mesh); },
  } as unknown as ShadowGenerator;
  const enemies = createEnemyScene(scene, shadows, 0);
  t.after(async () => {
    await enemies.dispose();
    engine.dispose();
  });

  const source = await readFile(new URL("../../public/assets/training/dummy-straw.glb", import.meta.url));
  const url = "data:model/gltf-binary;base64," + source.toString("base64");
  const sourceCatalog = JSON.parse(
    await readFile(new URL("../../public/assets/definitions/assets.json", import.meta.url), "utf8"));
  const straw = loadEnemyDefinitions(sourceCatalog.enemies).find(({ id }) => id === "dummy-straw");
  assert.ok(straw);
  const definition = { ...straw, modelPath: url };
  const first = await enemies.spawn(definition, definition, [0, 0, 0]);
  const second = await enemies.spawn(definition, definition, [4, 0, 0]);
  assert.equal(enemies.list().length, 2);
  assert.ok(casters.size > 0);

  const firstRoot = scene.getTransformNodeByName(first.id);
  const secondRoot = scene.getTransformNodeByName(second.id);
  assert.ok(firstRoot && secondRoot);
  const firstMesh = firstRoot.getChildMeshes().find((mesh) => mesh.getTotalVertices() > 0);
  assert.equal(firstMesh?.metadata?.editorKind, "practice");
  assert.equal(firstMesh?.metadata?.editorId, first.id);
  enemies.move(first.id, [2, 0, -3]);
  assert.equal(enemies.get(first.id), first);
  assert.deepEqual(first.position, [2, 0, -3]);
  assert.deepEqual(firstRoot.position.asArray(), [2, 0, -3]);
  assert.ok(enemies.resolveMovement([2, 0, -5], { x: 0, z: 3 }, 0.4).z < 3);
  const remainingMesh = secondRoot.getChildMeshes().find((mesh) => mesh.getTotalVertices() > 0);
  assert.ok(remainingMesh);
  enemies.remove(first.id);
  assert.equal(enemies.list().length, 1);
  assert.equal(firstRoot.isDisposed(), true);
  assert.equal(secondRoot.isDisposed(), false);
  assert.equal(remainingMesh.isDisposed(), false);
  enemies.removeAll();
  assert.equal(enemies.list().length, 0);
  assert.equal(casters.size, 0);

  await enemies.dispose();
  await assert.rejects(enemies.spawn(definition, definition, [0, 0, 0]), /libérée/);
});
