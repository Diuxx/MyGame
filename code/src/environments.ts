import {
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";

const GRID_HALF_SIZE = 30;
export const PLAYGROUND_MOVEMENT_LIMIT = GRID_HALF_SIZE - 1;
const SHADOW_MAP_SIZE = 512;

function createFloor(scene: Scene, hero: TransformNode, color: string, size: number, fitShadowCasters = false) {
  scene.clearColor = Color4.FromHexString(`${color}FF`);
  const sky = new HemisphericLight("skyLight", Vector3.Up(), scene);
  sky.intensity = 0.75;
  const sun = new DirectionalLight("sun", new Vector3(-0.7, -1.4, 0.5), scene);
  sun.intensity = 0.4;
  const sunDirection = sun.direction.normalizeToNew();

  const ground = MeshBuilder.CreateGround("ground", { width: size, height: size }, scene);
  const material = new StandardMaterial("groundMaterial", scene);
  const groundColor = Color3.FromHexString(color);
  // Keep a flat base tone and let the shadow attenuate only the direct light.
  sky.excludedMeshes.push(ground);
  material.emissiveColor = groundColor.scale(1 + sunDirection.y * sun.intensity);
  material.diffuseColor = groundColor;
  material.specularColor = Color3.Black();
  ground.material = material;
  ground.position.y = -0.022;
  ground.receiveShadows = true;

  // The Playground also has stationary casters. Fit them even when the hero moves away.
  sun.shadowFrustumSize = fitShadowCasters ? 0 : 6;
  sun.shadowMinZ = 0.1;
  sun.shadowMaxZ = fitShadowCasters ? 100 : 12;
  const lightOffset = sunDirection.scale(fitShadowCasters ? -50 : -6);
  const updateLightPosition = () => {
    sun.position.set(hero.position.x + lightOffset.x, lightOffset.y, hero.position.z + lightOffset.z);
  };
  updateLightPosition();
  scene.onBeforeCameraRenderObservable.add(updateLightPosition);

  const shadows = new ShadowGenerator(SHADOW_MAP_SIZE, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadows.darkness = 0.28;
  for (const mesh of hero.getChildMeshes()) {
    shadows.addShadowCaster(mesh, false);
  }
  return { ground, shadows };
}

export function createPlaygroundEnvironment(scene: Scene, hero: TransformNode) {
  const { ground, shadows } = createFloor(scene, hero, "#BFA78A", 400, true);

  const lines: Vector3[][] = [];
  for (let offset = -GRID_HALF_SIZE; offset <= GRID_HALF_SIZE; offset += 1) {
    lines.push(
      [new Vector3(offset, 0, -GRID_HALF_SIZE), new Vector3(offset, 0, GRID_HALF_SIZE)],
      [new Vector3(-GRID_HALF_SIZE, 0, offset), new Vector3(GRID_HALF_SIZE, 0, offset)],
    );
  }
  const grid = MeshBuilder.CreateLineSystem("floorGrid", { lines }, scene);
  grid.color = Color3.FromHexString("#8C755F");
  grid.parent = ground;
  grid.position.y = 0.002;
  grid.isPickable = false;
  grid.setEnabled(false);
  return { ground, grid, shadows };
}

export function createGameplayEnvironment(scene: Scene, hero: TransformNode): void {
  createFloor(scene, hero, "#A7A981", 400);
}
