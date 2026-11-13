import { Engine, Scene } from "@babylonjs/core";
import { AnimationPlayer, ANIMATION_LABELS, ATTACK_ANIMATION, IDLE_ANIMATION } from "./animations";
import { buildPlayground, DEFAULT_CAMERA_TILT, DEFAULT_VISIBLE_HEIGHT, GROUND_HALF_SIZE } from "./scene";
import { loadCharacter } from "./character";
import { clamp, degreesToRadians } from "./cameraMath";
import { calculateMovementStep } from "./movement";
import "./style.css";

const MOVEMENT_KEYS = new Set(["z", "q", "s", "d", "shift"]);
const MOVEMENT_LIMIT = GROUND_HALF_SIZE - 1;

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Élément HTML manquant : ${id}`);
  return element as T;
}

function linkRangeControl(
  inputId: string,
  outputId: string,
  formatter: (value: number) => string,
  onChange: (value: number) => void,
): void {
  const input = requireElement<HTMLInputElement>(inputId);
  const output = requireElement<HTMLOutputElement>(outputId);
  const update = () => {
    const value = Number(input.value);
    output.textContent = formatter(value);
    onChange(value);
  };
  input.addEventListener("input", update);
  update();
}

async function start(): Promise<void> {
  const canvas = requireElement<HTMLCanvasElement>("renderCanvas");
  const overlay = requireElement<HTMLDivElement>("loadingOverlay");
  const engine = new Engine(canvas, true, { stencil: true });
  const scene = new Scene(engine);
  const cameraControls = buildPlayground(scene, canvas);
  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());

  try {
    const character = await loadCharacter(scene);
    const animationPlayer = new AnimationPlayer(character.animationGroups);
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
      });
      buttonsContainer.append(button);
    }
    animationPlayer.play(IDLE_ANIMATION);
    // A one-shot animation automatically returns to Idle. Refresh its button state.
    const attack = character.animationGroups.find((group) => group.name === ATTACK_ANIMATION);
    attack?.onAnimationGroupEndObservable.add(() => queueMicrotask(updateActiveAnimation));
    updateActiveAnimation();

    pauseButton.disabled = false;
    pauseButton.addEventListener("click", () => {
      animationPlayer.togglePause();
      updateActiveAnimation();
    });

    linkRangeControl("speed", "speedOutput", (n) => `${n.toFixed(2)}×`, (n) => animationPlayer.setSpeed(n));
    linkRangeControl("tilt", "tiltOutput", (n) => `${n}°`, (n) => cameraControls.setTilt(n));
    linkRangeControl("zoom", "zoomOutput", (n) => `${n.toFixed(1)} u`, (n) => cameraControls.setVisibleHeight(n));
    const facingInput = requireElement<HTMLInputElement>("facing");
    const facingOutput = requireElement<HTMLOutputElement>("facingOutput");
    linkRangeControl("facing", "facingOutput", (n) => `${n}°`, (n) => {
      character.root.rotation.y = degreesToRadians(n);
    });

    const pressed = new Set<string>();
    const keyboardListeners = new AbortController();
    const listenerOptions = { signal: keyboardListeners.signal };
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
    scene.onDisposeObservable.addOnce(() => keyboardListeners.abort());

    let wasMoving = false;
    scene.onBeforeRenderObservable.add(() => {
      if (animationPlayer.isPaused || animationPlayer.activeName === ATTACK_ANIMATION) return;

      const horizontal = Number(pressed.has("d")) - Number(pressed.has("q"));
      const vertical = Number(pressed.has("z")) - Number(pressed.has("s"));
      const running = pressed.has("shift");
      const step = calculateMovementStep(horizontal, vertical, cameraControls.alpha, engine.getDeltaTime() / 1000, running);
      const { position, rotation } = character.root;
      const x = clamp(position.x + step.x, -MOVEMENT_LIMIT, MOVEMENT_LIMIT);
      const z = clamp(position.z + step.z, -MOVEMENT_LIMIT, MOVEMENT_LIMIT);
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
      cameraControls.reset();
      const settings = [
        ["tilt", String(DEFAULT_CAMERA_TILT)],
        ["zoom", String(DEFAULT_VISIBLE_HEIGHT)],
        ["facing", "0"],
      ];
      for (const [id, value] of settings) {
        const input = requireElement<HTMLInputElement>(id);
        input.value = value;
        input.dispatchEvent(new Event("input"));
      }
    });

    requireElement<HTMLParagraphElement>("modelStatus").textContent =
      `hero.glb · ${character.animationGroups.length} animations · échelle ajustée ×${character.scaleApplied.toFixed(1)} · 1,8 m`;
    overlay.hidden = true;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    overlay.textContent = `Échec du chargement : ${details}`;
    overlay.classList.add("error");
    requireElement<HTMLParagraphElement>("modelStatus").textContent = details;
    console.error("Playground initialization failed", error);
  }
}

void start();
