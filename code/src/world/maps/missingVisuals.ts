import {
  Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, type Scene, type TransformNode,
} from "@babylonjs/core";
import type { MapCollider } from "./types";

/** Visible stand-ins for missing GLBs, shaped from physical colliders where available. */
export class MissingMapVisuals {
  private readonly materials: StandardMaterial[] = [];
  private readonly textures: DynamicTexture[] = [];
  private readonly labels = new Map<string, StandardMaterial>();

  constructor(private readonly scene: Scene) {}

  private plainMaterial(color: string): StandardMaterial {
    const material = new StandardMaterial("missing-model-" + color, this.scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.emissiveColor = Color3.FromHexString(color).scale(0.25);
    material.specularColor = Color3.Black();
    this.materials.push(material);
    return material;
  }

  private labelMaterial(path: string): StandardMaterial {
    const existing = this.labels.get(path);
    if (existing) return existing;
    const filename = path.split("/").at(-1) ?? path;
    const texture = new DynamicTexture("missing-label-" + filename, { width: 512, height: 96 }, this.scene, false);
    texture.hasAlpha = false;
    texture.drawText(filename, null, 59, "bold 32px Arial", "#FFFFFF", "#223239", true);
    const material = new StandardMaterial("missing-text-" + filename, this.scene);
    material.disableLighting = true;
    material.backFaceCulling = false;
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    this.textures.push(texture);
    this.materials.push(material);
    this.labels.set(path, material);
    return material;
  }

  private addLabel(parent: TransformNode, path: string, y: number, width: number): void {
    const plane = MeshBuilder.CreatePlane("missing-label:" + path, { width, height: width * 0.19 }, this.scene);
    plane.parent = parent;
    plane.position.y = y;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.material = this.labelMaterial(path);
    plane.isPickable = false;
  }

  addTile(parent: TransformNode, model: string, size: number, tileId: string): void {
    const colors: Record<string, string> = {
      wood: "#B78F60", stone: "#9FA5A1", grass: "#88B77A", water: "#5D99B7",
    };
    const tile = MeshBuilder.CreateBox("missing-tile:" + tileId, {
      width: size, depth: size, height: 0.10,
    }, this.scene);
    tile.parent = parent;
    tile.position.y = -0.05;
    tile.material = this.plainMaterial(colors[tileId] ?? "#AA8EAB");
    tile.receiveShadows = true;
    tile.isPickable = false;
    this.addLabel(parent, model, 0.15, Math.min(size * 0.85, 1.8));
  }

  addObject(parent: TransformNode, model: string, colliders: readonly MapCollider[]): void {
    const shapes = colliders.length ? colliders : [
      { type: "box" as const, position: [0, 0.5, 0] as const, size: [1, 1, 1] as const },
    ];
    const material = this.plainMaterial("#A882C1");
    let top = 0;
    for (const shape of shapes) {
      const mesh = shape.type === "box"
        ? MeshBuilder.CreateBox("missing-box:" + model, {
          width: shape.size[0], height: shape.size[1], depth: shape.size[2],
        }, this.scene)
        : MeshBuilder.CreateCylinder("missing-cylinder:" + model, {
          diameter: shape.radius * 2, height: shape.height, tessellation: 16,
        }, this.scene);
      mesh.parent = parent;
      mesh.position.set(...shape.position);
      mesh.material = material;
      mesh.isPickable = false;
      const height = shape.type === "box" ? shape.size[1] : shape.height;
      top = Math.max(top, shape.position[1] + height / 2);
    }
    this.addLabel(parent, model, top + 0.38, 2.2);
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.materials.length = 0;
    this.textures.length = 0;
    this.labels.clear();
  }
}
