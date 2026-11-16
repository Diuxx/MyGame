import {
  LoadAssetContainerAsync, type TransformNode, type AssetContainer, type InstantiatedEntries, type Scene,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF/index.js";
import { bindAnimationGroup } from "../bindAnimationGroup.ts";

/**
 * Keep source GLBs for the lifetime of the map system, never for an individual
 * placement. Each placement owns and disposes only its instantiated hierarchy.
 */
export class MapModelRegistry {
  private readonly sources = new Map<string, Promise<AssetContainer | null>>();
  private readonly retired = new Set<AssetContainer>();
  private readonly pendingImports = new Set<Promise<AssetContainer>>();
  private disposed = false;
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  private getSource(path: string): Promise<AssetContainer | null> {
    if (this.disposed) throw new Error("Registre de modèles déjà libéré.");
    let pending = this.sources.get(path);
    if (!pending) {
      pending = LoadAssetContainerAsync(path, this.scene, {
        pluginOptions: { gltf: { animationStartMode: 0 } },
      }).then((container) => {
        if (!this.disposed) return container;
        container.dispose();
        return null;
      }).catch((error: unknown) => {
        console.warn("Map : fichier 3D absent ou illisible :", path, error);
        return null;
      });
      this.sources.set(path, pending);
    }
    return pending;
  }

  async registerLocalFile(file: File): Promise<string> {
    if (this.disposed) throw new Error("Registre de modèles déjà libéré.");
    if (!/^[a-z0-9][a-z0-9_.-]*\\.glb$/i.test(file.name) || file.size === 0 ||
        file.size > 25 * 1024 * 1024) {
      throw new Error("GLB invalide (nom simple, fichier non vide, 25 Mo maximum).");
    }
    const base = file.name.toLowerCase().replace(/[^a-z0-9_.-]/g, "-");
    const path = "/assets/models/editor/" + base;
    const url = URL.createObjectURL(file);
    const loading = LoadAssetContainerAsync(url, this.scene, {
      pluginExtension: ".glb",
      pluginOptions: { gltf: { animationStartMode: 0 } },
    });
    this.pendingImports.add(loading);
    let container: AssetContainer | undefined;
    try {
      container = await loading;
      if (!container.rootNodes.length || !container.meshes.some((mesh) => mesh.getTotalVertices() > 0)) {
        throw new Error("Le fichier GLB ne contient pas de modèle utilisable.");
      }

      // A replaced source stays alive until the registry closes, while its instances
      // may still share its materials and textures.
      const previous = this.sources.get(path);
      const old = previous ? await previous : null;
      if (this.disposed) throw new Error("Registre libéré pendant l'import GLB.");
      this.sources.set(path, Promise.resolve(container));
      if (old) this.retired.add(old);
      return path;
    } catch (error) {
      container?.dispose();
      throw error;
    } finally {
      this.pendingImports.delete(loading);
      URL.revokeObjectURL(url);
    }
  }

  async instantiate(path: string, parent: TransformNode,
                    externalClips: Readonly<Record<string, string>> = {},
                     cloneMeshes = false): Promise<InstantiatedEntries | null> {
    const source = await this.getSource(path);
    if (this.disposed) throw new Error("Registre libéré pendant l'instanciation.");
    if (!source) return null;
    if (!source.rootNodes.length || !source.meshes.some((mesh) => mesh.getTotalVertices() > 0)) {
      console.warn("Map : modèle 3D vide, représentation de collision utilisée :", path);
      return null;
    }
    let placed: InstantiatedEntries | undefined;
    try {
      const clips = await Promise.all(Object.entries(externalClips).map(async ([name, url]) =>
        ({ name, url, source: await this.getSource(url) })));
      if (this.disposed) throw new Error("Registre libéré pendant le chargement des animations.");
      placed = source.instantiateModelsToScene(clips.length ? (name) => name : undefined,
        false, { doNotInstantiate: cloneMeshes });
      if (!placed.rootNodes.length) {
        placed.dispose();
        return null;
      }
      for (const node of placed.rootNodes) node.parent = parent;
      const boundClips = [];
      for (const clip of clips) {
        try {
          const group = clip.source?.animationGroups.find(({ name }) => name === clip.name);
          if (!group) throw new Error("Clip absent : " + clip.name);
          boundClips.push(bindAnimationGroup(group, placed.skeletons));
        } catch (error) {
          console.warn("Map : animation externe indisponible :", path, clip.url, error);
        }
      }
      placed.animationGroups.unshift(...boundClips);
      return placed;
    } catch (error) {
      placed?.dispose();
      console.warn("Map : duplication de modèle impossible, remplacement par un volume :", path, error);
      return null;
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await Promise.allSettled(this.pendingImports);
    const sources = await Promise.all(this.sources.values());
    for (const source of sources) source?.dispose();
    for (const old of this.retired) old.dispose();
    this.retired.clear();
    this.sources.clear();
  }
}
