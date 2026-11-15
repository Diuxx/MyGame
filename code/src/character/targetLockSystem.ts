import {
  Color3, MeshBuilder, StandardMaterial, type Scene, type TransformNode,
} from "@babylonjs/core";
import { selectTarget, type TargetCandidate, type TargetPosition } from "./targetSelection.ts";
import {
  createTargetingSettings, type TargetingSettings,
} from "./targetingSettings.ts";

export interface TargetingMotion {
  target: TargetPosition;
  movementReference: TargetingSettings["movementReference"];
  turnSpeed: number;
}

/**
 * Babylon presentation and runtime target state.
 * Targets are read from the existing enemy simulations, never from meshes/picking.
 */
export function createTargetLockSystem(
  scene: Scene,
  hero: TransformNode,
  listCandidates: () => readonly TargetCandidate[],
  isAvailable: () => boolean,
  signal: AbortSignal,
) {
  let settings = createTargetingSettings();
  let target: TargetCandidate | undefined;
  let disposed = false;

  const ringMaterial = new StandardMaterial("target-lock-ring-material", scene);
  ringMaterial.disableLighting = true;
  ringMaterial.emissiveColor = Color3.FromHexString("#E54B54");
  ringMaterial.alpha = 0.95;
  const targetRing = MeshBuilder.CreateTorus("target-lock-ring", {
    diameter: 1.6, thickness: 0.075, tessellation: 48,
  }, scene);
  targetRing.material = ringMaterial;
  targetRing.isPickable = false;
  targetRing.setEnabled(false);

  const debugMaterial = new StandardMaterial("target-lock-detection-material", scene);
  debugMaterial.disableLighting = true;
  debugMaterial.emissiveColor = Color3.FromHexString("#F3A65B");
  debugMaterial.alpha = 0.45;
  const detectionRing = MeshBuilder.CreateTorus("target-lock-detection", {
    diameter: 2, thickness: 0.025, tessellation: 72,
  }, scene);
  detectionRing.material = debugMaterial;
  detectionRing.isPickable = false;
  detectionRing.setEnabled(false);

  function update(): void {
    if (disposed) return;
    const active = settings.enabled && isAvailable();
    target = active ? selectTarget(
      { x: hero.position.x, z: hero.position.z },
      listCandidates(), target?.id, settings,
    ) : undefined;
    targetRing.setEnabled(active && settings.showTargetRing && !!target);
    if (target && targetRing.isEnabled()) {
      targetRing.position.set(target.x, target.groundY + 0.075, target.z);
      const diameterScale = Math.max(0.4, target.radius) / 0.8;
      targetRing.scaling.set(diameterScale, 1, diameterScale);
    }
    detectionRing.setEnabled(active && settings.showDebugRadius);
    if (detectionRing.isEnabled()) {
      detectionRing.position.set(hero.position.x, hero.position.y + 0.065, hero.position.z);
      detectionRing.scaling.set(settings.acquireRadius, 1, settings.acquireRadius);
    }
  }

  const observer = scene.onBeforeRenderObservable.add(update);
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    scene.onBeforeRenderObservable.remove(observer);
    targetRing.dispose();
    detectionRing.dispose();
    ringMaterial.dispose();
    debugMaterial.dispose();
    target = undefined;
  }
  signal.addEventListener("abort", dispose, { once: true });
  scene.onDisposeObservable.addOnce(dispose);

  return {
    get settings(): TargetingSettings { return { ...settings }; },
    get target(): TargetCandidate | undefined { return target; },
    get motion(): TargetingMotion | undefined {
      return target && settings.enabled && isAvailable() ? {
        target: { x: target.x, z: target.z },
        movementReference: settings.movementReference,
        turnSpeed: settings.turnSpeed,
      } : undefined;
    },
    setSettings(value: TargetingSettings): void {
      settings = createTargetingSettings(value);
      update();
    },
    dispose,
  };
}
