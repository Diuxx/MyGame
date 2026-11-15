import type { AnimationPlayer } from "../character/animations";
import { createTransitionSettings, type TransitionSettings } from "../character/transitionSettings";
import { requireElement } from "../ui/dom";

const STORAGE_KEY = "mygame.playground.animation-transitions.v1";

export interface TransitionControls {
  get(): TransitionSettings;
  set(value: TransitionSettings): void;
  reset(): void;
}

export function bindTransitionTools(player: AnimationPlayer, signal: AbortSignal): TransitionControls {
  const status = requireElement<HTMLParagraphElement>("transitionStatus");
  const controls = [
    { id: "transitionMove", output: "transitionMoveValue", name: "move" },
    { id: "transitionIdle", output: "transitionIdleValue", name: "idle" },
    { id: "transitionSlowDown", output: "transitionSlowDownValue", name: "slowDown" },
  ] as const;
  let settings = createTransitionSettings();
  const inputs = controls.map(({ id, output, name }) => ({
    name,
    input: requireElement<HTMLInputElement>(id),
    output: requireElement<HTMLOutputElement>(output),
  }));

  function refresh(): void {
    player.setTransitions(settings);
    for (const { name, input, output } of inputs) {
      input.value = String(settings[name]);
      output.textContent = `${settings[name].toFixed(2)} s`;
    }
  }

  function persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      status.textContent = "";
    } catch (error) {
      status.textContent = `Transitions temporaires : ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) settings = createTransitionSettings(JSON.parse(saved));
  } catch (error) {
    status.textContent = `Transitions non chargées : ${error instanceof Error ? error.message : String(error)}`;
  }
  refresh();

  for (const { name, input } of inputs) {
    input.addEventListener("input", () => {
      settings = createTransitionSettings({ ...settings, [name]: input.valueAsNumber });
      refresh();
      persist();
    }, { signal });
  }
  return {
    get: () => ({ ...settings }),
    set(value) {
      settings = createTransitionSettings(value);
      refresh();
      persist();
    },
    reset() {
      settings = createTransitionSettings();
      refresh();
      try {
        localStorage.removeItem(STORAGE_KEY);
        status.textContent = "";
      } catch (error) {
        status.textContent = `Réinitialisation locale impossible : ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };
}
