import type { Scene } from "@babylonjs/core";
import { type AnimationPlayer } from "./character/animations";
import type { LoadedCharacter } from "./character/character";
import { createCharacterController } from "./character/characterController";
import type { Position } from "./combat/combat";
import { createEnemyScene } from "./enemies/enemyScene";
import { startEnemyTools } from "./playground/enemyTools";
import { bindCollisionTools } from "./playground/collisionTools";
import { bindMapTools } from "./playground/mapTools";
import { bindWorldEditor } from "./playground/worldEditor";
import { createMapSystem } from "./world/maps/mapSystem";
import { createHeroVitals } from "./combat/heroVitals";
import { createHeroHud } from "./ui/heroHud";
import { bindAttackTools } from "./playground/attackTools";
import { bindTransitionTools } from "./playground/transitionTools";
import { bindModuleWindows } from "./playground/moduleWindows";
import { bindControlSettings } from "./playground/controlSettings";
import { bindAnimationTools } from "./playground/animationTools";
import { bindEquipmentTools } from "./playground/equipmentTools";
import type { CharacterEquipment } from "./character/equipment";
import { requireElement } from "./ui/dom";
import { degreesToRadians } from "./world/cameraMath";
import { createPlaygroundEnvironment, PLAYGROUND_MOVEMENT_LIMIT } from "./world/environments";
import { DEFAULT_CAMERA_ROTATION, DEFAULT_CAMERA_TILT, DEFAULT_VISIBLE_HEIGHT, type CameraControls } from "./world/scene";

function linkRangeControl(
  inputId: string,
  outputId: string,
  formatter: (value: number) => string,
  onChange: (value: number) => void,
  signal: AbortSignal,
): void {
  const input = requireElement<HTMLInputElement>(inputId);
  const output = requireElement<HTMLOutputElement>(outputId);
  const update = () => {
    const value = Number(input.value);
    output.textContent = formatter(value);
    onChange(value);
  };
  input.addEventListener("input", update, { signal });
  update();
}

export async function startPlayground(
  scene: Scene,
  cameraControls: CameraControls,
  character: LoadedCharacter,
  animationPlayer: AnimationPlayer,
  equipment: CharacterEquipment,
  signal: AbortSignal,
): Promise<void> {
  requireElement<HTMLElement>("movementHint").hidden = false;
  bindModuleWindows(signal);
  const { ground, grid, shadows, ambience } = createPlaygroundEnvironment(scene, character.root);
  for (const mesh of equipment.meshes) shadows.addShadowCaster(mesh, false);
  const enemies = createEnemyScene(scene, shadows, ground.position.y);
  const heroPosition = (): Position => [character.root.position.x, ground.position.y, character.root.position.z];
  const refreshEnemyHealth = await startEnemyTools(enemies, ground.position.y,
    (definition) => enemies.findSpawnPosition(definition, heroPosition(), character.root.rotation.y, PLAYGROUND_MOVEMENT_LIMIT), signal);
  const gridToggle = requireElement<HTMLInputElement>("showGrid");
  gridToggle.checked = false;
  gridToggle.addEventListener("change", () => grid.setEnabled(gridToggle.checked), { signal });

  const vitals = createHeroVitals();
  const hud = createHeroHud();
  let controller: ReturnType<typeof createCharacterController> | undefined;
  const maps = createMapSystem(scene, {
    hero: character.root, shadows,
    applyEnvironment: ambience.apply,
    isHeroAlive: () => vitals.isAlive,
    onHeroHit: (damage) => {
      if (vitals.hit(damage, controller?.isInvulnerable ?? false)) controller?.receiveHit();
    },
    onEncounterEvent: hud.event,
    onWorldInteraction: hud.announce,
  });
  bindMapTools(maps, character.root, cameraControls, signal);
  const canvas = requireElement<HTMLCanvasElement>("renderCanvas");
  const worldEditor = bindWorldEditor(scene, canvas, maps, signal);
  const collisions = bindCollisionTools(scene, character.root, enemies, signal,
    (start, step, radius, height) => maps.active?.resolveMovement(start, step, radius, height) ?? step);
  const attackTools = bindAttackTools(scene, character.root, signal);
  const facingInput = requireElement<HTMLInputElement>("facing");
  const facingOutput = requireElement<HTMLOutputElement>("facingOutput");
  controller = createCharacterController(scene, canvas, character.root,
    PLAYGROUND_MOVEMENT_LIMIT, cameraControls, animationPlayer, equipment, signal, () => updateActiveAnimation(), (yaw) => {
      const degrees = String(Math.round(yaw * 180 / Math.PI));
      if (facingInput.value !== degrees) {
        facingInput.value = degrees;
        facingOutput.textContent = degrees + "°";
      }
    }, () => {
      const swing = attackTools.getSwing();
      const dummyHit = enemies.strike(heroPosition(), character.root.rotation.y, swing);
      const worldHit = maps.active?.strike(heroPosition(), character.root.rotation.y, swing) ?? false;
      return dummyHit || worldHit;
    },
    collisions.resolveMovement,
    () => vitals.isAlive && !worldEditor.enabled);
  requireElement<HTMLButtonElement>("simulateHeroHit").addEventListener("click", controller.receiveHit, { signal });
  bindControlSettings(controller.setBindings, signal);
  bindTransitionTools(animationPlayer, signal);
  const updateEquipment = bindEquipmentTools(equipment, () => controller.isActing, controller.previewAttack, signal);
  const updateActiveAnimation = bindAnimationTools(animationPlayer, controller,
    new Set(character.animationGroups.map(({ name }) => name)), signal);
  for (const animation of character.animationGroups) {
    animation.onAnimationGroupEndObservable.add(() => queueMicrotask(updateActiveAnimation));
  }
  const mapEnemyCount = requireElement("mapEnemyCount");
  scene.onBeforeRenderObservable.add(() => {
    const delta = scene.getEngine().getDeltaTime() / 1000;
    enemies.update(document.hidden ? 0 : delta);
    refreshEnemyHealth();
    updateEquipment();
    attackTools.setAttacking(controller.isAttacking);
    if (!document.hidden && vitals.update(Math.min(delta, 0.1))) {
      const spawn = maps.active?.definition.spawnPoints.find((point) => point.type === "player");
      if (spawn) {
        character.root.position.set(...spawn.position);
        cameraControls.follow(spawn.position[0], spawn.position[2]);
      }
    }
    hud.refresh(vitals);
    const worldEnemies = maps.active?.simulation.list() ?? [];
    const alive = worldEnemies.filter((enemy) => enemy.state !== "inactive" && !enemy.entity.defeated);
    const status = maps.active
      ? `Ennemis actifs : ${alive.length} / ${worldEnemies.length} · ${alive.map((enemy) => enemy.spec.id + " : " + enemy.state).join(", ")}`
      : "Aucune map active.";
    if (mapEnemyCount.textContent !== status) mapEnemyCount.textContent = status;
  });
  linkRangeControl("rotation", "rotationOutput", (n) => `${n}°`, (n) => cameraControls.setRotation(n), signal);
  linkRangeControl("tilt", "tiltOutput", (n) => `${n}°`, (n) => cameraControls.setTilt(n), signal);
  linkRangeControl("zoom", "zoomOutput", (n) => `${n.toFixed(1)} u`, (n) => cameraControls.setVisibleHeight(n), signal);
  linkRangeControl("facing", "facingOutput", (n) => `${n}°`, (n) => {
    if (controller.isActing) {
      facingInput.value = String(Math.round(character.root.rotation.y * 180 / Math.PI));
      facingOutput.textContent = `${facingInput.value}°`;
      return;
    }
    controller.clearAim();
    character.root.rotation.y = degreesToRadians(n);
  }, signal);

  requireElement<HTMLButtonElement>("resetButton").addEventListener("click", () => {
    const settings = [
      ["rotation", String(DEFAULT_CAMERA_ROTATION)],
      ["tilt", String(DEFAULT_CAMERA_TILT)],
      ["zoom", String(DEFAULT_VISIBLE_HEIGHT)],
      ["facing", "0"],
    ];
    for (const [id, value] of settings) {
      const input = requireElement<HTMLInputElement>(id);
      input.value = value;
      input.dispatchEvent(new Event("input"));
    }
  }, { signal });

  requireElement<HTMLParagraphElement>("modelStatus").textContent =
    `hero.glb · ${character.animationGroups.length} animations · échelle ajustée ×${character.scaleApplied.toFixed(1)} · 1,8 m`;
}
