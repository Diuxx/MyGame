import {
  AbstractMesh,
  AnimationGroup,
  ImportMeshAsync,
  LoadAssetContainerAsync,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { GLTFLoaderAnimationStartMode } from "@babylonjs/loaders/glTF";
import animationManifest from "../../ANIMATIONS.json" with { type: "json" };
import { bindAnimationGroup } from "../world/bindAnimationGroup";

const CHARACTER_URL = "/models/hero.glb";
const TARGET_HEIGHT_METERS = 1.8;
const importOptions = { pluginOptions: { gltf: { animationStartMode: GLTFLoaderAnimationStartMode.NONE } } };

export interface LoadedCharacter {
  root: TransformNode;
  hips: TransformNode;
  skinnedMesh: AbstractMesh;
  animationGroups: AnimationGroup[];
  heightBeforeScale: number;
  scaleApplied: number;
}

/** Calculate mesh bounds in world space before and after normalization. */
function getWorldBounds(meshes: AbstractMesh[]): { minimum: Vector3; maximum: Vector3 } {
  const minimum = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const maximum = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

  for (const mesh of meshes) {
    if (mesh.getTotalVertices() === 0) continue;
    mesh.computeWorldMatrix(true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    minimum.minimizeInPlace(bounds.minimumWorld);
    maximum.maximizeInPlace(bounds.maximumWorld);
  }

  if (!Number.isFinite(minimum.y) || !Number.isFinite(maximum.y)) {
    throw new Error("Le GLB ne contient aucun maillage visible.");
  }
  return { minimum, maximum };
}

/** Normalize the imported GLB from its mesh bounds while preserving its rig. */
export async function loadCharacter(scene: Scene): Promise<LoadedCharacter> {
  const result = await ImportMeshAsync(CHARACTER_URL, scene, importOptions);

  const hips = result.transformNodes.find(({ name }) => name === "Hips" || name === "mixamorig:Hips");
  const skinnedMesh = result.meshes.find((mesh) => mesh.skeleton?.bones.some((bone) => bone.getTransformNode() === hips));
  if (!hips || !skinnedMesh?.skeleton) {
    throw new Error(`Squelette incomplet dans ${CHARACTER_URL} : bassin introuvable.`);
  }
  const skeleton = skinnedMesh.skeleton;

  const loadedClips = await Promise.allSettled(animationManifest.animations.map(async ({ name, source: sourceName }) => {
    const path = `${animationManifest.directory}/${name}.glb`;
    const source = await LoadAssetContainerAsync(path, scene, importOptions);
    try {
      const clip = source.animationGroups.find((group) => group.name === name) ??
        source.animationGroups.find((group) => group.name === sourceName);
      if (!clip) throw new Error(`Clip ${name} absent de ${path}.`);
      const bound = bindAnimationGroup(clip, [skeleton]);
      bound.name = name;
      return bound;
    } finally {
      source.dispose();
    }
  }));
  const animationGroups = loadedClips.flatMap((clip) => clip.status === "fulfilled" ? [clip.value] : []);
  const failedClip = loadedClips.find((clip) => clip.status === "rejected");
  if (failedClip) {
    for (const group of animationGroups) group.dispose();
    throw failedClip.reason;
  }

  // Keep vertical motion and skeletal poses, but leave horizontal travel to the controller.
  for (const group of animationGroups) {
    for (const { target, animation } of group.targetedAnimations) {
      if (target !== hips || animation.targetProperty !== "position") continue;
      animation.setKeys(animation.getKeys().map((key) => {
        const value = key.value as Vector3;
        return { ...key, value: new Vector3(hips.position.x, value.y, hips.position.z) };
      }));
    }
  }

  const root = new TransformNode("characterController", scene);
  const importedSceneRoots = result.meshes.filter((mesh) => mesh.parent === null);
  if (importedSceneRoots.length === 0) {
    throw new Error("Impossible de retrouver le nœud racine du personnage.");
  }
  for (const importedRoot of importedSceneRoots) importedRoot.parent = root;

  const initialBounds = getWorldBounds(result.meshes);
  const initialHeight = initialBounds.maximum.y - initialBounds.minimum.y;
  if (!Number.isFinite(initialHeight) || initialHeight < 0.00001) {
    throw new Error("La hauteur du personnage importé est invalide.");
  }

  const scale = TARGET_HEIGHT_METERS / initialHeight;
  root.scaling.setAll(scale);
  const scaledBounds = getWorldBounds(result.meshes);
  root.position.y = -scaledBounds.minimum.y;

  return {
    root,
    hips,
    skinnedMesh,
    animationGroups,
    heightBeforeScale: initialHeight,
    scaleApplied: scale,
  };
}
