const TRAINING_ASSET_ROOT = "/assets/training/";

interface TrainingTargetConfig {
  id: string;
  assetPath: string;
  position: readonly [x: number, y: number, z: number];
  scale: number;
}

// The hero starts at the origin, facing +Z. Space the targets evenly across X.
export const TRAINING_TARGETS: readonly TrainingTargetConfig[] = [
  { id: "dummy-straw", assetPath: `${TRAINING_ASSET_ROOT}dummy-straw.glb`, position: [3, 0, 4], scale: 1 },
  { id: "dummy-knight", assetPath: `${TRAINING_ASSET_ROOT}dummy-knight.glb`, position: [0, 0, 4], scale: 1 },
  { id: "target-wood", assetPath: `${TRAINING_ASSET_ROOT}target-wood.glb`, position: [-3, 0, 4], scale: 1 },
];
