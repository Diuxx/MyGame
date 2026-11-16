import {
  Color3, MeshBuilder, StandardMaterial, type AbstractMesh, type Scene, type TransformNode,
} from "@babylonjs/core";
import { requireElement } from "../ui/dom";
import { DEFAULT_ENVIRONMENT } from "../world/maps/environmentSettings";
import { defaultLighting, defaultMapLight, MAX_MAP_LIGHTS,
  type LightingSettings, type MapLight, type MapLightType } from "../world/maps/lightingSettings";
import type { createMapSystem } from "../world/maps/mapSystem";

type MapSystem = ReturnType<typeof createMapSystem>;
const LIGHT_TYPES: MapLightType[] = ["point", "spot", "directional", "hemispheric"];

function input(id: string): HTMLInputElement {
  return requireElement<HTMLInputElement>(id);
}
function select(id: string): HTMLSelectElement {
  return requireElement<HTMLSelectElement>(id);
}
function value(id: string): number {
  const control = input(id);
  if (control.value.trim() === "" || !Number.isFinite(control.valueAsNumber)) {
    throw new Error("Valeur numérique invalide : " + id);
  }
  return control.valueAsNumber;
}
function fill(id: string, numberOrColor: string | number): void {
  input(id).value = String(numberOrColor);
}

function generateId(lights: readonly MapLight[]): string {
  const used = new Set(lights.map(({ id }) => id));
  for (let index = 1; index <= MAX_MAP_LIGHTS + 1; index++) {
    const id = "light-" + index;
    if (!used.has(id)) return id;
  }
  throw new Error("Nombre maximal de lumières atteint.");
}

/** Playground adapter: edits the same map definition that exportJson serializes. */
export function bindLightingTools(
  scene: Scene, maps: MapSystem, hero: TransformNode, signal: AbortSignal,
): void {
  const status = requireElement<HTMLElement>("lightingStatus");
  const markerToggle = input("lightingShowMarkers");
  const list = select("lightingLightSelect");
  const lightFields = requireElement<HTMLElement>("lightingLightFields");
  const markers: AbstractMesh[] = [];
  const markerMaterials: StandardMaterial[] = [];
  let currentMap = maps.world;
  let selectedId: string | undefined;

  function currentLighting(): LightingSettings {
    const map = maps.world?.definition;
    if (!map) throw new Error("Aucune map chargée.");
    return structuredClone(map.lighting ??
      defaultLighting(map.environment ?? DEFAULT_ENVIRONMENT));
  }

  function selectedLight(lighting: LightingSettings): MapLight | undefined {
    return lighting.map.lights.find((light) => light.id === selectedId);
  }

  function disposeMarkers(): void {
    for (const mesh of markers) mesh.dispose();
    for (const material of markerMaterials) material.dispose();
    markers.length = 0;
    markerMaterials.length = 0;
  }

  function renderMarkers(lighting: LightingSettings): void {
    disposeMarkers();
    if (!lighting.map.enabled) return;
    for (const light of lighting.map.lights) {
      const material = new StandardMaterial("light-marker-material:" + light.id, scene);
      material.emissiveColor = Color3.FromHexString(light.color);
      material.disableLighting = true;
      material.specularColor = Color3.Black();
      markerMaterials.push(material);
      const mesh = MeshBuilder.CreateSphere("light-editor-marker:" + light.id,
        { diameter: light.id === selectedId ? 0.55 : 0.35, segments: 8 }, scene);
      mesh.position.set(...light.position);
      mesh.material = material;
      mesh.isPickable = false;
      markers.push(mesh);
      if (light.type === "point" || light.type === "spot") {
        const ring = MeshBuilder.CreateTorus("light-editor-range:" + light.id, {
          diameter: light.range * 2, thickness: 0.025, tessellation: 48,
        }, scene);
        ring.position.set(light.position[0],
          (maps.world?.definition.terrain.origin[1] ?? 0) + 0.04, light.position[2]);
        ring.material = material;
        ring.isPickable = false;
        markers.push(ring);
      }
    }
    setMarkerVisibility();
  }

  function setMarkerVisibility(): void {
    const visible = maps.isEditing && markerToggle.checked;
    for (const mesh of markers) mesh.setEnabled(visible);
  }

  function sync(): void {
    const lighting = currentLighting();
    const { world, map } = lighting;
    input("lightingWorldEnabled").checked = world.enabled;
    input("lightingSunEnabled").checked = world.sun.enabled;
    input("lightingAmbientEnabled").checked = world.ambient.enabled;
    input("lightingSunShadows").checked = world.sun.shadows.enabled;
    fill("lightingSunColor", world.sun.color);
    fill("lightingSunIntensity", world.sun.intensity);
    ["lightingSunX", "lightingSunY", "lightingSunZ"].forEach((id, i) =>
      fill(id, world.sun.direction[i]));
    select("lightingSunResolution").value = String(world.sun.shadows.resolution);
    fill("lightingSunDarkness", world.sun.shadows.darkness);
    fill("lightingAmbientColor", world.ambient.color);
    fill("lightingAmbientGroundColor", world.ambient.groundColor);
    fill("lightingAmbientIntensity", world.ambient.intensity);
    input("lightingMapEnabled").checked = map.enabled;
    list.replaceChildren(...map.lights.map((light) => {
      const option = new Option(light.id + " — " + light.type, light.id);
      return option;
    }));
    if (!selectedLight(lighting)) selectedId = map.lights[0]?.id;
    list.value = selectedId ?? "";
    const light = selectedLight(lighting);
    lightFields.hidden = !light;
    input("lightingDuplicate").disabled = !light || map.lights.length >= MAX_MAP_LIGHTS;
    input("lightingRemove").disabled = !light;
    input("lightingAdd").disabled = map.lights.length >= MAX_MAP_LIGHTS;
    if (light) {
      input("lightingLightEnabled").checked = light.enabled;
      select("lightingLightType").value = light.type;
      fill("lightingLightColor", light.color);
      fill("lightingLightIntensity", light.intensity);
      fill("lightingLightRange", light.range);
      ["lightingLightX", "lightingLightY", "lightingLightZ"].forEach((id, i) =>
        fill(id, light.position[i]));
      ["lightingLightDirX", "lightingLightDirY", "lightingLightDirZ"].forEach((id, i) =>
        fill(id, light.direction[i]));
      fill("lightingLightAngle", light.angle);
      fill("lightingLightExponent", light.exponent);
      fill("lightingLightGround", light.groundColor);
      input("lightingLightShadows").checked = light.shadows.enabled;
      select("lightingLightResolution").value = String(light.shadows.resolution);
      fill("lightingLightDarkness", light.shadows.darkness);
      requireElement("lightingRangeField").hidden =
        light.type !== "point" && light.type !== "spot";
      for (const element of document.querySelectorAll<HTMLElement>(".lighting-direction-field")) {
        element.hidden = light.type !== "directional" && light.type !== "spot" &&
          light.type !== "hemispheric";
      }
      requireElement("lightingAngleField").hidden = light.type !== "spot";
      requireElement("lightingExponentField").hidden = light.type !== "spot";
      requireElement("lightingGroundField").hidden = light.type !== "hemispheric";
      input("lightingLightShadows").disabled = light.type === "hemispheric";
      requireElement("lightingShadowFields").hidden = light.type === "hemispheric";
    }
    renderMarkers(lighting);
  }

  function save(change: (lighting: LightingSettings) => void): void {
    try {
      const map = maps.world;
      if (!map) throw new Error("Aucune map chargée.");
      const lighting = currentLighting();
      change(lighting);
      map.editor.setLighting(lighting);
      sync();
      status.textContent = "Éclairage mis à jour. Exporter la map JSON pour conserver les changements.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  function editWorld(): void {
    save((lighting) => {
      const { world } = lighting;
      world.enabled = input("lightingWorldEnabled").checked;
      world.sun.enabled = input("lightingSunEnabled").checked;
      world.sun.color = input("lightingSunColor").value;
      world.sun.intensity = value("lightingSunIntensity");
      world.sun.direction = [value("lightingSunX"), value("lightingSunY"), value("lightingSunZ")];
      world.sun.shadows.enabled = input("lightingSunShadows").checked;
      world.sun.shadows.resolution = Number(select("lightingSunResolution").value) as 512 | 1024 | 2048;
      world.sun.shadows.darkness = value("lightingSunDarkness");
      world.ambient.enabled = input("lightingAmbientEnabled").checked;
      world.ambient.color = input("lightingAmbientColor").value;
      world.ambient.groundColor = input("lightingAmbientGroundColor").value;
      world.ambient.intensity = value("lightingAmbientIntensity");
    });
  }

  function editLocal(): void {
    save((lighting) => {
      const light = selectedLight(lighting);
      if (!light) throw new Error("Sélectionner une lumière locale.");
      const type = select("lightingLightType").value;
      if (!LIGHT_TYPES.includes(type as MapLightType)) throw new Error("Type de lumière inconnu.");
      light.type = type as MapLightType;
      light.enabled = input("lightingLightEnabled").checked;
      light.color = input("lightingLightColor").value;
      light.intensity = value("lightingLightIntensity");
      light.range = value("lightingLightRange");
      light.position = [value("lightingLightX"), value("lightingLightY"), value("lightingLightZ")];
      light.direction = [value("lightingLightDirX"), value("lightingLightDirY"), value("lightingLightDirZ")];
      light.angle = value("lightingLightAngle");
      light.exponent = value("lightingLightExponent");
      light.groundColor = input("lightingLightGround").value;
      light.shadows.enabled = type !== "hemispheric" && input("lightingLightShadows").checked;
      light.shadows.resolution = Number(select("lightingLightResolution").value) as 512 | 1024 | 2048;
      light.shadows.darkness = value("lightingLightDarkness");
    });
  }

  const worldControls = [
    "lightingWorldEnabled", "lightingSunEnabled", "lightingSunShadows",
    "lightingSunColor", "lightingSunIntensity", "lightingSunX", "lightingSunY",
    "lightingSunZ", "lightingSunResolution", "lightingSunDarkness",
    "lightingAmbientEnabled", "lightingAmbientColor", "lightingAmbientGroundColor",
    "lightingAmbientIntensity",
  ];
  for (const id of worldControls) {
    requireElement(id).addEventListener("change", editWorld, { signal });
  }
  requireElement("lightingMapEnabled").addEventListener("change", () =>
    save((lighting) => { lighting.map.enabled = input("lightingMapEnabled").checked; }), { signal });
  const localControls = [
    "lightingLightEnabled", "lightingLightType", "lightingLightColor",
    "lightingLightIntensity", "lightingLightRange", "lightingLightX", "lightingLightY",
    "lightingLightZ", "lightingLightDirX", "lightingLightDirY", "lightingLightDirZ",
    "lightingLightAngle", "lightingLightExponent", "lightingLightGround",
    "lightingLightShadows", "lightingLightResolution", "lightingLightDarkness",
  ];
  for (const id of localControls) {
    requireElement(id).addEventListener("change", editLocal, { signal });
  }
  list.addEventListener("change", () => {
    selectedId = list.value;
    sync();
  }, { signal });
  markerToggle.addEventListener("change", setMarkerVisibility, { signal });

  requireElement("lightingAdd").addEventListener("click", () => {
    save((lighting) => {
      if (lighting.map.lights.length >= MAX_MAP_LIGHTS) throw new Error("Maximum 32 lumières.");
      const type = select("lightingCreateType").value as MapLightType;
      if (!LIGHT_TYPES.includes(type)) throw new Error("Type de lumière inconnu.");
      const id = generateId(lighting.map.lights);
      const light = defaultMapLight(id, type);
      light.position = [hero.position.x, hero.position.y + 2, hero.position.z];
      lighting.map.lights.push(light);
      selectedId = id;
    });
  }, { signal });
  requireElement("lightingDuplicate").addEventListener("click", () => {
    save((lighting) => {
      const light = selectedLight(lighting);
      if (!light) throw new Error("Sélectionner une lumière.");
      if (lighting.map.lights.length >= MAX_MAP_LIGHTS) throw new Error("Maximum 32 lumières.");
      const id = generateId(lighting.map.lights);
      lighting.map.lights.push({ ...structuredClone(light), id,
        position: [light.position[0] + 1, light.position[1], light.position[2]] });
      selectedId = id;
    });
  }, { signal });
  requireElement("lightingRemove").addEventListener("click", () => {
    save((lighting) => {
      lighting.map.lights = lighting.map.lights.filter((light) => light.id !== selectedId);
      selectedId = lighting.map.lights[0]?.id;
    });
  }, { signal });
  requireElement("lightingMoveToHero").addEventListener("click", () => {
    save((lighting) => {
      const light = selectedLight(lighting);
      if (!light) return;
      light.position = [hero.position.x, hero.position.y + 2, hero.position.z];
    });
  }, { signal });

  const observer = scene.onBeforeRenderObservable.add(() => {
    if (currentMap !== maps.world) {
      currentMap = maps.world;
      selectedId = undefined;
      status.textContent = "Éclairage chargé depuis la map active.";
      sync();
    }
    setMarkerVisibility();
  });
  signal.addEventListener("abort", () => {
    scene.onBeforeRenderObservable.remove(observer);
    disposeMarkers();
  }, { once: true });
  sync();
}
