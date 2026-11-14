import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function findWindowsBlender() {
  if (process.platform !== "win32") return undefined;
  const directory = join(process.env.ProgramFiles || "C:\\Program Files", "Blender Foundation");
  const installations = readdirSync(directory, { withFileTypes: true, throwIfNoEntry: false }) ?? [];
  return installations
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("Blender "))
    .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }))
    .map((entry) => join(directory, entry.name, "blender.exe"))
    .find(existsSync);
}

export function runBlender(scriptUrl, args) {
  const script = fileURLToPath(scriptUrl);
  const launch = (blender) => spawnSync(blender, [
    "-b", "--python-exit-code", "1", "--python", script, "--", ...args,
  ], { stdio: "inherit", windowsHide: true });
  const configuredPath = process.env.BLENDER_PATH;
  let result = launch(configuredPath || "blender");
  if (!configuredPath && result.error?.code === "ENOENT") {
    const installedBlender = findWindowsBlender();
    if (installedBlender) result = launch(installedBlender);
  }

  if (result.error?.code === "ENOENT") {
    console.error(configuredPath
      ? `Blender est introuvable à l’emplacement indiqué par BLENDER_PATH : ${configuredPath}`
      : "Blender est introuvable. Ajoutez-le au PATH ou donnez le chemin complet de son exécutable dans BLENDER_PATH.");
  } else if (result.error) {
    console.error(result.error.message);
  }
  return result.status ?? 1;
}
