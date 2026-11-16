import {
  Color3, DirectionalLight, HemisphericLight, PointLight, ShadowGenerator,
  SpotLight, Vector3, type Scene,
} from "@babylonjs/core";
import type { EnvironmentSettings } from "./maps/environmentSettings";
import type { LightingSettings, MapLight } from "./maps/lightingSettings";
import { createEnvironmentController } from "./environmentController";

type LocalLight = PointLight | SpotLight | DirectionalLight | HemisphericLight;
interface LightInstance { light: LocalLight; shadow?: ShadowGenerator }

/**
 * Owns only local map lights and their shadows. The existing scene sun, sky
 * and hero shadow casters remain owned by the global environment.
 */
export function createLightingController(
  scene: Scene, sun: DirectionalLight, sky: HemisphericLight, globalShadows: ShadowGenerator,
) {
  const environment = createEnvironmentController(scene, sun, sky, globalShadows);
  let locals: LightInstance[] = [];
  let disposed = false;

  function createLocalLight(config: MapLight): LightInstance {
    const position = Vector3.FromArray([...config.position]);
    const direction = Vector3.FromArray([...config.direction]).normalize();
    const name = "map-light:" + config.id;
    let light: LocalLight;
    switch (config.type) {
      case "point":
        light = new PointLight(name, position, scene);
        light.range = config.range;
        break;
      case "spot":
        light = new SpotLight(name, position, direction, config.angle * Math.PI / 180,
          config.exponent, scene);
        light.range = config.range;
        break;
      case "directional":
        light = new DirectionalLight(name, direction, scene);
        light.position = position;
        break;
      case "hemispheric":
        light = new HemisphericLight(name, direction, scene);
        light.groundColor = Color3.FromHexString(config.groundColor);
        break;
    }
    light.diffuse = Color3.FromHexString(config.color);
    light.intensity = config.intensity;
    light.setEnabled(config.enabled);

    let shadow: ShadowGenerator | undefined;
    if (config.enabled && config.shadows.enabled && config.type !== "hemispheric") {
      try {
        shadow = new ShadowGenerator(config.shadows.resolution,
          light as PointLight | SpotLight | DirectionalLight);
        shadow.usePercentageCloserFiltering = true;
        shadow.darkness = config.shadows.darkness;
        // Share the global caster list so future placed meshes and enemies are included.
        const localMap = shadow.getShadowMap();
        const globalMap = globalShadows.getShadowMap();
        if (localMap && globalMap) localMap.renderList = globalMap.renderList;
      } catch (error) {
        shadow?.dispose();
        light.dispose();
        throw error;
      }
    }
    return { light, shadow };
  }

  function clearLocal(entries: LightInstance[]): void {
    for (const entry of entries) {
      entry.shadow?.dispose();
      entry.light.dispose();
    }
  }

  function apply(environmentSettings: EnvironmentSettings, lighting: LightingSettings): void {
    if (disposed) throw new Error("Contrôleur d'éclairage fermé.");
    const next: LightInstance[] = [];
    try {
      if (lighting.map.enabled) {
        for (const config of lighting.map.lights) next.push(createLocalLight(config));
      }
      environment.apply({
        ...environmentSettings,
        ambient: {
          color: lighting.world.ambient.color,
          intensity: lighting.world.ambient.intensity,
        },
        sun: {
          color: lighting.world.sun.color,
          intensity: lighting.world.sun.intensity,
          direction: lighting.world.sun.direction,
          shadows: lighting.world.sun.shadows,
        },
      });
      sky.groundColor = Color3.FromHexString(lighting.world.ambient.groundColor);
      sky.setEnabled(lighting.world.enabled && lighting.world.ambient.enabled);
      sun.setEnabled(lighting.world.enabled && lighting.world.sun.enabled);
    } catch (error) {
      clearLocal(next);
      throw error;
    }
    clearLocal(locals);
    locals = next;
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    clearLocal(locals);
    locals = [];
  }

  scene.onDisposeObservable.addOnce(dispose);
  return { apply, dispose };
}
