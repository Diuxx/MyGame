import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseAssetCatalog } from "../world/maps/dataLoader.ts";
import { parsePrefabCatalog } from "../world/maps/prefabDefinitions.ts";
import { buildCatalogEntries, catalogType, matchesCatalogEntry } from "./catalogEntries.ts";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");
const rawAssets = JSON.parse(read("../../public/assets/definitions/assets.json"));
const { assets, enemyCatalog } = parseAssetCatalog(rawAssets);
const prefabs = parsePrefabCatalog(JSON.parse(read("../../public/assets/definitions/blockout-prefabs.json")));
const entries = buildCatalogEntries({ ...assets, prefabs }, enemyCatalog);

test("the visual catalogue contains every placeable asset exactly once per kind", () => {
  assert.equal(entries.length, Object.keys(assets.objects).length + Object.keys(assets.tiles).length
    + Object.keys(prefabs).length + enemyCatalog.length);
  assert.equal(new Set(entries.map(entry => entry.kind + ":" + entry.id)).size, entries.length);
  for (const entry of entries) {
    if (entry.kind === "object") assert.ok(Object.hasOwn(assets.objects, entry.id));
    if (entry.kind === "tile") assert.ok(Object.hasOwn(assets.tiles, entry.id));
    if (entry.kind === "prefab") assert.ok(Object.hasOwn(prefabs, entry.id));
    if (entry.kind === "enemy") assert.ok(enemyCatalog.some(enemy => enemy.id === entry.id));
    assert.ok(entry.name.trim());
  }
});

test("categories unite model assets and modular assets without modifying placement keys", () => {
  const architecture = entries.filter(entry => matchesCatalogEntry(entry, "architecture", ""));
  assert.ok(architecture.some(entry => entry.kind === "object" && entry.id === "wall"));
  assert.ok(architecture.some(entry => entry.kind === "prefab" && entry.id === "wall-window"));
  const lights = entries.filter(entry => matchesCatalogEntry(entry, "lighting", ""));
  assert.ok(lights.some(entry => entry.id === "lantern"));
  assert.ok(lights.some(entry => entry.id === "lamp-wall-blockout"));
  assert.ok(entries.filter(entry => matchesCatalogEntry(entry, "training", "")).every(entry => entry.kind === "enemy"));
  assert.ok(entries.filter(entry => matchesCatalogEntry(entry, "prefabs", "")).every(entry => entry.kind === "prefab"));
});

test("global search is accent-insensitive and combines terms, category and original identifiers", () => {
  const window = entries.find(entry => entry.id === "wall-window")!;
  assert.equal(window.name, "Mur avec fenêtre");
  assert.equal(catalogType(window), "Bloc modulaire");
  assert.equal(matchesCatalogEntry(window, "all", "FENETRE mur"), true);
  assert.equal(matchesCatalogEntry(window, "all", "wall-window"), true);
  assert.equal(matchesCatalogEntry(window, "nature", "fenetre"), false);
  assert.equal(matchesCatalogEntry(window, "all", "inexistant"), false);
  assert.equal(matchesCatalogEntry(window, "prefabs", "bloc"), true);
  const grass = entries.find(entry => entry.id === "grass" && entry.kind === "tile")!;
  assert.equal(matchesCatalogEntry(grass, "ground", "herbe"), true);
});

test("previews reference actual model paths and modular geometry", () => {
  for (const entry of entries) {
    if ("model" in entry.preview) assert.match(entry.preview.model, /^\/assets\/.+\.gltf?$|^\/assets\/.+\.glb$/);
    else assert.deepEqual(entry.preview.prefab.parts, prefabs[entry.id].parts);
  }
});

test("catalogue markup retains placement actions and exposes labelled filters", () => {
  const html = read("../../index.html");
  const editor = read("./worldEditor.ts");
  assert.ok(html.includes('for="worldEditorCatalogSearch"'));
  assert.ok(html.includes('for="worldEditorCatalogFilter"'));
  assert.ok(html.includes('id="worldEditorCatalogItems"'));
  assert.ok(html.includes('id="worldEditorCancelPlacement"'));
  assert.ok(editor.includes('button[data-kind]'));
  assert.ok(editor.includes('pendingPlacement = { id, kind, label }'));
  assert.ok(editor.includes('button.dataset.label ?? id'));
});
