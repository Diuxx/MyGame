import { DEFAULT_HERO_KEYS, heroKeyLabel as label, type HeroKeys } from "../character/heroInput";
import { requireElement } from "../ui/dom";

const STORAGE_KEY = "mon-rpg.playground.keys";
const KEYS = [..."abcdefghijklmnopqrstuvwxyz0123456789", "shift", "arrowup", "arrowdown", "arrowleft", "arrowright"];
const FIELDS = {
  forward: "keyForward", backward: "keyBackward", left: "keyLeft", right: "keyRight", run: "keyRun",
  spell2: "keySpell2", spell3: "keySpell3", spell4: "keySpell4", interact: "keyInteract",
  nextTarget: "keyNextTarget", cancelTarget: "keyCancelTarget",
} satisfies Record<keyof HeroKeys, string>;
const ACTIONS = Object.keys(FIELDS) as (keyof HeroKeys)[];

export function bindControlSettings(setBindings: (keys: HeroKeys) => void, signal: AbortSignal): () => HeroKeys {
  const status = requireElement("bindingsStatus");
  const hint = requireElement("keyboardHint");
  const fields = ACTIONS.map((action) => {
    const field = requireElement<HTMLSelectElement>(FIELDS[action]);
    field.replaceChildren(...KEYS.map((key) => new Option(label(key), key)));
    return { action, field };
  });
  let keys = { ...DEFAULT_HERO_KEYS };
  try {
    type StoredHeroKeys = Partial<HeroKeys> & { spell1?: unknown };
    const stored: StoredHeroKeys | null = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (stored) {
      const saved: Partial<HeroKeys> = "spell1" in stored
        ? {
          ...stored,
          spell2: typeof stored.spell1 === "string" ? stored.spell1 : undefined,
          spell3: stored.spell2,
        }
        : stored;
      const used = new Set<string>();
      const missing = ACTIONS.filter((action) => {
        const key = saved[action];
        if (!key || !KEYS.includes(key) || used.has(key)) return true;
        used.add(key);
        keys[action] = key;
        return false;
      });
      for (const action of missing) {
        const preferred = DEFAULT_HERO_KEYS[action];
        keys[action] = used.has(preferred) ? KEYS.find((key) => !used.has(key))! : preferred;
        used.add(keys[action]);
      }
    }
  } catch {
    // Storage may be unavailable or contain invalid data. Start with the defaults.
  }

  function apply(save: boolean): void {
    setBindings(keys);
    for (const { action, field } of fields) field.value = keys[action];
    const directions = [keys.forward, keys.left, keys.backward, keys.right].map(label).join(" ");
    hint.textContent = `${directions} · Déplacement relatif à la caméra | ${label(keys.run)} · Course`;
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
  return () => keys;
}
