export const DEFAULT_HERO_KEYS = {
  forward: "z", left: "q", backward: "s", right: "d", run: "shift",
};
export type HeroKeys = typeof DEFAULT_HERO_KEYS;

export function bindHeroInput(
  canvas: HTMLCanvasElement,
  attack: () => void,
  dodge: (horizontal: number, vertical: number) => void,
  signal: AbortSignal,
) {
  const pressed = new Set<string>();
  const taps = new Set<string>();
  let bindings = DEFAULT_HERO_KEYS;
  let pointer: { clientX: number; clientY: number } | undefined;
  const options = { signal };
  const clearAim = () => { pointer = undefined; };
  const clearInput = () => {
    pressed.clear();
    taps.clear();
    clearAim();
  };
  const axis = (positive: string, negative: string, heldOnly: boolean) => {
    const keys = heldOnly || pressed.has(positive) || pressed.has(negative) ? pressed : taps;
    return Number(keys.has(positive)) - Number(keys.has(negative));
  };

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") pointer = event;
  }, options);
  canvas.addEventListener("pointerleave", clearAim, options);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault(), options);
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || (event.button !== 0 && event.button !== 2)) return;
    pointer = event;
    canvas.focus({ preventScroll: true });
    if (event.button === 0) attack();
    else dodge(
      Number(pressed.has(bindings.right)) - Number(pressed.has(bindings.left)),
      Number(pressed.has(bindings.forward)) - Number(pressed.has(bindings.backward)),
    );
  }, options);
  window.addEventListener("blur", clearInput, options);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInput();
  }, options);
  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.matches("input:not([type=range]):not([type=checkbox]), textarea, select"))) return;
    const key = event.key.toLowerCase();
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
  window.addEventListener("keyup", (event) => pressed.delete(event.key.toLowerCase()), options);

  return {
    clearAim,
    setBindings(next: HeroKeys) {
      bindings = next;
      pressed.clear();
      taps.clear();
    },
    get pointer() { return pointer; },
    readMovement(heldOnly = false) {
      const horizontal = axis(bindings.right, bindings.left, heldOnly);
      const vertical = axis(bindings.forward, bindings.backward, heldOnly);
      taps.clear();
      return { horizontal, vertical, running: pressed.has(bindings.run) };
    },
  };
}
