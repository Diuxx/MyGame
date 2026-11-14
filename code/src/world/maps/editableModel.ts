import {
  Color3, StandardMaterial, Texture, TransformNode,
  type AbstractMesh, type InstantiatedEntries, type Scene, type ShadowGenerator,
} from "@babylonjs/core";
import type { VisualOverride } from "./editorSchema";
import type { MapModelRegistry } from "./modelRegistry";

/**
 * Owns one visual hierarchy. Its GLB instance, tint and texture are disposable,
 * while map collisions and the source GLB cache remain completely separate.
 */
export function createEditableModel(
  scene: Scene, parent: TransformNode, registry: MapModelRegistry,
  shadows: ShadowGenerator | undefined,
  defaultPath: string,
  fallback: (holder: TransformNode) => void,
  castsShadows = true,
  externalClips?: Readonly<Record<string, string>>,
) {
  let holder: TransformNode | undefined;
  let instance: InstantiatedEntries | null = null;
  let casters: AbstractMesh[] = [];
  let painted: StandardMaterial | undefined;
  let image: Texture | undefined;
  let blobUrl: string | undefined;
  let generation = 0;
  let disposed = false;

  function release(): void {
    for (const mesh of casters) shadows?.removeShadowCaster(mesh, false);
    casters = [];
    instance?.dispose();
    instance = null;
    // Imported original materials belong to the cached container, not the instance.
    holder?.dispose(false, false);
    holder = undefined;
    painted?.dispose();
    painted = undefined;
    image?.dispose();
    image = undefined;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = undefined;
  }

  function paint(visual?: VisualOverride, localTexture?: string): void {
    if (!holder) return;
    painted?.dispose();
    image?.dispose();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    image = undefined;
    painted = undefined;
    blobUrl = localTexture;
    holder.scaling.setAll(visual?.scale ?? 1);
    const texturePath = localTexture ?? visual?.texture;
    if (!visual?.tint && !texturePath) return;
    const mat = new StandardMaterial("editable-map-surface", scene);
    mat.diffuseColor = Color3.FromHexString(visual?.tint ?? "#FFFFFF");
    mat.specularColor = Color3.Black();
    if (texturePath) {
      image = new Texture(texturePath, scene);
      mat.diffuseTexture = image;
    }
    painted = mat;
    for (const mesh of holder.getChildMeshes()) {
      // Explicit override is preview-only: source GLB materials are never modified.
      if (!mesh.name.startsWith("missing-label:") && !mesh.name.startsWith("enemy-name")) {
        mesh.material = mat;
      }
    }
  }

  async function load(visual?: VisualOverride, localTextureUrl?: string): Promise<boolean | undefined> {
    if (disposed) throw new Error("Modèle déjà libéré.");
    const request = ++generation;
    const next = new TransformNode("editable-visual", scene);
    next.parent = parent;
    next.setEnabled(false);
    let imported: InstantiatedEntries | null = null;
    try {
      imported = await registry.instantiate(visual?.model ?? defaultPath, next, externalClips);
      if (disposed || request !== generation) {
        imported?.dispose();
        next.dispose(false, false);
        if (localTextureUrl) URL.revokeObjectURL(localTextureUrl);
        return undefined;
      }
      if (!imported) fallback(next);
      // Swap only after the replacement is fully constructed.
      release();
      holder = next;
      instance = imported;
      for (const mesh of next.getChildMeshes()) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        if (!castsShadows || !shadows || mesh.name.startsWith("missing-label:")) continue;
        shadows.addShadowCaster(mesh, false);
        casters.push(mesh);
      }
      paint(visual, localTextureUrl);
      next.setEnabled(true);
      return !!imported;
    } catch (error) {
      imported?.dispose();
      next.dispose(false, false);
      throw error;
    }
  }

  return {
    load,
    get animationGroups() { return instance?.animationGroups; },
    setAppearance: paint,
    dispose(): void {
      disposed = true;
      ++generation;
      release();
    },
  };
}
