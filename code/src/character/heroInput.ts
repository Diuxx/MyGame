export const DEFAULT_HERO_KEYS = {
  forward: "z", left: "q", backward: "s", right: "d", run: "shift",
  spell1: "a", spell2: "e", spell3: "r", spell4: "1", interact: "f",
};
export type HeroKeys = typeof DEFAULT_HERO_KEYS;
export const HERO_SPELL_SLOTS = ["spell1", "spell2", "spell3", "spell4"] as const;
export type HeroSpellSlot = typeof HERO_SPELL_SLOTS[number];

const KEY_LABELS: Record<string, string> = { shift: "Maj", arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→" };
export const heroKeyLabel = (key: string) => KEY_LABELS[key] ?? key.toUpperCase();

function bindingKey(event: KeyboardEvent): string {
  // The top-row number keys can emit symbols on AZERTY layouts.
  return /^Digit[0-9]$/.test(event.code) ? event.code.slice(-1) : event.key.toLowerCase();
}

export function bindHeroInput(
  canvas: HTMLCanvasElement,
  attack: () => void,
  dodge: () => void,
  signal: AbortSignal,
  spell: (slot: HeroSpellSlot) => void,
  interact: () => void,
) {
  const pressed = new Set<string>();
  const taps = new Set<string>();
  let bindings = DEFAULT_HERO_KEYS;
  const options = { signal };
  const clearInput = () => {
    pressed.clear();
    taps.clear();
  };
  const axis = (positive: string, negative: string, heldOnly: boolean) => {
    const keys = heldOnly || pressed.has(positive) || pressed.has(negative) ? pressed : taps;
    return Number(keys.has(positive)) - Number(keys.has(negative));
  };

  canvas.addEventListener("contextmenu", (event) => event.preventDefault(), options);
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || (event.button !== 0 && event.button !== 2)) return;
    canvas.focus({ preventScroll: true });
    if (event.button === 0) attack();
    else dodge();
  }, options);
  window.addEventListener("blur", clearInput, options);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInput();
  }, options);
  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.matches("input:not([type=range]):not([type=checkbox]), textarea, select"))) return;
    const key = bindingKey(event);
    const slot = HERO_SPELL_SLOTS.find((id) => bindings[id] === key);
    if (slot || key === bindings.interact) {
      if (event.target instanceof HTMLInputElement) return;
      event.preventDefault();
      if (!event.repeat) {
        if (slot) spell(slot);
        else interact();
      }
      return;
    }
    const direction = [bindings.forward, bindings.left, bindings.backward, bindings.right].includes(key);
    if (key.startsWith("arrow") && (direction || key === bindings.run)) {
      if (event.target instanceof HTMLInputElement) return;
      event.preventDefault();
    }
    if (!event.repeat && direction) {
      pressed.add(key);
      taps.add(key);
    }
    if (key === bindings.run) pressed.add(key);
  }, options);
  window.addEventListener("keyup", (event) => pressed.delete(bindingKey(event)), options);

  return {
    clearInput,
    setBindings(next: HeroKeys) {
      bindings = next;
      pressed.clear();
      taps.clear();
    },
    readMovement(heldOnly = false) {
      const horizontal = axis(bindings.right, bindings.left, heldOnly);
      const vertical = axis(bindings.forward, bindings.backward, heldOnly);
      taps.clear();
      return { horizontal, vertical, running: pressed.has(bindings.run) };
    },
  };
}
