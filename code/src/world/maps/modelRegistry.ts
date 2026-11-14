import { LoadAssetContainerAsync, type AssetContainer, type Scene, type TransformNode } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

/**
 * Keep source GLBs for the lifetime of the map system, never for an individual
 * placement. Each placement owns and disposes only its instantiated hierarchy.
 */
export class MapModelRegistry {
  private readonly sources = new Map<string, Promise<AssetContainer | null>>();

  constructor(private readonly scene: Scene) {}

  private getSource(path: string): Promise<AssetContainer | null> {
    let pending = this.sources.get(path);
    if (!pending) {
      pending = LoadAssetContainerAsync(path, this.scene, {
        pluginOptions: { gltf: { animationStartMode: 0 } },
      }).then((container) => {
        if (!container.rootNodes.length || !container.meshes.some((mesh) => mesh.getTotalVertices() > 0)) {
          container.dispose();
          console.warn("Map : modèle GLB vide, représentation de collision utilisée :", path);
          return null;
        }
        return container;
      }).catch((error: unknown) => {
        console.warn("Map : modèle GLB absent ou illisible, représentation de collision utilisée :", path, error);
        return null;
      });
      this.sources.set(path, pending);
    }
    return pending;
  }

  async instantiate(path: string, parent: TransformNode): Promise<(() => void) | null> {
    const source = await this.getSource(path);
    if (!source) return null;
    try {
      const placed = source.instantiateModelsToScene(undefined, false, { doNotInstantiate: false });
      if (!placed.rootNodes.length) {
        placed.dispose();
        return null;
      }
      for (const node of placed.rootNodes) node.parent = parent;
      return () => placed.dispose();
    } catch (error) {
      console.warn("Map : duplication GLB impossible, remplacement par un volume :", path, error);
      return null;
    }
  }

  async dispose(): Promise<void> {
    const sources = await Promise.all(this.sources.values());
    for (const source of sources) source?.dispose();
    this.sources.clear();
  }
}
