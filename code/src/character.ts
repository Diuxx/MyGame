import {
  AbstractMesh,
  AnimationGroup,
  Scene,
  SceneLoader,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

const CHARACTER_URL = "/models/hero.glb";
const TARGET_HEIGHT_METERS = 1.8;

export interface LoadedCharacter {
  root: TransformNode;
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

/**
 * Import the Meshy GLB as-is. Its Armature has scale 0.01; we compute the
 * displayed size from its real bounds rather than assuming its export units.
 * Parenting the imported root also preserves its skeleton and animations.
 */
export async function loadCharacter(scene: Scene): Promise<LoadedCharacter> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "hero.glb", scene);
  if (result.meshes.length === 0 || result.animationGroups.length === 0) {
    throw new Error(`Le modèle ${CHARACTER_URL} doit contenir un maillage et des animations.`);
  }

  for (const group of result.animationGroups) group.stop();

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
    animationGroups: result.animationGroups,
    heightBeforeScale: initialHeight,
    scaleApplied: scale,
  };
}
