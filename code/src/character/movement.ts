const WALK_SPEED = 1.5;
const RUN_SPEED = 3.5;
const MAX_FRAME_SECONDS = 0.05;

/** Smooth the shortest turn around Y, retaining the heading inside the dead zone. */
export function aimYaw(yaw: number, dx: number, dz: number, delta: number, speed: number, deadZone: number): number {
  if (Math.hypot(dx, dz) < deadZone || delta <= 0) return yaw;
  const difference = Math.atan2(dx, dz) - yaw;
  const shortest = Math.atan2(Math.sin(difference), Math.cos(difference));
  const angle = yaw + shortest * (1 - Math.exp(-speed * delta));
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Converts forward and strafe inputs relative to the hero into a world-space step. */
export function calculateMovementStep(
  horizontal: number,
  vertical: number,
  yaw: number,
  deltaSeconds: number,
  running: boolean,
): { x: number; z: number } {
  const length = Math.hypot(horizontal, vertical);
  if (length === 0) return { x: 0, z: 0 };

  const distance = (running ? RUN_SPEED : WALK_SPEED) * Math.min(deltaSeconds, MAX_FRAME_SECONDS);
  const scale = distance / length;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: (horizontal * cos + vertical * sin) * scale,
    z: (vertical * cos - horizontal * sin) * scale,
  };
}
