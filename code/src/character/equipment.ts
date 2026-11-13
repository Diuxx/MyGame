import { LoadAssetContainerAsync, TransformNode, Vector3, type AssetContainer, type Scene } from "@babylonjs/core";
import { degreesToRadians } from "../world/cameraMath";
import { DEFAULT_DRAWN_KATANA_ROTATION, EQUIPMENT_ALIGNMENT, EQUIPMENT_ASSETS, EQUIPMENT_DEFAULTS, type EquipmentTransform } from "./equipmentTuning";
import { createWeaponState } from "./weaponState";
import type { LoadedCharacter } from "./character";

export async function loadEquipment(scene: Scene, character: LoadedCharacter) {
  const results = await Promise.allSettled(Object.values(EQUIPMENT_ASSETS).map(async (path) => {
    const asset = await LoadAssetContainerAsync(path, scene).catch((cause: unknown) => {
      throw new Error(`Chargement de ${path} impossible`, { cause });
    });
    if (!asset.meshes.some((mesh) => mesh.getTotalVertices() > 0)) {
      asset.dispose();
      throw new Error(`Aucun maillage visible dans ${path}`);
    }
    return asset;
  }));
  const failure = results.find((result) => result.status === "rejected");
  const assets = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (failure) {
    for (const asset of assets) asset.dispose();
    throw failure.reason;
  }

  const { hips, rightHand, skinnedMesh } = character;
  const back = new TransformNode("equipment-back", scene);
  back.parent = hips;
  const hand = new TransformNode("equipment-right-hand", scene);
  hand.attachToBone(rightHand, skinnedMesh);
  // Cancel the centimeter rig scale once, without changing either animated bone.
  const sockets = { back, hand };
  const inheritedScale = {
    back: Vector3.TransformNormal(Vector3.Right(), back.computeWorldMatrix(true)).length(),
    hand: Vector3.TransformNormal(Vector3.Right(), hand.computeWorldMatrix(true)).length(),
  };

  function mount(name: string, asset: AssetContainer, parent: TransformNode): TransformNode {
    const model = new TransformNode(name, scene);
    model.parent = parent;
    asset.addAllToScene();
    for (const node of asset.rootNodes) node.parent = model;
    for (const mesh of asset.meshes) mesh.isPickable = false;
    return model;
  }

  const full = mount("equipment-scabbard-full", assets[0], back);
  const empty = mount("equipment-scabbard-empty", assets[1], back);
  // A separate pivot rotates the drawn blade around the hand grip, not its GLB center.
  const katanaPivot = new TransformNode("equipment-katana-orientation", scene);
  katanaPivot.parent = hand;
  const katana = mount("equipment-katana", assets[2], katanaPivot);
  empty.position.copyFromFloats(EQUIPMENT_ALIGNMENT.empty.x, EQUIPMENT_ALIGNMENT.empty.y, EQUIPMENT_ALIGNMENT.empty.z);
  katana.position.copyFromFloats(EQUIPMENT_ALIGNMENT.katana.x, EQUIPMENT_ALIGNMENT.katana.y, EQUIPMENT_ALIGNMENT.katana.z);

  function setTransform(socket: keyof typeof sockets, transform: EquipmentTransform): void {
    const node = sockets[socket];
    const inherited = inheritedScale[socket];
    node.position.set(...transform.position).scaleInPlace(1 / inherited);
    const [x, y, z] = transform.rotation;
    node.rotation.set(degreesToRadians(x), degreesToRadians(y), degreesToRadians(z));
    node.scaling.setAll(transform.scale / inherited);
  }

  const weapon = createWeaponState();
  function updateVisibility(): void {
    full.setEnabled(!weapon.drawn);
    empty.setEnabled(weapon.drawn);
    katana.setEnabled(weapon.drawn);
  }
  setTransform("back", EQUIPMENT_DEFAULTS.back);
  setTransform("hand", EQUIPMENT_DEFAULTS.hand);
  const setDrawnKatanaRotation = (rotation: readonly [number, number, number]): void => {
    const [x, y, z] = rotation;
    katanaPivot.rotation.set(degreesToRadians(x), degreesToRadians(y), degreesToRadians(z));
  };
  setDrawnKatanaRotation(DEFAULT_DRAWN_KATANA_ROTATION);
  updateVisibility();
  character.root.onDisposeObservable.addOnce(() => {
    for (const asset of assets) asset.dispose();
    back.dispose();
    katanaPivot.dispose();
    hand.dispose();
  });

  return {
    meshes: assets.flatMap((asset) => asset.meshes.filter((mesh) => mesh.getTotalVertices() > 0)),
    get state() { return weapon.state; },
    setTransform,
    setDrawnKatanaRotation,
    transition(drawn: boolean, attachmentProgress?: number) {
      weapon.transition(drawn, attachmentProgress);
      updateVisibility();
    },
    advance(progress: number) {
      weapon.advance(progress);
      updateVisibility();
    },
  };
}

export type CharacterEquipment = Awaited<ReturnType<typeof loadEquipment>>;
