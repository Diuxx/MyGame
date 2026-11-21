import type { createTargetLockSystem } from "../character/targetLockSystem.ts";
import {
  TARGETING_SETTINGS_KEY, createTargetingSettings, parseTargetingManifest,
  serializeTargetingManifest,
} from "../character/targetingSettings.ts";
import { downloadJson, requireElement } from "../ui/dom.ts";
import { describeJsonExport } from "./workspacePersistence.ts";

type TargetLockSystem = ReturnType<typeof createTargetLockSystem>;

/** Local Playground overrides are never the authoritative game configuration. */
export function bindTargetLockTools(system: TargetLockSystem, signal: AbortSignal): () => void {
  const source = requireElement<HTMLElement>("targetLockSource");
  const status = requireElement<HTMLElement>("targetLockStatus");
  const targetLabel = requireElement<HTMLElement>("targetLockCurrentTarget");
  const refreshers: Array<() => void> = [];
  let settings = createTargetingSettings();

  function setSource(isLocal: boolean): void {
    source.textContent = isLocal
      ? "Source : paramètres locaux du Playground. Exporter pour les versionner."
      : "Source : code/TARGETING.json (versionné).";
  }

  function apply(): boolean {
    settings = createTargetingSettings(settings);
    system.setSettings(settings);
    setSource(true);
    let savedLocally = true;
    try {
      localStorage.setItem(TARGETING_SETTINGS_KEY, JSON.stringify(settings));
      status.textContent = "Réglages appliqués et enregistrés dans ce navigateur ; TARGETING.json n'a pas été modifié.";
    } catch (error) {
      savedLocally = false;
      status.textContent = "Réglages appliqués pour cette session uniquement : stockage local indisponible.";
      console.warn("Target-lock settings could not be saved:", error);
    }
    refresh();
    return savedLocally;
  }

  function checkbox(id: string, key: "enabled" | "showTargetRing" | "showDebugRadius"): void {
    const input = requireElement<HTMLInputElement>(id);
    refreshers.push(() => { input.checked = settings[key]; });
    input.addEventListener("change", () => {
      settings[key] = input.checked;
      apply();
    }, { signal });
  }

  function slider(id: string, key: "acquireRadius" | "releaseRadius" | "turnSpeed"): void {
    const input = requireElement<HTMLInputElement>(id);
    const output = requireElement<HTMLOutputElement>(id + "Value");
    refreshers.push(() => {
      if (key === "releaseRadius") input.min = String(settings.acquireRadius);
      input.value = String(settings[key]);
      output.textContent = key === "turnSpeed" ? String(settings[key]) : settings[key].toFixed(1) + " u";
    });
    input.addEventListener("input", () => {
      settings[key] = input.valueAsNumber;
      if (key === "acquireRadius") settings.releaseRadius = Math.max(settings.releaseRadius, settings.acquireRadius);
      apply();
    }, { signal });
  }

  checkbox("targetLockEnabled", "enabled");
  checkbox("targetLockShowRing", "showTargetRing");
  checkbox("targetLockShowRadius", "showDebugRadius");
  slider("targetLockAcquireRadius", "acquireRadius");
  slider("targetLockReleaseRadius", "releaseRadius");
  slider("targetLockTurnSpeed", "turnSpeed");

  const movement = requireElement<HTMLSelectElement>("targetLockMovementReference");
  refreshers.push(() => { movement.value = settings.movementReference; });
  movement.addEventListener("change", () => {
    settings.movementReference = movement.value === "target" ? "target" : "camera";
    apply();
  }, { signal });

  function refresh(): void {
    for (const update of refreshers) update();
  }

  function loadSaved(): void {
    try {
      const saved = localStorage.getItem(TARGETING_SETTINGS_KEY);
      if (saved) settings = createTargetingSettings(JSON.parse(saved));
      setSource(saved !== null);
    } catch (error) {
      console.warn("Target-lock overrides could not be loaded:", error);
      setSource(false);
    }
    system.setSettings(settings);
    refresh();
  }
  loadSaved();

  requireElement<HTMLButtonElement>("targetLockExport").addEventListener("click", () => {
    downloadJson("TARGETING.json", serializeTargetingManifest(settings));
    status.textContent = describeJsonExport("TARGETING.json", "code/TARGETING.json");
  }, { signal });

  const importFile = requireElement<HTMLInputElement>("targetLockImportFile");
  requireElement<HTMLButtonElement>("targetLockImport").addEventListener("click", () => importFile.click(), { signal });
  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      if (file.size > 32 * 1024) throw new Error("Fichier JSON trop volumineux.");
      settings = parseTargetingManifest(JSON.parse(await file.text()));
      const savedLocally = apply();
      status.textContent = savedLocally
        ? "Configuration importée et enregistrée dans ce navigateur. Télécharger TARGETING.json pour la versionner."
        : "Configuration importée pour cette session seulement : stockage local indisponible. Télécharger TARGETING.json pour la versionner.";
    } catch (error) {
      status.textContent = "Import refusé : " + (error instanceof Error ? error.message : String(error));
    } finally {
      importFile.value = "";
    }
  }, { signal });

  requireElement<HTMLButtonElement>("targetLockReset").addEventListener("click", () => {
    settings = createTargetingSettings();
    system.setSettings(settings);
    refresh();
    try {
      localStorage.removeItem(TARGETING_SETTINGS_KEY);
      setSource(false);
      status.textContent = "Réglages versionnés restaurés, surcharge locale supprimée.";
    } catch (error) {
      status.textContent = "Valeurs restaurées pour cette session, nettoyage local impossible.";
      console.warn("Target-lock overrides could not be cleared:", error);
    }
  }, { signal });

  let lastTarget = "";
  return () => {
    const nextTarget = !settings.enabled ? "Mode libre — verrouillage désactivé"
      : system.target ? "Verrouillé : " + system.target.id : "Ciblage disponible : attaquer ou appuyer sur W";
    if (lastTarget !== nextTarget) {
      targetLabel.textContent = nextTarget;
      lastTarget = nextTarget;
    }
  };
}
