import { DEFAULT_HERO_KEYS, type HeroKeys } from "../character/heroInput";
import { requireElement } from "../ui/dom";

const STORAGE_KEY = "mon-rpg.playground.keys";
const KEYS = [..."abcdefghijklmnopqrstuvwxyz0123456789", "shift", "arrowup", "arrowdown", "arrowleft", "arrowright"];
const LABELS: Record<string, string> = { shift: "Maj", arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→" };
const FIELDS = {
  forward: "keyForward", backward: "keyBackward", left: "keyLeft", right: "keyRight", run: "keyRun",
} satisfies Record<keyof HeroKeys, string>;
const ACTIONS = Object.keys(FIELDS) as (keyof HeroKeys)[];
const label = (key: string) => LABELS[key] ?? key.toUpperCase();

export function bindControlSettings(setBindings: (keys: HeroKeys) => void, signal: AbortSignal): void {
  const status = requireElement("bindingsStatus");
  const hint = requireElement("keyboardHint");
  const fields = ACTIONS.map((action) => {
    const field = requireElement<HTMLSelectElement>(FIELDS[action]);
    field.replaceChildren(...KEYS.map((key) => new Option(label(key), key)));
    return { action, field };
  });
  let keys = { ...DEFAULT_HERO_KEYS };
  try {
    const saved: Partial<HeroKeys> | null = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && ACTIONS.every((action) => KEYS.includes(saved[action] ?? "")) &&
        new Set(ACTIONS.map((action) => saved[action])).size === ACTIONS.length) {
      for (const action of ACTIONS) keys[action] = saved[action]!;
    }
  } catch {
    // Storage may be unavailable or contain invalid data. Start with the defaults.
  }

  function apply(save: boolean): void {
    setBindings(keys);
    for (const { action, field } of fields) field.value = keys[action];
    const directions = [keys.forward, keys.left, keys.backward, keys.right].map(label).join(" ");
    hint.textContent = `${directions} · Déplacement relatif à la souris | ${label(keys.run)} · Course`;
    if (!save) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
      status.hidden = true;
    } catch {
      status.textContent = "Touches appliquées pour cette session. Le navigateur ne permet pas de les enregistrer.";
      status.hidden = false;
    }
  }

  for (const { action, field } of fields) {
    field.addEventListener("change", () => {
      const previous = keys[action];
      const other = ACTIONS.find((name) => name !== action && keys[name] === field.value);
      keys = { ...keys, [action]: field.value };
      if (other) keys[other] = previous;
      apply(true);
    }, { signal });
  }
  requireElement("resetBindings").addEventListener("click", () => {
    keys = { ...DEFAULT_HERO_KEYS };
    apply(true);
  }, { signal });
  apply(false);
}
