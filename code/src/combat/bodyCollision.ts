import type { Position } from "./combat.ts";

export interface CollisionCircle {
  x: number;
  z: number;
  radius: number;
}

export interface GroundStep {
  x: number;
  z: number;
}

const EPSILON = 0.0001;

/**
 * Sweep a circular body through stationary circular obstacles, with tangent
 * sliding. Uses continuous collision detection so large frame steps and dodge
 * moves cannot tunnel through an enemy. No Babylon.js dependency.
 */
export function resolveCircleMovement(
  start: Position,
  step: GroundStep,
  bodyRadius: number,
  obstacles: readonly CollisionCircle[],
): GroundStep {
  if (!Number.isFinite(bodyRadius) || bodyRadius <= 0 ||
      ![...start, step.x, step.z].every(Number.isFinite)) {
    throw new Error("Position ou rayon de collision invalide.");
  }
  let x = start[0];
  let z = start[2];
  let dx = step.x;
  let dz = step.z;

  for (let iteration = 0; iteration < 4; iteration++) {
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared < 1e-12) break;
    let earliest = 1;
    let normalX = 0;
    let normalZ = 0;
    let collided = false;

    for (const obstacle of obstacles) {
      if (!Number.isFinite(obstacle.radius) || obstacle.radius <= 0) continue;
      const ox = x - obstacle.x;
      const oz = z - obstacle.z;
      const radius = bodyRadius + obstacle.radius;
      const squareDistance = ox * ox + oz * oz;
      const dot = ox * dx + oz * dz;
      let contact: number;

      if (squareDistance < radius * radius) {
        // Changing collider dimensions may leave an overlapping start.
        // Permit outward movement, but clip attempts to move farther inward.
        if (dot >= 0) continue;
        contact = 0;
      } else {
        if (dot >= 0) continue;
        const discriminant = dot * dot - lengthSquared * (squareDistance - radius * radius);
        if (discriminant < 0) continue;
        contact = (-dot - Math.sqrt(discriminant)) / lengthSquared;
        if (contact < 0 || contact > earliest) continue;
      }

      if (contact > earliest) continue;
      const nx = ox + dx * contact;
      const nz = oz + dz * contact;
      const length = Math.hypot(nx, nz);
      collided = true;
      earliest = contact;
      normalX = length > 1e-9 ? nx / length : -dx / Math.sqrt(lengthSquared);
      normalZ = length > 1e-9 ? nz / length : -dz / Math.sqrt(lengthSquared);
    }

    if (!collided) {
      x += dx;
      z += dz;
      break;
    }
    const travelled = Math.max(0, earliest - EPSILON / Math.sqrt(lengthSquared));
    x += dx * travelled;
    z += dz * travelled;
    dx *= 1 - travelled;
    dz *= 1 - travelled;
    const inward = dx * normalX + dz * normalZ;
    if (inward < 0) {
      dx -= inward * normalX;
      dz -= inward * normalZ;
    } else if (travelled === 0) {
      break;
    }
  }
  return { x: x - start[0], z: z - start[2] };
}
