import {
  Color3, Color4, Scene, Vector3, type DirectionalLight, type HemisphericLight,
  type ShadowGenerator,
} from "@babylonjs/core";
import { DEFAULT_ENVIRONMENT, type EnvironmentSettings } from "./maps/environmentSettings";

/** Reconfigures the single sun/sky pair already created by environments.ts. */
export function createEnvironmentController(
  scene: Scene,
  sun: DirectionalLight,
  sky: HemisphericLight,
  shadows: ShadowGenerator,
) {
  function apply(value: EnvironmentSettings): void {
    scene.clearColor = Color4.FromHexString(value.background + "FF");
    sky.diffuse = Color3.FromHexString(value.ambient.color);
    sky.intensity = value.ambient.intensity;
    sun.diffuse = Color3.FromHexString(value.sun.color);
    sun.intensity = value.sun.intensity;
    sun.direction = Vector3.FromArray([...value.sun.direction]).normalize();
    sun.shadowEnabled = value.sun.shadows.enabled;
    shadows.darkness = value.sun.shadows.darkness;
    const shadowMap = shadows.getShadowMap();
    if (shadowMap && shadowMap.getSize().width !== value.sun.shadows.resolution) {
      shadowMap.resize(value.sun.shadows.resolution);
    }
    scene.fogMode = value.fog.enabled ? Scene.FOGMODE_EXP2 : Scene.FOGMODE_NONE;
    scene.fogColor = Color3.FromHexString(value.fog.color);
    scene.fogDensity = value.fog.density;
  }
  return { apply, reset: () => apply(DEFAULT_ENVIRONMENT) };
}
