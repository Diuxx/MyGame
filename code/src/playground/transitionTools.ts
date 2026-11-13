import type { AnimationPlayer } from "../character/animations";
import { createTransitionSettings, type TransitionSettings } from "../character/transitionSettings";
import { requireElement } from "../ui/dom";

const STORAGE_KEY = "mygame.playground.animation-transitions.v1";

export function bindTransitionTools(player: AnimationPlayer, signal: AbortSignal): void {
  const status = requireElement<HTMLParagraphElement>("transitionStatus");
  const controls = [
    { id: "transitionMove", output: "transitionMoveValue", name: "move" },
    { id: "transitionIdle", output: "transitionIdleValue", name: "idle" },
    { id: "transitionSlowDown", output: "transitionSlowDownValue", name: "slowDown" },
  ] as const;

  let settings = createTransitionSettings();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) settings = createTransitionSettings(JSON.parse(saved));
  } catch (error) {
    status.textContent = `Transitions non chargées : ${error instanceof Error ? error.message : String(error)}`;
  }
  player.setTransitions(settings);

  for (const { id, output, name } of controls) {
    const input = requireElement<HTMLInputElement>(id);
    const label = requireElement<HTMLOutputElement>(output);
    input.value = String(settings[name]);
    label.textContent = `${settings[name].toFixed(2)} s`;
    input.addEventListener("input", () => {
      settings = createTransitionSettings({ ...settings, [name]: input.valueAsNumber });
      player.setTransitions(settings);
      label.textContent = `${settings[name].toFixed(2)} s`;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        status.textContent = "";
      } catch (error) {
        status.textContent = `Transitions appliquées pour la session uniquement : ${error instanceof Error ? error.message : String(error)}`;
      }
    }, { signal });
  }
}
