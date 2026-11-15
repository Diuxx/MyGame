/** JSON-facing data. All positions are in world units, with Y vertical. */
import type { EnvironmentSettings } from "./environmentSettings";
import type { VisualOverride, WorldInteraction } from "./editorSchema";
import type { MapEnemySpawn, MapWave, MapEncounterEvent } from "../../enemies/mapEnemyConfig";
import type { MapExit, MapPrimitive, PrimitiveGround } from "./zoneContent";

export type MapPosition = readonly [number, number, number];

export type MapCollider =
  | { type: "box"; position: MapPosition; size: MapPosition }
  | { type: "cylinder"; position: MapPosition; radius: number; height: number };

export interface TileAsset {
  name?: string;
  model: string;
  walkable: boolean;
}

export interface ObjectAsset {
  name?: string;
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
  colliders?: MapCollider[];
  visual?: VisualOverride;
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
    tiles: (string | null)[][];
    groundCollider: { enabled: boolean; thickness: number };
    primitiveGround?: PrimitiveGround;
  };
  objects: MapObject[];
  primitives?: MapPrimitive[];
  exits?: MapExit[];
  spawnPoints: MapSpawn[];
  environment?: EnvironmentSettings;
  enemyCatalog?: string;
  enemySpawns?: MapEnemySpawn[];
  waves?: MapWave[];
  events?: MapEncounterEvent[];
  interactions?: WorldInteraction[];
}

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
