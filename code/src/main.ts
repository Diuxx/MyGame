import { Engine, Scene } from "@babylonjs/core";
import { AnimationPlayer, IDLE_ANIMATION } from "./character/animations";
import { loadCharacter } from "./character/character";
import { createCharacterController } from "./character/characterController";
import { loadEquipment } from "./character/equipment";
import { requireElement } from "./ui/dom";
import { createGameplayEnvironment, PLAYGROUND_MOVEMENT_LIMIT } from "./world/environments";
import { createCamera } from "./world/scene";

async function start(): Promise<void> {
  const overlay = requireElement<HTMLDivElement>("loadingOverlay");
  const listeners = new AbortController();
  const { signal } = listeners;
  let engine: Engine | undefined;

  try {
    const viteMode = import.meta.env.MODE;
    const mode = viteMode === "production" || viteMode === "development" ? "playground" : viteMode;
    if (mode !== "playground" && mode !== "gameplay") {
      throw new Error(`Mode inconnu : ${mode}`);
    }

    const app = requireElement<HTMLElement>("app");
    app.dataset.mode = mode;
    document.title = mode === "playground" ? "Idle RPG — Playground 3D" : "Idle RPG — Gameplay";
    requireElement("modeLabel").textContent = `/ ${mode.toUpperCase()}`;

    await import("./style.css");
    const canvas = requireElement<HTMLCanvasElement>("renderCanvas");
    engine = new Engine(canvas, true, { stencil: true });
    const scene = new Scene(engine);
    scene.onDisposeObservable.addOnce(() => listeners.abort());

    const character = await loadCharacter(scene);
    const equipment = await loadEquipment(scene, character);
    const animationPlayer = new AnimationPlayer(character.animationGroups);
    animationPlayer.play(IDLE_ANIMATION);

    // The Playground sidebar changes the canvas width, so reveal it before sizing the camera.
    if (mode === "playground") requireElement("playgroundPanel").hidden = false;
    const camera = createCamera(scene, canvas, signal);
    if (mode === "playground") {
      const { startPlayground } = await import("./playground");
      await startPlayground(scene, camera, character, animationPlayer, equipment, signal);
    } else {
      const { shadows } = createGameplayEnvironment(scene, character.root);
      for (const mesh of equipment.meshes) shadows.addShadowCaster(mesh, false);
      createCharacterController(scene, canvas, character.root,
        PLAYGROUND_MOVEMENT_LIMIT, camera, animationPlayer, equipment, signal);
      requireElement("movementHint").hidden = false;
    }

    const resize = engine.resize.bind(engine);
    const render = scene.render.bind(scene);
    resize();
    window.addEventListener("resize", () => resize(), { signal });
    await scene.whenReadyAsync();
    render();
    engine.runRenderLoop(render);
    if (import.meta.hot) import.meta.hot.dispose(() => engine?.dispose());
    app.inert = false;
    overlay.hidden = true;
  } catch (error) {
    listeners.abort();
    engine?.dispose();
    const details = error instanceof Error ? error.message : String(error);
    overlay.textContent = `Échec du chargement : ${details}`;
    overlay.classList.add("error");
    console.error("Application initialization failed", error);
  }
}

void start();
