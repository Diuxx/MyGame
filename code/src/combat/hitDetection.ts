import type { Hurtbox, Position } from "./combat.ts";

/** A horizontal capsule-shaped attack extending from the attacker in its facing direction. */
export interface MeleeHitbox {
  range: number;
  radius: number;
  elevation: number;
  verticalRadius: number;
}

/** Rotate a ground-plane vector around the world's vertical (Y) axis. */
function rotateGround(x: number, z: number, yaw: number): { x: number; z: number } {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return { x: x * cos + z * sin, z: z * cos - x * sin };
}

/**
 * Test a melee sweep against a vertical hurtbox. Cylinders are exact for the
 * horizontal capsule; boxes use an expanded rectangle, slightly conservative
 * near corners. This deliberately avoids dependence on the rendered mesh.
 */
export function intersectsMeleeHitbox(
  origin: Position,
  attackYaw: number,
  targetPosition: Position,
  hurtbox: Hurtbox,
  attack: MeleeHitbox,
  targetYaw = 0,
): boolean {
  const rotatedOffset = rotateGround(hurtbox.offset[0], hurtbox.offset[2], targetYaw);
  const centerX = targetPosition[0] + rotatedOffset.x;
  const centerY = targetPosition[1] + hurtbox.offset[1];
  const centerZ = targetPosition[2] + rotatedOffset.z;

  if (Math.abs(origin[1] + attack.elevation - centerY) > hurtbox.height / 2 + attack.verticalRadius) {
    return false;
  }

  const dx = centerX - origin[0];
  const dz = centerZ - origin[2];
  const forwardX = Math.sin(attackYaw);
  const forwardZ = Math.cos(attackYaw);
  const projection = dx * forwardX + dz * forwardZ;
  if (projection < 0) return false;

  if (hurtbox.shape === "cylinder") {
    const along = Math.min(projection, attack.range);
    return Math.hypot(dx - along * forwardX, dz - along * forwardZ) <= hurtbox.radius + attack.radius;
  }

  // Express the sweep in the target's local coordinates to support rotated boxes.
  const localCenter = rotateGround(dx, dz, -targetYaw);
  const localForward = rotateGround(forwardX, forwardZ, -targetYaw);
  let near = 0;
  let far = attack.range;
  for (const [center, direction, halfSize] of [
    [localCenter.x, localForward.x, hurtbox.width / 2],
    [localCenter.z, localForward.z, hurtbox.depth / 2],
  ]) {
    const extent = halfSize + attack.radius;
    if (Math.abs(direction) < 1e-9) {
      if (Math.abs(center) > extent) return false;
      continue;
    }
    const a = (center - extent) / direction;
    const b = (center + extent) / direction;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  return true;
}
