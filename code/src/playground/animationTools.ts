import {
  ANIMATION_DEFINITIONS, ANIMATION_RANGES, createAnimationSettings, effectivePlaybackSpeed,
  getAnimationDefinition, parseAnimationManifest, serializeAnimationManifest,
} from "../character/animationSettings";
import type { AnimationPlayer } from "../character/animations";
import type { createCharacterController } from "../character/characterController";
import type { TransitionControls } from "./transitionTools";
import { createAnimationTimeline, type TimelineLane } from "./animationTimeline";
import { downloadJson, requireElement } from "../ui/dom";

const STORAGE_KEY = "mon-rpg.playground.animations.v2";
const format = (value: number, digits: number) => value.toFixed(digits).replace(".", ",");

export function bindAnimationTools(
  player: AnimationPlayer,
  controller: ReturnType<typeof createCharacterController>,
  available: ReadonlySet<string>,
  transitions: TransitionControls,
  signal: AbortSignal,
): () => void {
  let settings = createAnimationSettings();
  let hasLocalOverrides = false;
  const source = requireElement<HTMLParagraphElement>("animationConfigSource");
  const redraw: Array<() => void> = [];
  let updateTimelineProgress = () => {};

  function refreshSource(message?: string): void {
    source.textContent = message ?? (hasLocalOverrides
      ? "Source : réglages Playground temporaires · exporter pour les versionner."
      : "Source : code/ANIMATIONS.json · valeurs versionnées.");
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const legacy = saved === null ? localStorage.getItem("mon-rpg.playground.animations.v1") : null;
    settings = saved === null
      ? createAnimationSettings(JSON.parse(legacy ?? "null"), true)
      : createAnimationSettings(JSON.parse(saved));
    hasLocalOverrides = saved !== null || legacy !== null;
  } catch (error) {
    console.warn("Réglages d’animation illisibles. Valeurs par défaut utilisées.", error);
  }
  controller.setAnimationSettings(settings);
  refreshSource();

  function applySettings(): void {
    controller.setAnimationSettings(settings);
    redraw.forEach((render) => render());
    refreshSource();
  }

  requireElement<HTMLButtonElement>("exportAnimationManifest").addEventListener("click", () => {
    downloadJson("ANIMATIONS.json", serializeAnimationManifest(settings, transitions.get()));
    refreshSource("JSON exporté : remplacer code/ANIMATIONS.json pour versionner ces réglages.");
  }, { signal });

  const importInput = requireElement<HTMLInputElement>("importAnimationManifestFile");
  requireElement<HTMLButtonElement>("importAnimationManifest").addEventListener("click", () => importInput.click(), { signal });
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const parsed = parseAnimationManifest(JSON.parse(await file.text()));
      settings = parsed.settings;
      transitions.set(parsed.transitions);
      let saveWarning: string | undefined;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        saveWarning = error instanceof Error ? error.message : String(error);
      }
      hasLocalOverrides = true;
      applySettings();
      if (saveWarning) {
        refreshSource(`Configuration appliquée pour cette session uniquement : ${saveWarning}`);
      }
      refreshSource("Configuration importée et appliquée dans le Playground. Exporter pour la versionner.");
    } catch (error) {
      refreshSource(`Import refusé : ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      importInput.value = "";
    }
  }, { signal });

  requireElement<HTMLButtonElement>("resetAnimationManifest").addEventListener("click", () => {
    settings = createAnimationSettings();
    transitions.reset();
    let resetWarning: string | undefined;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("mon-rpg.playground.animations.v1");
    } catch (error) {
      resetWarning = error instanceof Error ? error.message : String(error);
    }
    hasLocalOverrides = false;
    applySettings();
    if (resetWarning) refreshSource(`Configuration réinitialisée pour cette session : ${resetWarning}`);
  }, { signal });

  for (const category of ["movement", "action"] as const) {
    const movement = category === "movement";
    const buttons = requireElement(movement ? "animationButtons" : "actionButtons");
    const fields = requireElement(movement ? "movementAnimationSettings" : "actionAnimationSettings");
    const definitions = ANIMATION_DEFINITIONS.filter((clip) => clip.category === category && available.has(clip.id));
    let selectedClip = definitions[0];
    const options = definitions.map((clip) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "animation-option";
      button.textContent = clip.displayName;
      button.addEventListener("click", () => {
        select(clip);
        if (movement) controller.selectMovement(clip.id);
        if (clip.impact) controller.attack();
        else if (clip.dodge) controller.dodge();
        else controller.preview(clip.id);
        updateStatus();
      }, { signal });
      buttons.append(button);
      return { clip, button };
    });

    function select(clip: typeof ANIMATION_DEFINITIONS[number]): void {
      selectedClip = clip;
      for (const option of options) {
        const selected = option.clip === clip;
        option.button.classList.toggle("active", selected);
        option.button.setAttribute("aria-pressed", String(selected));
      }
      fields.replaceChildren();
      const config = settings[clip.id];
      const refresh: (() => void)[] = [];

      function save(): void {
        controller.setAnimationSettings(settings);
        hasLocalOverrides = true;
        refreshSource();
        refresh.forEach((update) => update());
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
          status.hidden = true;
        } catch {
          status.hidden = false;
        }
      }

      function slider(
        name: string, label: string, range: typeof ANIMATION_RANGES.playback,
        read: () => number, write: (value: number) => void, display: (value: number) => string,
        container = fields,
      ): HTMLInputElement {
        const row = document.createElement("div");
        row.className = "field-row";
        const input = document.createElement("input");
        input.id = `${category}Animation-${name}`;
        input.type = "range";
        Object.assign(input, { min: String(range.min), max: String(range.max), step: String(range.step) });
        const caption = document.createElement("label");
        caption.htmlFor = input.id;
        caption.textContent = label;
        const output = document.createElement("output");
        output.htmlFor.add(input.id);
        row.append(caption, output);
        container.append(row, input);
        refresh.push(() => {
          const value = read();
          input.value = String(value);
          output.value = display(value);
          input.setAttribute("aria-valuetext", output.value);
        });
        input.addEventListener("input", () => {
          write(input.valueAsNumber);
          save();
        });
        return input;
      }

      if (config.movement) {
        const locomotion = config.movement;
        slider("speed", "Vitesse de déplacement", ANIMATION_RANGES.movement,
          () => locomotion.speed, (value) => { locomotion.speed = value; }, (n) => `${format(n, 1)} u/s`);
      }
      const playback = slider("playback", "Vitesse de lecture", ANIMATION_RANGES.playback,
        () => effectivePlaybackSpeed(clip, config), (value) => { config.playbackSpeed = value; }, (n) => `${format(n, 2)}×`);
      if (config.movement) {
        const locomotion = config.movement;
        const label = document.createElement("label");
        label.className = "grid-toggle";
        const sync = document.createElement("input");
        sync.type = "checkbox";
        sync.checked = locomotion.sync;
        label.append(sync, "Synchroniser la vitesse de l’animation");
        fields.append(label);
        refresh.unshift(() => {
          playback.disabled = locomotion.sync;
          playback.step = locomotion.sync ? "any" : String(ANIMATION_RANGES.playback.step);
        });
        sync.addEventListener("change", () => {
          locomotion.sync = sync.checked;
          save();
        });
      }

      function timing(label: string, window: { from: number; until: number }, suffix = "", container = fields): void {
        const percent = (n: number) => `${Math.round(n * 100)} %`;
        slider(`from${suffix}`, `Début ${label}`, ANIMATION_RANGES.progress,
          () => window.from, (value) => { window.from = Math.min(value, window.until); }, percent, container);
        slider(`until${suffix}`, `Fin ${label}`, ANIMATION_RANGES.progress,
          () => window.until, (value) => { window.until = Math.max(value, window.from); }, percent, container);
        const track = document.createElement("div");
        track.className = "animation-timeline";
        track.setAttribute("aria-hidden", "true");
        const segment = document.createElement("span");
        track.append(segment);
        container.append(track);
        refresh.push(() => {
          segment.style.left = `${Math.round(window.from * 100)}%`;
          segment.style.width = `${Math.round((window.until - window.from) * 100)}%`;
        });
      }

      if (config.dodge) {
        const dodge = config.dodge;
        slider("distance", "Distance d’esquive", ANIMATION_RANGES.distance,
          () => dodge.distance, (value) => { dodge.distance = value; }, (n) => `${format(n, 1)} u`);
        timing("de l’invulnérabilité", dodge.window);
        const duration = document.createElement("p");
        duration.className = "animation-note";
        fields.append(duration);
        refresh.push(() => { duration.textContent = `Durée de l’esquive : ${format(player.duration(clip.id) ?? 0, 2)} s`; });
      }
      if (config.impact) {
        const impact = config.impact;
        timing("du premier impact", impact);
        const label = document.createElement("label");
        label.className = "grid-toggle";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = impact.doubleHit;
        label.append(checkbox, "Deux impacts");
        const second = document.createElement("div");
        fields.append(label, second);
        timing("du deuxième impact", impact.second, "-second", second);
        refresh.push(() => { second.hidden = !impact.doubleHit; });
        checkbox.addEventListener("change", () => {
          impact.doubleHit = checkbox.checked;
          save();
        });
      }
      if (config.cancel) {
        const labels = {
          runFrom: "Course / marche autorisée",
          attackFrom: "Nouvelle attaque autorisée",
          dodgeFrom: "Esquive autorisée",
        };
        for (const key of ["runFrom", "attackFrom", "dodgeFrom"] as const) {
          if (config.cancel[key] === undefined) continue;
          slider(key, labels[key], ANIMATION_RANGES.progress,
            () => config.cancel![key]!,
            (value) => { config.cancel![key] = value; },
            (value) => `${Math.round(value * 100)} % (${Math.round(value * (player.duration(clip.id) ?? 0) * 1000)} ms)`);
        }
      }
      if (config.blendOutSeconds !== undefined) {
        slider("blendOut", "Fondu en sortie", ANIMATION_RANGES.blend,
          () => config.blendOutSeconds!, (value) => { config.blendOutSeconds = value; },
          (value) => `${Math.round(value * 1000)} ms`);
      }
      if (clip.category === "action") {
        const duration = () => player.duration(clip.id) ?? 0;
        const lanes: TimelineLane[] = [];
        if (config.dodge) {
          lanes.push({ label: "Invulnérabilité", kind: "invulnerable",
            from: () => config.dodge!.window.from, until: () => config.dodge!.window.until });
        }
        if (config.impact) {
          lanes.push({ label: "Premier impact", kind: "impact",
            from: () => config.impact!.from, until: () => config.impact!.until });
          lanes.push({ label: "Deuxième impact", kind: "impact",
            from: () => config.impact!.doubleHit ? config.impact!.second.from : 0,
            until: () => config.impact!.doubleHit ? config.impact!.second.until : 0 });
        }
        if (config.cancel) {
          for (const [key, label] of [
            ["runFrom", "Course / marche"], ["attackFrom", "Attaque"], ["dodgeFrom", "Esquive"],
          ] as const) {
            if (config.cancel[key] === undefined) continue;
            lanes.push({ label, kind: "cancel", from: () => config.cancel![key]!, until: () => 1 });
          }
        }
        if (config.blendOutSeconds !== undefined) {
          lanes.push({ label: "Fondu de sortie maximal", kind: "blend",
            from: () => Math.max(0, 1 - config.blendOutSeconds! / (duration() || 1)), until: () => 1 });
        }
        const timeline = createAnimationTimeline(fields, duration, lanes);
        refresh.push(timeline.refresh);
        updateTimelineProgress = () => timeline.setProgress(
          player.activeName === clip.id && !player.isActionInterrupted ? player.actionProgress : 0);
        const replay = document.createElement("button");
        replay.type = "button";
        replay.className = "secondary wide";
        replay.textContent = "Rejouer l’animation (prévisualisation)";
        replay.addEventListener("click", () => {
          controller.restartAnimationPreview(clip.id);
          updateStatus();
        }, { signal });
        fields.append(replay);
        const durationText = document.createElement("p");
        durationText.className = "animation-note";
        fields.append(durationText);
        refresh.push(() => { durationText.textContent = `Durée effective : ${Math.round(duration() * 1000)} ms`; });
      }
      if (clip.movement?.facingOffset !== undefined) {
        const note = document.createElement("p");
        note.className = "animation-note";
        note.textContent = "Cette animation est utilisée pour les déplacements sans la touche de course.";
        fields.append(note);
      }
      const status = document.createElement("p");
      status.className = "animation-note";
      status.role = "status";
      status.textContent = "Réglages appliqués pour cette session. Enregistrement indisponible.";
      status.hidden = true;
      fields.append(status);
      refresh.forEach((update) => update());
    }

    const initial = definitions.find((clip) => clip.id === (movement ? player.activeName : definitions[0]?.id));
    if (initial) select(initial);
    redraw.push(() => { if (selectedClip) select(selectedClip); });
  }

  let frame = 0;
  const updateCursor = () => {
    if (signal.aborted) return;
    updateTimelineProgress();
    frame = requestAnimationFrame(updateCursor);
  };
  frame = requestAnimationFrame(updateCursor);
  signal.addEventListener("abort", () => cancelAnimationFrame(frame), { once: true });

  const pause = requireElement<HTMLButtonElement>("pauseButton");
  const status = requireElement("animationStatus");
  function updateStatus(): void {
    const label = getAnimationDefinition(player.activeName)?.displayName;
    status.textContent = label ? `Animation : ${label}` : "";
    pause.textContent = player.isPaused ? "Reprendre" : "Pause";
  }
  pause.disabled = false;
  pause.addEventListener("click", () => { player.togglePause(); updateStatus(); }, { signal });
  updateStatus();
  return updateStatus;
}
