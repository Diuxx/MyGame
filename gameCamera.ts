import { ArcRotateCamera, Camera, Scene, Vector3 } from "@babylonjs/core";

/**
 * Référence visuelle du POC : écran carré 1254 px et héros d'environ 140 px.
 * Le héros 3D doit mesurer environ 1,8 unité de haut, pieds à Y = 0.
 */
const CAMERA_FRAMING = {
  azimuthRadians: Math.PI / 4,
  polarRadians: Math.PI / 4,
  distance: 18,
  visibleHeight: 12,
} as const;

export function createGameCamera(scene: Scene): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    "gameCamera",
    CAMERA_FRAMING.azimuthRadians,
    CAMERA_FRAMING.polarRadians,
    CAMERA_FRAMING.distance,
    Vector3.Zero(),
    scene,
  );

  // Une caméra orthographique garde la même taille apparente, quelle que soit
  // la distance entre le héros et la caméra.
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.1;
  camera.maxZ = 100;

  updateGameCameraViewport(camera, scene);
  scene.activeCamera = camera;
  return camera;
}

/**
 * À appeler après engine.resize() dans le gestionnaire de redimensionnement
 * déjà présent dans le starter Vite/Babylon, sans en ajouter un second.
 */
export function updateGameCameraViewport(
  camera: ArcRotateCamera,
  scene: Scene,
): void {
  const engine = scene.getEngine();
  const renderHeight = engine.getRenderHeight();

  if (renderHeight <= 0) {
    return;
  }

  const aspectRatio = engine.getRenderWidth() / renderHeight;
  const halfHeight = CAMERA_FRAMING.visibleHeight / 2;
  const halfWidth = halfHeight * aspectRatio;

  camera.orthoTop = halfHeight;
  camera.orthoBottom = -halfHeight;
  camera.orthoLeft = -halfWidth;
  camera.orthoRight = halfWidth;
}
