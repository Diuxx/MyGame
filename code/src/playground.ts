import type { Scene } from "@babylonjs/core";
import { AnimationPlayer, ANIMATION_LABELS, ATTACK_ANIMATION, IDLE_ANIMATION } from "./animations";
import { clamp, degreesToRadians } from "./cameraMath";
import type { LoadedCharacter } from "./character";
import { requireElement } from "./dom";
import { createPlaygroundEnvironment, PLAYGROUND_MOVEMENT_LIMIT } from "./environments";
import { calculateMovementStep } from "./movement";
import { DEFAULT_CAMERA_ROTATION, DEFAULT_CAMERA_TILT, DEFAULT_VISIBLE_HEIGHT, type CameraControls } from "./scene";
import { loadTrainingTargets } from "./trainingTargets";

const MOVEMENT_KEYS = new Set(["z", "q", "s", "d", "shift"]);

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
  for (const mesh of await loadTrainingTargets(scene, ground.position.y)) {
    shadows.addShadowCaster(mesh, false);
  }
  const gridToggle = requireElement<HTMLInputElement>("showGrid");
  gridToggle.checked = false;
  gridToggle.addEventListener("change", () => grid.setEnabled(gridToggle.checked), { signal });

  const buttonsContainer = requireElement<HTMLDivElement>("animationButtons");
  const pauseButton = requireElement<HTMLButtonElement>("pauseButton");
  const animationStatus = requireElement<HTMLParagraphElement>("animationStatus");

  function updateActiveAnimation(): void {
    buttonsContainer.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      const active = button.dataset.animation === animationPlayer.activeName;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    pauseButton.textContent = animationPlayer.isPaused ? "Reprendre" : "Pause";
    animationStatus.textContent = `Animation : ${animationPlayer.activeName}`;
  }

  for (const animation of character.animationGroups) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "animation-option";
    button.dataset.animation = animation.name;
    button.textContent = ANIMATION_LABELS[animation.name] ?? animation.name;
    button.title = animation.name;
    button.addEventListener("click", () => {
      animationPlayer.play(animation.name);
      updateActiveAnimation();
    }, { signal });
    buttonsContainer.append(button);
  }
  // A one-shot animation automatically returns to Idle. Refresh its button state.
  const attack = character.animationGroups.find((group) => group.name === ATTACK_ANIMATION);
  attack?.onAnimationGroupEndObservable.add(() => queueMicrotask(updateActiveAnimation));
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
  const facingInput = requireElement<HTMLInputElement>("facing");
  const facingOutput = requireElement<HTMLOutputElement>("facingOutput");
  linkRangeControl("facing", "facingOutput", (n) => `${n}°`, (n) => {
    character.root.rotation.y = degreesToRadians(n);
  }, signal);

  const pressed = new Set<string>();
  const listenerOptions = { signal };
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (event.ctrlKey || event.altKey || event.metaKey || !MOVEMENT_KEYS.has(key)) return;
    pressed.add(key);
  }, listenerOptions);
  window.addEventListener("keyup", (event) => {
    pressed.delete(event.key.toLowerCase());
  }, listenerOptions);
  window.addEventListener("blur", () => pressed.clear(), listenerOptions);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pressed.clear();
  }, listenerOptions);

  let wasMoving = false;
  scene.onBeforeRenderObservable.add(() => {
    if (animationPlayer.isPaused || animationPlayer.activeName === ATTACK_ANIMATION) return;

    const horizontal = Number(pressed.has("d")) - Number(pressed.has("q"));
    const vertical = Number(pressed.has("z")) - Number(pressed.has("s"));
    const running = pressed.has("shift");
    const step = calculateMovementStep(horizontal, vertical, cameraControls.alpha, scene.getEngine().getDeltaTime() / 1000, running);
    const { position, rotation } = character.root;
    const x = clamp(position.x + step.x, -PLAYGROUND_MOVEMENT_LIMIT, PLAYGROUND_MOVEMENT_LIMIT);
    const z = clamp(position.z + step.z, -PLAYGROUND_MOVEMENT_LIMIT, PLAYGROUND_MOVEMENT_LIMIT);
    const moving = x !== position.x || z !== position.z;

    if (moving) {
      rotation.y = Math.atan2(x - position.x, z - position.z);
      facingInput.value = String(Math.round(rotation.y * 180 / Math.PI));
      facingOutput.textContent = `${facingInput.value}°`;
      position.x = x;
      position.z = z;
      cameraControls.follow(x, z);
    }

    // Leave manual previews alone until the player moves.
    if (moving || wasMoving) {
      const name = moving ? (running ? "Running" : "Walking") : IDLE_ANIMATION;
      if (animationPlayer.activeName !== name) {
        animationPlayer.play(name);
        updateActiveAnimation();
      }
    }
    wasMoving = moving;
  });

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
