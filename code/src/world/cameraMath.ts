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
