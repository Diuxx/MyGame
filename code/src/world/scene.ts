import {
  ArcRotateCamera,
  Camera,
  Scene,
  Vector3,
} from "@babylonjs/core";
import { calculateOrthographicBounds, clamp, degreesToRadians, wheelZoomHeight } from "./cameraMath";

export const DEFAULT_CAMERA_TILT = 40;
export const DEFAULT_VISIBLE_HEIGHT = 25;
export const MIN_VISIBLE_HEIGHT = 5;
export const MAX_VISIBLE_HEIGHT = 40;
export const DEFAULT_CAMERA_ROTATION = 65;
const HERO_FOCUS_HEIGHT = 0;

export interface CameraControls {
  readonly alpha: number;
  readonly visibleHeight: number;
  follow(x: number, z: number): void;
  setRotation(degrees: number): void;
  setTilt(degreesFromVertical: number): void;
  setVisibleHeight(units: number): void;
}

/** Isometric-style perspective from an orthographic camera, without a 2D background. */
export function createCamera(scene: Scene, canvas: HTMLCanvasElement, signal: AbortSignal): CameraControls {
  const camera = new ArcRotateCamera(
    "gameCamera",
    degreesToRadians(DEFAULT_CAMERA_ROTATION),
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

  let visibleHeight: number = DEFAULT_VISIBLE_HEIGHT;
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
    visibleHeight = clamp(units, MIN_VISIBLE_HEIGHT, MAX_VISIBLE_HEIGHT);
    updateOrthographicBounds();
  }

  updateOrthographicBounds();
  window.addEventListener("resize", updateOrthographicBounds, { signal });
  canvas.addEventListener("wheel", (event) => {
    if (event.ctrlKey || event.metaKey) return;
    const mode = event.deltaMode;
    const pixels = event.deltaY * (mode === WheelEvent.DOM_DELTA_LINE ? 16
      : mode === WheelEvent.DOM_DELTA_PAGE ? canvas.clientHeight : 1);
    if (!pixels) return;
    event.preventDefault();
    setVisibleHeight(wheelZoomHeight(visibleHeight, pixels, MIN_VISIBLE_HEIGHT, MAX_VISIBLE_HEIGHT));
  }, { passive: false, signal });

  return {
    get alpha() {
      return camera.alpha;
    },
    get visibleHeight() {
      return visibleHeight;
    },
    follow: (x, z) => {
      camera.target.set(x, HERO_FOCUS_HEIGHT, z);
    },
    setRotation: (degrees) => {
      camera.alpha = degreesToRadians(degrees);
    },
    setTilt,
    setVisibleHeight,
  };
}
