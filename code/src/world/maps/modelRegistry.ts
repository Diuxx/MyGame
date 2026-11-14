import {
  LoadAssetContainerAsync, Quaternion, TransformNode,
  type AnimationGroup, type AssetContainer, type InstantiatedEntries, type Scene,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF/index.js";

function sameRestPose(source: TransformNode, target: TransformNode): boolean {
  const sourceRotation = source.rotationQuaternion ?? Quaternion.FromEulerVector(source.rotation);
  const targetRotation = target.rotationQuaternion ?? Quaternion.FromEulerVector(target.rotation);
  if (source.name !== target.name ||
      !source.position.equalsWithEpsilon(target.position, 1e-4) ||
      !source.scaling.equalsWithEpsilon(target.scaling, 1e-4) ||
      Math.abs(Quaternion.Dot(sourceRotation, targetRotation)) < 1 - 1e-6) return false;
  if (source.name === "__root__") return true;
  return source.parent instanceof TransformNode && target.parent instanceof TransformNode &&
    sameRestPose(source.parent, target.parent);
}

/**
 * Keep source GLBs for the lifetime of the map system, never for an individual
 * placement. Each placement owns and disposes only its instantiated hierarchy.
 */
export class MapModelRegistry {
  private readonly sources = new Map<string, Promise<AssetContainer | null>>();
  private readonly retired = new Set<AssetContainer>();
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  private getSource(path: string): Promise<AssetContainer | null> {
    let pending = this.sources.get(path);
    if (!pending) {
      pending = LoadAssetContainerAsync(path, this.scene, {
        pluginOptions: { gltf: { animationStartMode: 0 } },
      }).then((container) => {
        return container;
      }).catch((error: unknown) => {
        console.warn("Map : fichier GLB absent ou illisible :", path, error);
        return null;
      });
      this.sources.set(path, pending);
    }
    return pending;
  }

  async registerLocalFile(file: File): Promise<string> {
    if (!/^[a-z0-9][a-z0-9_.-]*\.glb$/i.test(file.name) || file.size === 0 ||
        file.size > 25 * 1024 * 1024) {
      throw new Error("GLB invalide (nom simple, fichier non vide, 25 Mo maximum).");
    }
    const base = file.name.toLowerCase().replace(/[^a-z0-9_.-]/g, "-");
    const path = "/assets/models/editor/" + base;
    const url = URL.createObjectURL(file);
    try {
      const container = await LoadAssetContainerAsync(url, this.scene, {
        pluginExtension: ".glb",
        pluginOptions: { gltf: { animationStartMode: 0 } },
      });
      if (!container.rootNodes.length || !container.meshes.some((mesh) => mesh.getTotalVertices() > 0)) {
        container.dispose();
        throw new Error("Le fichier GLB ne contient pas de modèle utilisable.");
      }
      // Replace a previous failed lookup or an older locally imported source.
      const previous = this.sources.get(path);
      this.sources.set(path, Promise.resolve(container));
      if (previous) {
        // Existing instances own their meshes; the earlier source is disposed
        // only when the registry itself is closed, avoiding dangling instances.
        const old = await previous;
        if (old) this.retired.add(old);
      }
      return path;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async instantiate(path: string, parent: TransformNode,
                    externalClips: Readonly<Record<string, string>> = {}): Promise<InstantiatedEntries | null> {
    const source = await this.getSource(path);
    if (!source) return null;
    if (!source.rootNodes.length || !source.meshes.some((mesh) => mesh.getTotalVertices() > 0)) {
      console.warn("Map : modèle GLB vide, représentation de collision utilisée :", path);
      return null;
    }
    let placed: InstantiatedEntries | undefined;
    try {
      const clips = await Promise.all(Object.entries(externalClips).map(async ([name, url]) =>
        ({ name, url, source: await this.getSource(url) })));
      placed = source.instantiateModelsToScene(clips.length ? (name) => name : undefined,
        false, { doNotInstantiate: false });
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
          boundClips.push(this.bindClip(group, placed));
        } catch (error) {
          console.warn("Map : animation externe indisponible :", path, clip.url, error);
        }
      }
      placed.animationGroups.unshift(...boundClips);
      return placed;
    } catch (error) {
      placed?.dispose();
      console.warn("Map : duplication GLB impossible, remplacement par un volume :", path, error);
      return null;
    }
  }

  private bindClip(group: AnimationGroup, placed: InstantiatedEntries): AnimationGroup {
    if (!group.targetedAnimations.length) throw new Error("Clip vide : " + group.name);
    const targets = new Map<string, TransformNode | null>();
    for (const skeleton of placed.skeletons) {
      for (const bone of skeleton.bones) {
        const node = bone.getTransformNode();
        if (node) targets.set(node.name, targets.has(node.name) ? null : node);
      }
    }
    const bindings = new Map<TransformNode, TransformNode>();
    for (const { target } of group.targetedAnimations) {
      if (bindings.has(target)) continue;
      const instanceNode = targets.get(target.name);
      if (!(target instanceof TransformNode) || !instanceNode || !sameRestPose(target, instanceNode)) {
        throw new Error("Os absent, ambigu ou pose de repos incompatible : " + target.name);
      }
      bindings.set(target, instanceNode);
    }
    return group.clone(group.name, (target: TransformNode) => bindings.get(target), true);
  }

  async dispose(): Promise<void> {
    const sources = await Promise.all(this.sources.values());
    for (const source of sources) source?.dispose();
    for (const old of this.retired) old.dispose();
    this.retired.clear();
    this.sources.clear();
  }
}
