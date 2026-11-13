type Axes = [number, number, number];

export type EquipmentTransform = { position: Axes; rotation: Axes; scale: number };

// Positions are in normalized hero units, rotations in degrees, scales uniform.
export const EQUIPMENT_DEFAULTS = {
  // Orient both scabbards together so the sheathed grip is on the right.
  back: { position: [0, 0, -0.21], rotation: [0, 180, 0], scale: 0.53 },
  // Align the blade with the palm's forward axis after the GLB's built-in rotation.
  hand: { position: [0, 0.055, 0], rotation: [0, -90, 0], scale: 0.53 },
} satisfies Record<string, EquipmentTransform>;

export const EQUIPMENT_ASSETS = {
  full: "/assets/arms/scabbard_full.glb",
  empty: "/assets/arms/scabbard_empty.glb",
  katana: "/assets/arms/katana.glb",
};

// The exported origin is near the center of each prop, not at its attachment point.
export const EQUIPMENT_ALIGNMENT = {
  empty: { x: 0, y: -0.06, z: 0 },
  katana: { x: -0.67, y: 0, z: 0 },
};

/** Relative to the right-hand attachment, not the character's bone orientation. */
export const DEFAULT_DRAWN_KATANA_ROTATION: readonly [number, number, number] = [0, 0, 0];

export function parseDrawnKatanaRotation(value: unknown): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 ||
      !value.every((axis) => typeof axis === "number" && Number.isFinite(axis) && Math.abs(axis) <= 360)) {
    return [...DEFAULT_DRAWN_KATANA_ROTATION];
  }
  return [value[0], value[1], value[2]];
}
