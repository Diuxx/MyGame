/** JSON-facing data. All positions are in world units, with Y vertical. */
export type MapPosition = readonly [number, number, number];

export type MapCollider =
  | { type: "box"; position: MapPosition; size: MapPosition }
  | { type: "cylinder"; position: MapPosition; radius: number; height: number };

export interface TileAsset {
  model: string;
  walkable: boolean;
}

export interface ObjectAsset {
  model: string;
  blocksNavigation: boolean;
  colliders: MapCollider[];
}

export interface MapAssets {
  version: 1;
  tiles: Record<string, TileAsset>;
  objects: Record<string, ObjectAsset>;
}

export interface MapObject {
  id: string;
  asset: string;
  position: MapPosition;
  rotationY: number;
}

export interface MapSpawn {
  id: string;
  type: "player" | "enemy";
  position: MapPosition;
  rotationY: number;
}

export interface MapDefinition {
  version: 1;
  id: string;
  name: string;
  tileSize: number;
  terrain: {
    origin: MapPosition;
    tiles: string[][];
    groundCollider: { enabled: boolean; thickness: number };
  };
  objects: MapObject[];
  spawnPoints: MapSpawn[];
}

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
