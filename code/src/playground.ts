import type { Scene } from "@babylonjs/core";
import { type AnimationPlayer } from "./character/animations";
import type { LoadedCharacter } from "./character/character";
import { createCharacterController } from "./character/characterController";
import type { Position } from "./combat/combat";
import type { HeroState } from "./character/heroState";
import { createEnemyScene } from "./enemies/enemyScene";
import { startEnemyTools } from "./playground/enemyTools";
import { bindCollisionTools } from "./playground/collisionTools";
import { bindMapTools } from "./playground/mapTools";
import { bindWorldEditor } from "./playground/worldEditor";
import { createMapSystem } from "./world/maps/mapSystem";
import { createHeroLifecycle } from "./character/heroLifecycle";
import { createHeroHud } from "./ui/heroHud";
import { createFloatingTextSystem } from "./ui/floatingTextSystem";
import { loadFloatingTextConfig } from "./ui/floatingTextConfig";
import { bindFloatingTextTools } from "./playground/floatingTextTools";
import { bindAttackTools } from "./playground/attackTools";
import { bindTransitionTools } from "./playground/transitionTools";
import { bindModuleWindows } from "./playground/moduleWindows";
import { bindControlSettings } from "./playground/controlSettings";
import { bindAnimationTools } from "./playground/animationTools";
import { requireElement } from "./ui/dom";
import { degreesToRadians } from "./world/cameraMath";
import { createPlaygroundEnvironment, PLAYGROUND_MOVEMENT_LIMIT } from "./world/environments";
import {
  DEFAULT_CAMERA_ROTATION, DEFAULT_CAMERA_TILT, DEFAULT_VISIBLE_HEIGHT,
  MIN_VISIBLE_HEIGHT, MAX_VISIBLE_HEIGHT, type CameraControls,
} from "./world/scene";

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
  signal: AbortSignal,
  heroState: HeroState,
): Promise<void> {
  requireElement<HTMLElement>("movementHint").hidden = false;
  bindModuleWindows(signal);
  const { ground, grid, shadows, ambience } = createPlaygroundEnvironment(scene, character.root);
  const canvas = requireElement<HTMLCanvasElement>("renderCanvas");
  const floatingText = createFloatingTextSystem(scene, canvas, loadFloatingTextConfig());
  const enemies = createEnemyScene(scene, shadows, ground.position.y, floatingText.showDamage);
  const heroPosition = (): Position => [character.root.position.x, ground.position.y, character.root.position.z];
  const refreshEnemyHealth = await startEnemyTools(enemies, ground.position.y,
    (definition) => enemies.findSpawnPosition(definition, heroPosition(), character.root.rotation.y, PLAYGROUND_MOVEMENT_LIMIT), signal);
  const gridToggle = requireElement<HTMLInputElement>("showGrid");
  gridToggle.checked = false;
  gridToggle.addEventListener("change", () => grid.setEnabled(gridToggle.checked), { signal });

  const lifecycle = createHeroLifecycle(character.root, cameraControls, animationPlayer, heroState.stats.maxHealth);
  const { vitals } = lifecycle;
  const hud = createHeroHud();
  hud.setEquipment(heroState.equipment.mainHand);
  let controller: ReturnType<typeof createCharacterController> | undefined;
  const maps = createMapSystem(scene, {
    hero: character.root, shadows,
    applyEnvironment: ambience.apply,
    isHeroAlive: () => vitals.isAlive,
    onHeroHit: (damage) => lifecycle.hit(damage, controller),
    onDamage: floatingText.showDamage,
    onEncounterEvent: hud.event,
    onWorldInteraction: hud.announce,
  });
  const tileSize = 2;
  const gridSize = PLAYGROUND_MOVEMENT_LIMIT * 2 / tileSize;
  await maps.openBase({
    version: 1, id: "playground", name: "Playground", tileSize,
    terrain: {
      origin: [-PLAYGROUND_MOVEMENT_LIMIT, 0, -PLAYGROUND_MOVEMENT_LIMIT],
      tiles: Array.from({ length: gridSize }, () => Array<null>(gridSize).fill(null)),
      groundCollider: { enabled: false, thickness: 0.1 },
    },
    objects: [], spawnPoints: [{ id: "hero", type: "player", position: [0, 0, 0], rotationY: 0 }],
  });
  bindMapTools(maps, character.root, cameraControls, signal);
  bindFloatingTextTools(floatingText, character.root, signal);
  const worldEditor = bindWorldEditor(scene, canvas, maps, enemies, signal);
  const collisions = bindCollisionTools(scene, character.root, enemies, signal,
    (start, step, radius, height) => maps.world?.resolveMovement(start, step, radius, height) ?? step);
  const attackTools = bindAttackTools(scene, character.root, signal, () => heroState.stats.attack);
  const facingInput = requireElement<HTMLInputElement>("facing");
  const facingOutput = requireElement<HTMLOutputElement>("facingOutput");
  controller = createCharacterController(scene, canvas, character.root,
    PLAYGROUND_MOVEMENT_LIMIT, cameraControls, animationPlayer, signal, () => updateActiveAnimation(), (yaw) => {
      const degrees = String(Math.round(yaw * 180 / Math.PI));
      if (facingInput.value !== degrees) {
        facingInput.value = degrees;
        facingOutput.textContent = degrees + "°";
      }
    }, () => {
      const swing = attackTools.getSwing();
      const dummyHit = enemies.strike(heroPosition(), character.root.rotation.y, swing);
      const worldHit = maps.world?.strike(heroPosition(), character.root.rotation.y, swing) ?? false;
      return dummyHit || worldHit;
    },
    collisions.resolveMovement,
    () => vitals.isAlive && !worldEditor.enabled,
    (actionId) => floatingText.showAction('hero', actionId, character.root));
  requireElement<HTMLButtonElement>("simulateHeroHit").addEventListener("click", controller.receiveHit, { signal });
  const simulateHeroDeath = requireElement<HTMLButtonElement>("simulateHeroDeath");
  simulateHeroDeath.addEventListener("click", () => {
    lifecycle.defeat(controller);
    simulateHeroDeath.disabled = !vitals.isAlive;
    hud.refresh(vitals);
  }, { signal });
  bindControlSettings(controller.setBindings, signal);
  const transitions = bindTransitionTools(animationPlayer, signal);
  const updateActiveAnimation = bindAnimationTools(animationPlayer, controller,
    new Set(character.animationGroups.map(({ name }) => name)), transitions, signal);
  for (const animation of character.animationGroups) {
    animation.onAnimationGroupEndObservable.add(() => queueMicrotask(updateActiveAnimation));
  }
  const mapEnemyCount = requireElement("mapEnemyCount");
  scene.onBeforeRenderObservable.add(() => {
    const delta = scene.getEngine().getDeltaTime() / 1000;
    enemies.update(document.hidden ? 0 : delta);
    refreshEnemyHealth();
    attackTools.setAttacking(controller.isAttacking);
    lifecycle.update(delta, controller, maps.active?.definition.spawnPoints.find((point) => point.type === "player"));
    simulateHeroDeath.disabled = !vitals.isAlive;
    hud.refresh(vitals);
    hud.nearby(worldEditor.enabled ? undefined : maps.active?.nearInteraction()?.label);
    const activeMap = maps.world;
    const worldEnemies = activeMap?.simulation.list() ?? [];
    const alive = worldEnemies.filter((enemy) => enemy.state !== "inactive" && !enemy.entity.defeated);
    const status = activeMap
      ? `Ennemis actifs : ${alive.length} / ${worldEnemies.length} · ${alive.map((enemy) => {
        const name = activeMap.enemyAnimationName(enemy.spec.id);
        return enemy.spec.id + " : " + enemy.state + (name ? " (" + name + ")" : "");
      }).join(", ")}`
      : "Aucune map active.";
    if (mapEnemyCount.textContent !== status) mapEnemyCount.textContent = status;
  });
  linkRangeControl("rotation", "rotationOutput", (n) => `${n}°`, (n) => cameraControls.setRotation(n), signal);
  linkRangeControl("tilt", "tiltOutput", (n) => `${n}°`, (n) => cameraControls.setTilt(n), signal);
  const zoom = requireElement<HTMLInputElement>("zoom");
  const zoomOutput = requireElement<HTMLOutputElement>("zoomOutput");
  zoom.min = String(MIN_VISIBLE_HEIGHT);
  zoom.max = String(MAX_VISIBLE_HEIGHT);
  function refreshZoom(): void {
    zoom.value = String(cameraControls.visibleHeight);
    zoomOutput.value = `${cameraControls.visibleHeight.toFixed(1)} u`;
  }
  zoom.addEventListener("input", () => {
    cameraControls.setVisibleHeight(zoom.valueAsNumber);
    refreshZoom();
  }, { signal });
  canvas.addEventListener("wheel", refreshZoom, { passive: true, signal });
  refreshZoom();
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
