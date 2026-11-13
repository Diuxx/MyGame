import { SceneLoader, TransformNode, type AbstractMesh, type Scene } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { TRAINING_TARGETS } from "./trainingTargetConfig";

export async function loadTrainingTargets(scene: Scene, groundHeight: number): Promise<AbstractMesh[]> {
  const casters: AbstractMesh[] = [];
  for (const { id, assetPath, position, scale } of TRAINING_TARGETS) {
    try {
      const { meshes, animationGroups } = await SceneLoader.ImportMeshAsync("", "", assetPath, scene);
      for (const group of animationGroups) group.stop();

      const geometry = meshes.filter((mesh) => mesh.getTotalVertices() > 0);
      if (geometry.length === 0) throw new Error("Le modèle ne contient aucun maillage visible.");

      const root = new TransformNode(id, scene);
      for (const mesh of meshes) {
        if (!mesh.parent) mesh.parent = root;
      }
      root.scaling.setAll(scale);
      root.position.set(...position);
      const { min } = root.getHierarchyBoundingVectors();
      root.position.y += groundHeight + position[1] - min.y;
      root.computeWorldMatrix(true);
      for (const mesh of meshes) mesh.computeWorldMatrix(true);
      casters.push(...geometry);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      throw new Error(`Impossible de charger la cible ${id} (${assetPath}) : ${details}`, { cause: error });
    }
  }
  return casters;
}
