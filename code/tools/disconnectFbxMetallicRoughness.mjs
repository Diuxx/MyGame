import { runBlender } from "./runBlender.mjs";

const args = process.argv.slice(2);
if (args.includes("--help") || args.length < 1 || args.length > 2) {
  console.log("Usage : node code/tools/disconnectFbxMetallicRoughness.mjs <source.fbx> [sortie.fbx]");
  console.log("Le FBX source reste intact. Par défaut, la sortie porte le suffixe -no-metallic-roughness.");
  console.log("Un fichier de sortie existant est refusé. BLENDER_PATH permet de choisir Blender.");
  process.exit(args.includes("--help") ? 0 : 2);
}

process.exitCode = runBlender(new URL("./disconnectFbxMetallicRoughness.py", import.meta.url), args);
