import {
  Color3, StandardMaterial, Texture, TransformNode,
  type AbstractMesh, type InstantiatedEntries, type Material, type Scene, type ShadowGenerator,
} from "@babylonjs/core";
import type { VisualOverride } from "./editorSchema";
import type { MapModelRegistry } from "./modelRegistry";

/** One placement owns its GLB instance and preview resources, never the cached GLB source. */
interface ModelView {
  holder: TransformNode;
  instance: InstantiatedEntries | null;
  casters: AbstractMesh[];
  originalMaterials: Map<AbstractMesh, Material | null>;
  painted?: StandardMaterial;
  image?: Texture;
  blobUrl?: string;
}

function editableMeshes(holder: TransformNode): AbstractMesh[] {
  return holder.getChildMeshes().filter((mesh) =>
    !mesh.name.startsWith("missing-label:") && !mesh.name.startsWith("enemy-name"));
}

export function createEditableModel(
  scene: Scene, parent: TransformNode, registry: MapModelRegistry,
  shadows: ShadowGenerator | undefined,
  defaultPath: string,
  fallback: (holder: TransformNode) => void,
  castsShadows = true,
  externalClips?: Readonly<Record<string, string>>,
) {
  let current: ModelView | undefined;
  let generation = 0;
  let disposed = false;

  function release(view: ModelView): void {
    for (const mesh of view.casters) shadows?.removeShadowCaster(mesh, false);
    view.instance?.dispose();
    view.holder.dispose(false, false);
    view.painted?.dispose();
    view.image?.dispose();
    if (view.blobUrl) URL.revokeObjectURL(view.blobUrl);
  }

  /**
   * Keep original instance materials so removing a preview restores its PBR look.
   * Prepare replacements before touching the visible model.
   */
  function paint(view: ModelView, visual?: VisualOverride, localTexture?: string): void {
    const texturePath = localTexture ?? visual?.texture;
    let nextMaterial: StandardMaterial | undefined;
    let nextImage: Texture | undefined;
    try {
      if (visual?.tint || texturePath) {
        nextMaterial = new StandardMaterial("editable-map-surface", scene);
        nextMaterial.diffuseColor = Color3.FromHexString(visual?.tint ?? "#FFFFFF");
        nextMaterial.specularColor = Color3.Black();
        if (texturePath) {
          nextImage = new Texture(texturePath, scene);
          nextMaterial.diffuseTexture = nextImage;
        }
      }

      for (const [mesh, original] of view.originalMaterials) {
        mesh.material = nextMaterial ?? original;
      }
      view.holder.scaling.setAll(visual?.scale ?? 1);
    } catch (error) {
      nextMaterial?.dispose();
      nextImage?.dispose();
      if (localTexture && localTexture !== view.blobUrl) URL.revokeObjectURL(localTexture);
      throw error;
    }

    const previousMaterial = view.painted;
    const previousImage = view.image;
    const previousUrl = view.blobUrl;
    view.painted = nextMaterial;
    view.image = nextImage;
    view.blobUrl = localTexture;
    previousMaterial?.dispose();
    previousImage?.dispose();
    if (previousUrl && previousUrl !== localTexture) URL.revokeObjectURL(previousUrl);
  }

  async function load(visual?: VisualOverride, localTextureUrl?: string): Promise<boolean | undefined> {
    if (disposed) throw new Error("Modèle déjà libéré.");
    const request = ++generation;
    const next: ModelView = {
      holder: new TransformNode("editable-visual", scene),
      instance: null,
      casters: [],
      originalMaterials: new Map(),
      blobUrl: localTextureUrl,
    };
    next.holder.parent = parent;
    next.holder.setEnabled(false);

    try {
      next.instance = await registry.instantiate(visual?.model ?? defaultPath, next.holder, externalClips, true);
      if (disposed || request !== generation) {
        release(next);
        return undefined;
      }
      if (!next.instance) fallback(next.holder);

      for (const mesh of editableMeshes(next.holder)) {
        next.originalMaterials.set(mesh, mesh.material);
      }
      paint(next, visual, localTextureUrl);

      for (const mesh of next.holder.getChildMeshes()) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        if (!castsShadows || !shadows || mesh.name.startsWith("missing-label:")) continue;
        shadows.addShadowCaster(mesh, false);
        next.casters.push(mesh);
      }

      // Swap only after loading, appearance and shadows are ready.
      const previous = current;
      current = next;
      next.holder.setEnabled(true);
      if (previous) release(previous);
      return !!next.instance;
    } catch (error) {
      release(next);
      throw error;
    }
  }

  return {
    load,
    get animationGroups() { return current?.instance?.animationGroups; },
    setAppearance(visual?: VisualOverride, localTextureUrl?: string): void {
      if (disposed) throw new Error("Modèle déjà libéré.");
      if (current) paint(current, visual, localTextureUrl);
      else if (localTextureUrl) URL.revokeObjectURL(localTextureUrl);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      ++generation;
      if (current) release(current);
      current = undefined;
    },
  };
}
