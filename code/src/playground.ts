import type { Scene } from "@babylonjs/core";
import { AnimationPlayer, ANIMATION_LABELS, ATTACK_ANIMATION } from "./character/animations";
import type { LoadedCharacter } from "./character/character";
import { createCharacterController } from "./character/characterController";
import { SWORD_SWING, type Position } from "./combat/combat";
import { createEnemyScene } from "./enemies/enemyScene";
import { startEnemyTools } from "./playground/enemyTools";
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
  signal: AbortSignal,
): Promise<void> {
  requireElement<HTMLElement>("movementHint").hidden = false;
  const { ground, grid, shadows } = createPlaygroundEnvironment(scene, character.root);
  const enemies = createEnemyScene(scene, shadows, ground.position.y);
  const heroPosition = (): Position => [character.root.position.x, ground.position.y, character.root.position.z];
  const refreshEnemyHealth = await startEnemyTools(enemies, ground.position.y,
    (definition) => enemies.findSpawnPosition(definition, heroPosition(), character.root.rotation.y, PLAYGROUND_MOVEMENT_LIMIT), signal);
  const gridToggle = requireElement<HTMLInputElement>("showGrid");
  gridToggle.checked = false;
  gridToggle.addEventListener("change", () => grid.setEnabled(gridToggle.checked), { signal });

  const buttonsContainer = requireElement<HTMLDivElement>("animationButtons");
  const pauseButton = requireElement<HTMLButtonElement>("pauseButton");
  const animationStatus = requireElement<HTMLParagraphElement>("animationStatus");
  const canvas = requireElement<HTMLCanvasElement>("renderCanvas");
  const facingInput = requireElement<HTMLInputElement>("facing");
  const facingOutput = requireElement<HTMLOutputElement>("facingOutput");
  function updateActiveAnimation(): void {
    buttonsContainer.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      const active = button.dataset.animation === animationPlayer.activeName;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    pauseButton.textContent = animationPlayer.isPaused ? "Reprendre" : "Pause";
    animationStatus.textContent = `Animation : ${animationPlayer.activeName}`;
  }

  let pendingImpact = false;
  const attack = character.animationGroups.find((group) => group.name === ATTACK_ANIMATION);
  function impact(): void {
    if (!pendingImpact) return;
    pendingImpact = false;
    enemies.strike(heroPosition(), character.root.rotation.y);
  }

  const controller = createCharacterController(scene, canvas, character.root, ground.position.y,
    PLAYGROUND_MOVEMENT_LIMIT, cameraControls, animationPlayer, signal, updateActiveAnimation, (yaw) => {
      const degrees = String(Math.round(yaw * 180 / Math.PI));
      if (facingInput.value !== degrees) {
        facingInput.value = degrees;
        facingOutput.textContent = degrees + "°";
      }
    }, () => { pendingImpact = true; });

  for (const animation of character.animationGroups) {
    animation.onAnimationGroupEndObservable.add(() => queueMicrotask(updateActiveAnimation));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "animation-option";
    button.dataset.animation = animation.name;
    button.textContent = ANIMATION_LABELS[animation.name] ?? animation.name;
    button.title = animation.name;
    button.addEventListener("click", () => {
      if (animation.name === ATTACK_ANIMATION) controller.attack();
      else {
        pendingImpact = false;
        animationPlayer.play(animation.name);
        updateActiveAnimation();
      }
    }, { signal });
    buttonsContainer.append(button);
  }
  // A one-shot animation automatically returns to Idle. Refresh its button state.
  attack?.onAnimationGroupEndObservable.add(() => {
    // A slow frame can pass the impact frame and the end of the clip together.
    impact();
  });
  scene.onBeforeRenderObservable.add(() => {
    const delta = scene.getEngine().getDeltaTime() / 1000;
    enemies.update(document.hidden ? 0 : delta);
    if (attack && animationPlayer.activeName === ATTACK_ANIMATION && !animationPlayer.isPaused &&
        attack.getCurrentFrame() >= attack.from + (attack.to - attack.from) * SWORD_SWING.impact) {
      impact();
    }
    refreshEnemyHealth();
  });
  updateActiveAnimation();

  pauseButton.disabled = false;
  pauseButton.addEventListener("click", () => {
    animationPlayer.togglePause();
    updateActiveAnimation();
  }, { signal });

  linkRangeControl("speed", "speedOutput", (n) => `${n.toFixed(2)}×`, (n) => animationPlayer.setSpeed(n), signal);
  linkRangeControl("rotation", "rotationOutput", (n) => `${n}°`, (n) => cameraControls.setRotation(n), signal);
  linkRangeControl("tilt", "tiltOutput", (n) => `${n}°`, (n) => cameraControls.setTilt(n), signal);
  linkRangeControl("zoom", "zoomOutput", (n) => `${n.toFixed(1)} u`, (n) => cameraControls.setVisibleHeight(n), signal);
  linkRangeControl("facing", "facingOutput", (n) => `${n}°`, (n) => {
    if (animationPlayer.activeName === ATTACK_ANIMATION) {
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
