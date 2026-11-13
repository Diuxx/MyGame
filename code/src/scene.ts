import {
  ArcRotateCamera,
  Camera,
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { calculateOrthographicBounds, degreesToRadians } from "./cameraMath";

export const DEFAULT_CAMERA_TILT = 40;
export const DEFAULT_VISIBLE_HEIGHT = 20;
export const GROUND_HALF_SIZE = 30;
const HERO_FOCUS_HEIGHT = 0;
const GRID_SPACING = 1;

export interface CameraControls {
  readonly alpha: number;
  follow(x: number, z: number): void;
  setTilt(degreesFromVertical: number): void;
  setVisibleHeight(units: number): void;
  reset(): void;
}

/** Isometric-style perspective from an orthographic camera, without a 2D background. */
export function buildPlayground(scene: Scene, canvas: HTMLCanvasElement): CameraControls {
  scene.clearColor = new Color4(0, 0, 0, 1);
  scene.ambientColor = new Color3(0.48, 0.5, 0.46);

  const camera = new ArcRotateCamera(
    "playgroundCamera",
    degreesToRadians(65),
    degreesToRadians(DEFAULT_CAMERA_TILT),
    // Keep the foreground inside the clip planes at maximum zoom-out and tilt.
    50,
    new Vector3(0, HERO_FOCUS_HEIGHT, 0),
    scene,
  );
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.05;
  camera.maxZ = 100;
  scene.activeCamera = camera;

  new HemisphericLight("skyLight", new Vector3(0, 1, 0), scene).intensity = 1.1;
  const sun = new DirectionalLight("sun", new Vector3(-0.7, -1.4, 0.5), scene);
  sun.intensity = 0.8;
  sun.position = new Vector3(5, 9, -6);

  const groundSize = GROUND_HALF_SIZE * 2;
  const ground = MeshBuilder.CreateGround("simpleGround", { width: groundSize, height: groundSize }, scene);
  const groundMaterial = new StandardMaterial("groundMaterial", scene);
  groundMaterial.diffuseColor = Color3.FromHexString("#b8bba4");
  groundMaterial.specularColor = Color3.Black();
  ground.material = groundMaterial;
  ground.position.y = -0.022;

  const gridLines: Vector3[][] = [];
  for (let offset = -GROUND_HALF_SIZE; offset <= GROUND_HALF_SIZE; offset += GRID_SPACING) {
    gridLines.push(
      [new Vector3(offset, 0, -GROUND_HALF_SIZE), new Vector3(offset, 0, GROUND_HALF_SIZE)],
      [new Vector3(-GROUND_HALF_SIZE, 0, offset), new Vector3(GROUND_HALF_SIZE, 0, offset)],
    );
  }
  const grid = MeshBuilder.CreateLineSystem("floorGrid", { lines: gridLines }, scene);
  grid.color = Color3.FromHexString("#a1ab9e");
  grid.parent = ground;
  grid.position.y = 0.002;
  grid.isPickable = false;

  // The projected ring helps calibrate character size; not a gameplay collider.
  const ring = MeshBuilder.CreateTorus("floorMarker", {
    diameter: 1.95, thickness: 0.012, tessellation: 60,
  }, scene);
  const ringMaterial = new StandardMaterial("ringMaterial", scene);
  ringMaterial.diffuseColor = Color3.FromHexString("#6f8664");
  ringMaterial.emissiveColor = Color3.FromHexString("#33442d");
  ringMaterial.alpha = 0.28;
  ring.material = ringMaterial;
  ring.position.y = -0.011;
  ring.isPickable = false;

  let visibleHeight = DEFAULT_VISIBLE_HEIGHT;
  function updateOrthographicBounds(): void {
    const size = calculateOrthographicBounds(canvas.clientWidth, canvas.clientHeight, visibleHeight);
    camera.orthoLeft = size.left;
    camera.orthoRight = size.right;
    camera.orthoTop = size.top;
    camera.orthoBottom = size.bottom;
  }

  function setTilt(degreesFromVertical: number): void {
    camera.beta = degreesToRadians(degreesFromVertical);
  }

  function setVisibleHeight(units: number): void {
    visibleHeight = units;
    updateOrthographicBounds();
  }

  updateOrthographicBounds();
  window.addEventListener("resize", updateOrthographicBounds);

  return {
    get alpha() {
      return camera.alpha;
    },
    follow: (x, z) => {
      camera.target.set(x, HERO_FOCUS_HEIGHT, z);
    },
    setTilt,
    setVisibleHeight,
    reset: () => {
      setTilt(DEFAULT_CAMERA_TILT);
      setVisibleHeight(DEFAULT_VISIBLE_HEIGHT);
    },
  };
}
