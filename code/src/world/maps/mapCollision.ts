import type { GroundStep } from "../../combat/bodyCollision.ts";
import type { MapAssets, MapBounds, MapDefinition, MapPosition } from "./types.ts";
import { terrainBounds } from "./validation.ts";

export type FlatObstacle = {
  x: number;
  z: number;
  minY: number;
  maxY: number;
} & (
  { type: "circle"; radius: number } |
  { type: "box"; width: number; depth: number; yaw: number }
);

interface Contact { time: number; nx: number; nz: number }

function rotate(x: number, z: number, yaw: number): GroundStep {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return { x: x * cos + z * sin, z: z * cos - x * sin };
}

/** Transform each local collider independently; all forms in an asset stay composed. */
export function buildMapObstacles(map: MapDefinition, assets: MapAssets): FlatObstacle[] {
  const result: FlatObstacle[] = [];
  for (const instance of map.objects) {
    const asset = assets.objects[instance.asset];
    const yaw = instance.rotationY * Math.PI / 180;
    for (const shape of asset.colliders) {
      const offset = rotate(shape.position[0], shape.position[2], yaw);
      const centerY = instance.position[1] + shape.position[1];
      const height = shape.type === "box" ? shape.size[1] : shape.height;
      const base = {
        x: instance.position[0] + offset.x,
        z: instance.position[2] + offset.z,
        minY: centerY - height / 2,
        maxY: centerY + height / 2,
      };
      result.push(shape.type === "box"
        ? { ...base, type: "box", width: shape.size[0], depth: shape.size[2], yaw }
        : { ...base, type: "circle", radius: shape.radius });
    }
  }
  return result;
}

function sweepCircle(x: number, z: number, step: GroundStep, radius: number,
                     obstacle: Extract<FlatObstacle, { type: "circle" }>): Contact | undefined {
  const ox = x - obstacle.x;
  const oz = z - obstacle.z;
  const distance = Math.hypot(ox, oz);
  const total = radius + obstacle.radius;
  const dot = ox * step.x + oz * step.z;
  let time: number;
  if (distance < total) {
    if (dot >= 0) return;
    time = 0;
  } else {
    if (dot >= 0) return;
    const squareSpeed = step.x * step.x + step.z * step.z;
    const determinant = dot * dot - squareSpeed * (distance * distance - total * total);
    if (determinant < 0) return;
    time = (-dot - Math.sqrt(determinant)) / squareSpeed;
    if (time < 0 || time > 1) return;
  }
  const nx = ox + step.x * time;
  const nz = oz + step.z * time;
  const length = Math.hypot(nx, nz);
  if (length < 1e-9) return;
  return { time, nx: nx / length, nz: nz / length };
}

function sweepBox(x: number, z: number, step: GroundStep, radius: number,
                  box: Extract<FlatObstacle, { type: "box" }>): Contact | undefined {
  // Minkowski expansion by the hero circle. This is conservative at box corners,
  // but provides fast deterministic continuous collisions and wall sliding.
  const start = rotate(x - box.x, z - box.z, -box.yaw);
  const velocity = rotate(step.x, step.z, -box.yaw);
  const extentX = box.width / 2 + radius;
  const extentZ = box.depth / 2 + radius;

  const inside = Math.abs(start.x) < extentX && Math.abs(start.z) < extentZ;
  if (inside) {
    const nearestX = extentX - Math.abs(start.x);
    const nearestZ = extentZ - Math.abs(start.z);
    const nx = nearestX < nearestZ ? (start.x < 0 ? -1 : 1) : 0;
    const nz = nearestZ <= nearestX ? (start.z < 0 ? -1 : 1) : 0;
    if (velocity.x * nx + velocity.z * nz >= 0) return;
    const normal = rotate(nx, nz, box.yaw);
    return { time: 0, nx: normal.x, nz: normal.z };
  }

  let entry = -Infinity;
  let exit = Infinity;
  let nx = 0;
  let nz = 0;
  for (const [origin, delta, extent, axis] of [
    [start.x, velocity.x, extentX, "x"],
    [start.z, velocity.z, extentZ, "z"],
  ] as const) {
    if (Math.abs(delta) < 1e-12) {
      if (Math.abs(origin) > extent) return;
      continue;
    }
    const first = (-extent - origin) / delta;
    const last = (extent - origin) / delta;
    const near = Math.min(first, last);
    const far = Math.max(first, last);
    if (near > entry) {
      entry = near;
      nx = axis === "x" ? (delta > 0 ? -1 : 1) : 0;
      nz = axis === "z" ? (delta > 0 ? -1 : 1) : 0;
    }
    exit = Math.min(exit, far);
    if (entry > exit) return;
  }
  if (entry < 0 || entry > 1 || exit < 0) return;
  const normal = rotate(nx, nz, box.yaw);
  return { time: entry, nx: normal.x, nz: normal.z };
}

function contactAt(x: number, z: number, step: GroundStep, radius: number,
                   obstacle: FlatObstacle): Contact | undefined {
  return obstacle.type === "circle"
    ? sweepCircle(x, z, step, radius, obstacle)
    : sweepBox(x, z, step, radius, obstacle);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Swept circular hero against static rectangles/cylinders, without Babylon physics.
 * Heights are checked against the hero's vertical interval; motion stays on XZ.
 */
export function resolveMapMovement(
  start: MapPosition,
  desired: GroundStep,
  radius: number,
  obstacles: readonly FlatObstacle[],
  bounds?: MapBounds,
  height = 1.8,
): GroundStep {
  if (![...start, desired.x, desired.z, radius, height].every(Number.isFinite) ||
      radius <= 0 || height <= 0) {
    throw new Error("Déplacement ou dimensions du héros invalides.");
  }
  let x = start[0];
  let z = start[2];
  let remaining = { ...desired };
  for (let iteration = 0; iteration < 5; iteration++) {
    const length = Math.hypot(remaining.x, remaining.z);
    if (length < 1e-9) break;
    let earliest: Contact | undefined;
    for (const obstacle of obstacles) {
      if (obstacle.maxY <= start[1] || obstacle.minY >= start[1] + height) continue;
      const hit = contactAt(x, z, remaining, radius, obstacle);
      if (hit && (!earliest || hit.time < earliest.time)) earliest = hit;
    }
    if (!earliest) {
      x += remaining.x;
      z += remaining.z;
      break;
    }
    const fraction = Math.max(0, earliest.time - 0.0001 / length);
    x += remaining.x * fraction;
    z += remaining.z * fraction;
    remaining = {
      x: remaining.x * (1 - fraction),
      z: remaining.z * (1 - fraction),
    };
    const normalSpeed = remaining.x * earliest.nx + remaining.z * earliest.nz;
    if (normalSpeed >= 0) break;
    remaining.x -= normalSpeed * earliest.nx;
    remaining.z -= normalSpeed * earliest.nz;
  }
  if (bounds && bounds.maxX - bounds.minX >= radius * 2 &&
      bounds.maxZ - bounds.minZ >= radius * 2) {
    x = clamp(x, bounds.minX + radius, bounds.maxX - radius);
    z = clamp(z, bounds.minZ + radius, bounds.maxZ - radius);
  }
  return { x: x - start[0], z: z - start[2] };
}

export function mapBounds(map: MapDefinition): MapBounds | undefined {
  return map.terrain.groundCollider.enabled ? terrainBounds(map) : undefined;
}
