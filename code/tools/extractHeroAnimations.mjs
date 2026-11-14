import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: node code/tools/extractHeroAnimations.mjs <animated-hero.glb>");

const manifest = JSON.parse(readFileSync(new URL("../ANIMATIONS.json", import.meta.url), "utf8"));
const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const source = readFileSync(sourcePath);
const jsonLength = source.readUInt32LE(12);
const model = JSON.parse(source.subarray(20, 20 + jsonLength));
const binary = source.subarray(28 + jsonLength);

if (source.toString("ascii", 0, 4) !== "glTF" || source.readUInt32LE(4) !== 2 ||
    model.buffers.length !== 1 || model.buffers[0].uri || model.extensionsUsed?.length ||
    model.accessors.some((accessor) => accessor.sparse)) {
  throw new Error("Expected a self-contained glTF 2.0 GLB with standard accessors.");
}

// Copy only referenced buffer views, preserving the original accessor data.
function writeGlb(path, document, remap) {
  const accessors = [];
  const bufferViews = [];
  const copiedAccessors = new Map();
  const copiedViews = new Map();
  const chunks = [];
  let byteLength = 0;

  function view(index) {
    if (!copiedViews.has(index)) {
      const original = model.bufferViews[index];
      const offset = original.byteOffset ?? 0;
      const bytes = binary.subarray(offset, offset + original.byteLength);
      const padded = Buffer.alloc(Math.ceil(bytes.length / 4) * 4);
      bytes.copy(padded);
      copiedViews.set(index, bufferViews.length);
      bufferViews.push({ ...original, byteOffset: byteLength });
      chunks.push(padded);
      byteLength += padded.length;
    }
    return copiedViews.get(index);
  }

  function accessor(index) {
    if (!copiedAccessors.has(index)) {
      const original = model.accessors[index];
      copiedAccessors.set(index, accessors.length);
      accessors.push({ ...original, bufferView: view(original.bufferView) });
    }
    return copiedAccessors.get(index);
  }

  remap(document, accessor, view);
  const json = Buffer.from(JSON.stringify({ ...document, accessors, bufferViews, buffers: [{ byteLength }] }));
  const paddedJson = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(paddedJson);
  const header = Buffer.alloc(20);
  header.write("glTF");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + paddedJson.length + byteLength, 8);
  header.writeUInt32LE(paddedJson.length, 12);
  header.write("JSON", 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(byteLength);
  binHeader.write("BIN\0", 4);
  writeFileSync(path, Buffer.concat([header, paddedJson, binHeader, ...chunks]));
}

const { asset, scene, scenes, nodes, animations, ...geometry } = model;
const clips = manifest.animations.map(({ name, source }) => {
  const clip = animations?.find((animation) => animation.name === source);
  if (!clip) throw new Error("Missing source animation: " + source);
  return { ...clip, name };
});
if (clips.length !== animations.length) throw new Error("The manifest must account for every source clip.");

const directory = join(publicDir, manifest.directory);
mkdirSync(directory, { recursive: true });
const rigNodes = nodes.map(({ mesh, skin, ...node }) => node);
for (const clip of clips) {
  writeGlb(join(directory, clip.name + ".glb"), { asset, scene, scenes, nodes: rigNodes, animations: [clip] },
    (_, accessor) => {
      for (const sampler of clip.samplers) {
        sampler.input = accessor(sampler.input);
        sampler.output = accessor(sampler.output);
      }
    });
}

const { accessors, bufferViews, buffers, ...meshData } = geometry;
writeGlb(join(publicDir, "models/hero.glb"), { asset, scene, scenes, nodes, ...meshData },
  (document, accessor, view) => {
    for (const mesh of document.meshes) {
      for (const primitive of mesh.primitives) {
        primitive.indices = accessor(primitive.indices);
        for (const attribute of Object.keys(primitive.attributes)) {
          primitive.attributes[attribute] = accessor(primitive.attributes[attribute]);
        }
      }
    }
    for (const skin of document.skins) skin.inverseBindMatrices = accessor(skin.inverseBindMatrices);
    for (const image of document.images) image.bufferView = view(image.bufferView);
  });
