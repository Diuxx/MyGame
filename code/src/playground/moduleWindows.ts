import { requireElement } from "../ui/dom";

export function bindModuleWindows(signal: AbortSignal): void {
  const sidebar = requireElement<HTMLElement>("playgroundPanel");
  const dock = requireElement<HTMLElement>("playgroundModules");
  const options = { signal };
  sidebar.querySelectorAll<HTMLButtonElement>("button[aria-controls]").forEach((launcher) => {
    const panel = requireElement<HTMLElement>(launcher.getAttribute("aria-controls") ?? "");
    const close = panel.querySelector<HTMLButtonElement>(".module-close");
    if (!close) throw new Error(`Bouton de fermeture manquant : ${panel.id}`);

    const setOpen = (open: boolean): void => {
      panel.hidden = !open;
      launcher.setAttribute("aria-expanded", String(open));
      dock.hidden = !dock.querySelector(".module-window:not([hidden])");
      if (open) {
        // Keep the most recently opened module within reach in the scrollable dock.
        dock.prepend(panel);
        close.focus();
      } else {
        launcher.focus();
      }
    };

    launcher.addEventListener("click", () => setOpen(panel.hidden), options);
    close.addEventListener("click", () => setOpen(false), options);
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !event.defaultPrevented && !(event.target instanceof HTMLSelectElement)) {
        setOpen(false);
      }
    }, options);
  });
}
