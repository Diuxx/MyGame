const DIRECTION_KEYS = ["z", "q", "s", "d"];

export function bindHeroInput(canvas: HTMLCanvasElement, attack: () => void, signal: AbortSignal) {
  const pressed = new Set<string>();
  const taps = new Set<string>();
  let pointer: { clientX: number; clientY: number } | undefined;
  const options = { signal };
  const clearAim = () => { pointer = undefined; };
  const clearInput = () => {
    pressed.clear();
    taps.clear();
    clearAim();
  };

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") pointer = event;
  }, options);
  canvas.addEventListener("pointerleave", clearAim, options);
  window.addEventListener("blur", clearInput, options);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInput();
  }, options);
  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.matches("input:not([type=range]):not([type=checkbox]), textarea, select"))) return;
    const key = event.key.toLowerCase();
    if (key === "e" && !event.repeat) attack();
    if (DIRECTION_KEYS.includes(key) && !event.repeat) {
      pressed.add(key);
      taps.add(key);
    }
    if (key === "shift") pressed.add(key);
  }, options);
  window.addEventListener("keyup", (event) => pressed.delete(event.key.toLowerCase()), options);

  return {
    clearAim,
    get pointer() { return pointer; },
    readMovement() {
      const axis = (positive: string, negative: string) => {
        const keys = pressed.has(positive) || pressed.has(negative) ? pressed : taps;
        return Number(keys.has(positive)) - Number(keys.has(negative));
      };
      const horizontal = axis("d", "q");
      const vertical = axis("z", "s");
      taps.clear();
      return { horizontal, vertical, running: pressed.has("shift") && vertical >= 0 };
    },
  };
}
