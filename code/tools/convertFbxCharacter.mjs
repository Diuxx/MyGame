import { runBlender } from "./runBlender.mjs";

const args = process.argv.slice(2);
if (args.includes("--help") || args.length < 1) {
  console.log("Usage : node code/tools/convertFbxCharacter.mjs <personnage.fbx> [sortie.glb]");
  console.log("BLENDER_PATH permet d’indiquer le chemin de Blender.");
  process.exit(args.includes("--help") ? 0 : 2);
}

process.exitCode = runBlender(new URL("./convertFbxCharacter.py", import.meta.url), args);
