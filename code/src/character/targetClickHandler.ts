import type { Scene } from "@babylonjs/core";
import type { createTargetLockSystem } from "./targetLockSystem.ts";

type TargetLockSystem = ReturnType<typeof createTargetLockSystem>;

/**
 * Convert a canvas click to a world ray. All target eligibility and picking
 * are delegated to the Target Lock system, shared by Gameplay and Playground.
 */
export function createTargetClickHandler(
  scene: Scene, canvas: HTMLCanvasElement, targeting: TargetLockSystem,
): (event: PointerEvent) => boolean {
  return (event) => {
    if (!scene.activeCamera) return false;
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) return false;
    const ray = scene.createPickingRay(x, y, null, scene.activeCamera);
    return targeting.lockFromRay({ origin: ray.origin, direction: ray.direction });
  };
}
