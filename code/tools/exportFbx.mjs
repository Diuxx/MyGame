import { existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { runBlender } from "./runBlender.mjs";

const args = process.argv.slice(2);
if (args.includes("--help") || args.length < 1 || args.length > 2) {
  console.log("Usage : node exportFbx.mjs <source.glb> [sortie.fbx]");
  console.log("L’export exclut les formes d’affichage des os ajoutées par Blender.");
  console.log("Pour régénérer un FBX existant, indiquez un nouveau nom de sortie.");
  console.log("BLENDER_PATH permet d’indiquer le chemin de Blender.");
  process.exit(args.includes("--help") ? 0 : 2);
}

const source = resolve(args[0]);
const defaultOutput = join(dirname(source), basename(source, extname(source)) + ".fbx");
const output = args[1] ? resolve(args[1]) : defaultOutput;

if (existsSync(output)) {
  console.error(`Le FBX existe déjà (${output}). Indiquez un nouveau nom de sortie pour générer un nouvel export.`);
  process.exit(2);
}

process.exitCode = runBlender(new URL("./exportFbx.py", import.meta.url), [source, output]);
