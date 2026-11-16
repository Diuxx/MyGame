/** Unit-safe camera calculations, independent of Babylon.js. */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function wheelZoomHeight(height: number, deltaPixels: number, min: number, max: number): number {
  return clamp(height * Math.exp(deltaPixels * 0.0015), min, max);
}

export interface OrthographicBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Keep vertical framing constant across screen aspect ratios. */
export function calculateOrthographicBounds(
  viewportWidth: number,
  viewportHeight: number,
  visibleHeight: number,
): OrthographicBounds {
  const aspectRatio = Math.max(viewportWidth, 1) / Math.max(viewportHeight, 1);
  const halfHeight = visibleHeight / 2;
  const halfWidth = halfHeight * aspectRatio;
  return { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight };
}

export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Camera-local keyboard panning on the horizontal plane, independent of Babylon.
export interface CameraFocus { x: number; z: number }
export interface CameraPanBounds { minX: number; maxX: number; minZ: number; maxZ: number }

export function panCameraFocus(
  focus: CameraFocus,
  horizontal: number,
  vertical: number,
  cameraAlpha: number,
  distance: number,
  bounds?: CameraPanBounds,
): CameraFocus {
  const axisLength = Math.hypot(horizontal, vertical);
  if (!axisLength || distance <= 0) return { ...focus };
  const right = horizontal / axisLength;
  const forward = vertical / axisLength;
  // ArcRotateCamera alpha determines the camera-to-target direction on XZ.
  const dx = (-Math.sin(cameraAlpha) * right - Math.cos(cameraAlpha) * forward) * distance;
  const dz = (Math.cos(cameraAlpha) * right - Math.sin(cameraAlpha) * forward) * distance;
  const x = focus.x + dx;
  const z = focus.z + dz;
  return bounds
    ? { x: clamp(x, bounds.minX, bounds.maxX), z: clamp(z, bounds.minZ, bounds.maxZ) }
    : { x, z };
}
