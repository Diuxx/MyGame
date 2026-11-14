import {
  Color3, MeshBuilder, StandardMaterial, TransformNode, type Scene, type ShadowGenerator,
} from "@babylonjs/core";
import { createWorldInteractions } from "./worldInteractions";
import type { WorldInteraction } from "./editorSchema";
import type { MapPosition } from "./types";

/** Small, data-driven prototypes. No scripts are evaluated from map JSON. */
export function createWorldInteractionScene(
  scene: Scene, parent: TransformNode,
  definitions: readonly WorldInteraction[], shadows?: ShadowGenerator,
) {
  const rules = createWorldInteractions(definitions);
  const items = new Map<string, ReturnType<typeof MeshBuilder.CreateBox>>();
  const materials: StandardMaterial[] = [];
  for (const entry of definitions) {
    const mesh = entry.kind === "pickup"
      ? MeshBuilder.CreateSphere("pickup:" + entry.id, { diameter: 0.52, segments: 8 }, scene)
      : MeshBuilder.CreateBox("interaction:" + entry.id, { size: 0.7 }, scene);
    mesh.parent = parent;
    mesh.position.set(entry.position[0], entry.position[1] + 0.45, entry.position[2]);
    const material = new StandardMaterial("interaction-mat:" + entry.id, scene);
    material.diffuseColor = Color3.FromHexString(entry.kind === "pickup" ? "#F4C95C" :
      entry.kind === "inspect" ? "#6CBDAE" : "#A986D3");
    material.emissiveColor = material.diffuseColor.scale(0.25);
    mesh.material = material;
    mesh.isPickable = false;
    materials.push(material);
    items.set(entry.id, mesh);
    shadows?.addShadowCaster(mesh, false);
  }
  return {
    nearby: rules.nearby,
    inventory: rules.getInventory,
    interact(hero: MapPosition) {
      const result = rules.interact(hero);
      if (result?.kind === "pickup") items.get(result.id)?.setEnabled(false);
      return result;
    },
    dispose() {
      for (const mesh of items.values()) {
        shadows?.removeShadowCaster(mesh, false);
        mesh.dispose();
      }
      for (const material of materials) material.dispose();
    },
  };
}
