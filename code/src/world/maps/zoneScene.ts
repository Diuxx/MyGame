import {
  Color3, DynamicTexture, MeshBuilder, StandardMaterial,
  type AbstractMesh, type Scene, type ShadowGenerator, type TransformNode,
} from "@babylonjs/core";
import type { MapDefinition, MapPosition } from "./types.ts";
import type { MapPrimitive } from "./zoneContent.ts";

/** Temporary blockout visuals; does not import GLB assets or create tiled terrain. */
export function createZoneScene(
  scene: Scene, root: TransformNode, map: MapDefinition, shadows?: ShadowGenerator,
) {
  const materials = new Map<string, StandardMaterial>();
  const meshes: AbstractMesh[] = [];
  const textures: DynamicTexture[] = [];
  const casters: AbstractMesh[] = [];
  const debug: AbstractMesh[] = [];
  let groundMesh: AbstractMesh | undefined;
  let platformMesh: AbstractMesh | undefined;
  let platformMaterial: StandardMaterial | undefined;
  let groundWidth = 0;
  let groundDepth = 0;

  function material(color: string): StandardMaterial {
    let existing = materials.get(color);
    if (existing) return existing;
    existing = new StandardMaterial("zone-material:" + color, scene);
    existing.diffuseColor = Color3.FromHexString(color);
    existing.specularColor = Color3.Black();
    materials.set(color, existing);
    return existing;
  }

  /** One generated texture for the whole training ground, not hundreds of floor meshes. */
  function trainingTexture(baseColor: string): DynamicTexture {
    const texture = new DynamicTexture("training-ground-texture", 1024, scene, false);
    const context = texture.getContext();
    context.fillStyle = baseColor;
    context.fillRect(0, 0, 1024, 1024);

    // Seeded flecks help judge scale and motion without external textures.
    let seed = 1741;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const shades = ["#617b65", "#819978", "#a0a68a", "#708d72"];
    for (let i = 0; i < 2300; i++) {
      context.fillStyle = shades[Math.floor(random() * shades.length)];
      const x = Math.floor(random() * 1024);
      const y = Math.floor(random() * 1024);
      const size = 1 + Math.floor(random() * 5);
      context.fillRect(x, y, size, size * 0.6 + 1);
    }

    // Soft geometric training circle in the middle of the 60x60 map.
    context.beginPath();
    context.arc(512, 512, 168, 0, Math.PI * 2);
    context.fillStyle = "#a69f83";
    context.fill();
    context.beginPath();
    context.arc(512, 512, 154, 0, Math.PI * 2);
    context.strokeStyle = "#c3ba95";
    context.lineWidth = 6;
    context.stroke();
    context.beginPath();
    context.arc(512, 512, 58, 0, Math.PI * 2);
    context.strokeStyle = "#787d65";
    context.lineWidth = 3;
    context.stroke();
    texture.update();
    textures.push(texture);
    return texture;
  }

  /** Cheap deterministic ground detail for the nature preview, without a tiled mesh grid. */
  function natureTexture(baseColor: string): DynamicTexture {
    const texture = new DynamicTexture("nature-ground-texture", 1024, scene, false);
    const context = texture.getContext();
    context.fillStyle = baseColor;
    context.fillRect(0, 0, 1024, 1024);

    let seed = 20261116;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const shades = ["#597b56", "#719469", "#86a477", "#a0aa7c"];
    for (let index = 0; index < 7500; index++) {
      context.fillStyle = shades[Math.floor(random() * shades.length)];
      const x = random() * 1024;
      const y = random() * 1024;
      const size = 1 + random() * 6;
      context.fillRect(x, y, size, size * 0.6);
    }

    // One readable corridor through the forest, leaving a combat clearing in the middle.
    context.lineJoin = "round";
    context.beginPath();
    for (let step = 0; step <= 48; step++) {
      const y = 1050 - step * 23;
      const bend = 55 * Math.sin(step * 0.28) * Math.min(1, Math.abs(y - 512) / 450);
      const x = 512 + bend;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.strokeStyle = "#7a7854";
    context.lineWidth = 120;
    context.stroke();
    context.strokeStyle = "#aa9770";
    context.lineWidth = 99;
    context.stroke();

    context.beginPath();
    context.arc(512, 512, 120, 0, Math.PI * 2);
    context.fillStyle = "#ac9972";
    context.fill();
    texture.update();
    textures.push(texture);
    return texture;
  }

  function track(mesh: AbstractMesh, color: string, castsShadow = false): AbstractMesh {
    mesh.parent = root;
    mesh.material = material(color);
    mesh.isPickable = false;
    meshes.push(mesh);
    if (castsShadow && shadows) {
      shadows.addShadowCaster(mesh, false);
      casters.push(mesh);
    }
    return mesh;
  }

  function box(name: string, position: MapPosition, size: MapPosition, color: string): AbstractMesh {
    const mesh = track(MeshBuilder.CreateBox(name, {
      width: size[0], height: size[1], depth: size[2],
    }, scene), color, true);
    mesh.position.set(...position);
    return mesh;
  }

  function primitive(item: MapPrimitive): void {
    const name = "zone-primitive:" + item.id;
    let mesh: AbstractMesh;
    if (item.kind === "box") {
      mesh = MeshBuilder.CreateBox(name, {
        width: item.size[0], height: item.size[1], depth: item.size[2],
      }, scene);
    } else if (item.kind === "cylinder") {
      mesh = MeshBuilder.CreateCylinder(name, {
        diameterTop: item.size[0], diameterBottom: item.size[0],
        height: item.size[1], tessellation: 12,
      }, scene);
      mesh.scaling.z = item.size[2] / item.size[0];
    } else {
      mesh = MeshBuilder.CreateSphere(name, { diameter: 1, segments: 12 }, scene);
      mesh.scaling.set(...item.size);
    }
    track(mesh, item.color, true);
    mesh.position.set(...item.position);
    mesh.rotation.y = item.rotationY * Math.PI / 180;
  }

  function exitArch(id: string, position: MapPosition, triggerRadius: number): void {
    const [x, y, z] = position;
    const accent = "#67C4B1";
    box("exit-left:" + id, [x - 1.45, y + 1.25, z], [0.55, 2.5, 0.6], "#536C77");
    box("exit-right:" + id, [x + 1.45, y + 1.25, z], [0.55, 2.5, 0.6], "#536C77");
    box("exit-beam:" + id, [x, y + 2.65, z], [3.45, 0.4, 0.6], accent);
    const marker = track(MeshBuilder.CreateCylinder("exit-marker:" + id, {
      diameter: 2.2, height: 0.035, tessellation: 32,
    }, scene), accent);
    marker.position.set(x, y + 0.025, z);
    const radiusMarker = track(MeshBuilder.CreateTorus("exit-range:" + id, {
      diameter: triggerRadius * 2, thickness: 0.045, tessellation: 40,
    }, scene), "#F8D47D");
    radiusMarker.position.set(x, y + 0.065, z);
    radiusMarker.setEnabled(false);
    debug.push(radiusMarker);
  }

  function debugSpawn(position: MapPosition, id: string): void {
    const marker = track(MeshBuilder.CreateCylinder("spawn-debug:" + id, {
      diameter: 1, height: 0.06, tessellation: 24,
    }, scene), "#F8D47D");
    marker.position.set(position[0], position[1] + 0.05, position[2]);
    debug.push(marker);
    marker.setEnabled(false);
  }

  if (map.terrain.primitiveGround) {
    const width = map.terrain.tiles[0].length * map.tileSize;
    const depth = map.terrain.tiles.length * map.tileSize;
    const [x, y, z] = map.terrain.origin;
    const ground = track(MeshBuilder.CreateGround("zone-ground:" + map.id, { width, height: depth }, scene),
      map.terrain.primitiveGround.color);
    ground.position.set(x + width / 2, y - 0.01, z + depth / 2);
    ground.receiveShadows = true;
    groundMesh = ground;
    groundWidth = width;
    groundDepth = depth;
    const pattern = map.terrain.primitiveGround.pattern;
    if (pattern === "training" || pattern === "nature") {
      const groundMaterial = ground.material as StandardMaterial;
      groundMaterial.diffuseColor = Color3.White();
      groundMaterial.diffuseTexture = pattern === "training"
        ? trainingTexture(map.terrain.primitiveGround.color)
        : natureTexture(map.terrain.primitiveGround.color);
    }
  }
  function updateGround(): void {
    if (!groundMesh) {
      if (map.terrain.visual?.style === "platform") {
        throw new Error("Une plateforme nécessite un sol primitif.");
      }
      return;
    }
    const width = map.terrain.tiles[0].length * map.tileSize;
    const depth = map.terrain.tiles.length * map.tileSize;
    const [x, y, z] = map.terrain.origin;
    groundMesh.scaling.x = width / groundWidth;
    groundMesh.scaling.z = depth / groundDepth;
    groundMesh.position.set(x + width / 2,
      map.terrain.visual?.style === "platform" ? y + 0.003 : y - 0.01,
      z + depth / 2);

    if (map.terrain.visual?.style !== "platform") {
      if (platformMesh) {
        platformMesh.dispose();
        const index = meshes.indexOf(platformMesh);
        if (index >= 0) meshes.splice(index, 1);
        platformMesh = undefined;
      }
      return;
    }

    const thickness = map.terrain.visual.thickness ?? 1.2;
    const sideColor = map.terrain.visual.sideColor ?? "#D8D8D8";
    if (!platformMesh) {
      // Keep the same material when switching flat/platform repeatedly.
      if (!platformMaterial) {
        platformMaterial = new StandardMaterial("zone-platform-side:" + map.id, scene);
        platformMaterial.specularColor = Color3.Black();
      }
      platformMesh = MeshBuilder.CreateBox("zone-platform:" + map.id, { size: 1 }, scene);
      platformMesh.parent = root;
      platformMesh.material = platformMaterial;
      platformMesh.isPickable = false;
      platformMesh.receiveShadows = true;
      meshes.push(platformMesh);
    }
    platformMaterial!.diffuseColor = Color3.FromHexString(sideColor);
    platformMesh.scaling.set(width, thickness, depth);
    // The box's top is at terrain Y. The original ground mesh provides its
    // visible walking surface a few millimetres above it, avoiding z-fighting.
    platformMesh.position.set(x + width / 2, y - thickness / 2, z + depth / 2);
  }

  updateGround();
  for (const item of map.primitives ?? []) primitive(item);
  for (const exit of map.exits ?? []) exitArch(exit.id, exit.position, exit.triggerRadius);
  for (const spawn of map.spawnPoints) {
    if (spawn.type === "player") debugSpawn(spawn.position, spawn.id);
  }

  return {
    resizeGround: updateGround,
    refreshGround: updateGround,
    setDebug(visible: boolean): void {
      for (const marker of debug) marker.setEnabled(visible);
    },
    dispose(): void {
      for (const mesh of casters) shadows?.removeShadowCaster(mesh, false);
      for (const mesh of meshes) mesh.dispose();
      for (const value of materials.values()) value.dispose();
      platformMaterial?.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
