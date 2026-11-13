const WALK_SPEED = 1.5;
const RUN_SPEED = 3.5;
const MAX_FRAME_SECONDS = 0.05;

/** Projects screen-relative input onto the ground and returns a world-space step. */
export function calculateMovementStep(
  horizontal: number,
  vertical: number,
  cameraAlpha: number,
  deltaSeconds: number,
  running: boolean,
): { x: number; z: number } {
  const length = Math.hypot(horizontal, vertical);
  if (length === 0) return { x: 0, z: 0 };

  const distance = (running ? RUN_SPEED : WALK_SPEED) * Math.min(deltaSeconds, MAX_FRAME_SECONDS);
  const scale = distance / length;
  const cos = Math.cos(cameraAlpha);
  const sin = Math.sin(cameraAlpha);
  return {
    x: (-horizontal * sin - vertical * cos) * scale,
    z: (horizontal * cos - vertical * sin) * scale,
  };
}
