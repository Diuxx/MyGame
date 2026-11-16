import type { Scene, TransformNode } from "@babylonjs/core";
import { panCameraFocus } from "../world/cameraMath.ts";
import type { CameraControls } from "../world/scene.ts";
import { terrainBounds } from "../world/maps/validation.ts";
import type { MapDefinition } from "../world/maps/types.ts";

const PAN_SPEED = 14; // world units per second
const MAX_DELTA_SECONDS = 0.05;
type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
const ARROW_KEYS = new Set<string>(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

function isFormControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || !!target.closest("input, textarea, select, [contenteditable]");
}

/** Camera navigation belongs to the editor, not the shared character controller. */
export function bindEditorCameraNavigation(
  scene: Scene,
  camera: Pick<CameraControls, "alpha" | "focus" | "follow">,
  hero: TransformNode,
  getMap: () => MapDefinition | undefined,
  signal: AbortSignal,
) {
  const held = new Set<ArrowKey>();
  let enabled = false;
  const reset = () => held.clear();

  window.addEventListener("keydown", (event) => {
    if (!enabled || !ARROW_KEYS.has(event.key) || event.ctrlKey || event.altKey ||
        event.metaKey || isFormControl(event.target)) return;
    // Reserve arrow keys for the editor even if hero bindings were customized.
    event.preventDefault();
    event.stopImmediatePropagation();
    held.add(event.key as ArrowKey);
  }, { capture: true, signal });

  window.addEventListener("keyup", (event) => {
    if (!ARROW_KEYS.has(event.key)) return;
    held.delete(event.key as ArrowKey);
    if (enabled && !isFormControl(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true, signal });

  window.addEventListener("blur", reset, { signal });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) reset();
  }, { signal });
  window.addEventListener("focusin", (event) => {
    if (isFormControl(event.target)) reset();
  }, { signal });

  const observer = scene.onBeforeRenderObservable.add(() => {
    if (!enabled || !held.size || document.hidden) return;
    const horizontal = Number(held.has("ArrowRight")) - Number(held.has("ArrowLeft"));
    const vertical = Number(held.has("ArrowUp")) - Number(held.has("ArrowDown"));
    const delta = Math.min(scene.getEngine().getDeltaTime() / 1000, MAX_DELTA_SECONDS);
    const bounds = getMap() ? terrainBounds(getMap()!) : undefined;
    const next = panCameraFocus(camera.focus, horizontal, vertical, camera.alpha,
      PAN_SPEED * delta, bounds);
    camera.follow(next.x, next.z);
  });

  signal.addEventListener("abort", () => {
    reset();
    scene.onBeforeRenderObservable.remove(observer);
  }, { once: true });

  return {
    setEnabled(next: boolean): void {
      if (enabled === next) return;
      enabled = next;
      reset();
      if (!enabled) camera.follow(hero.position.x, hero.position.z);
    },
  };
}
