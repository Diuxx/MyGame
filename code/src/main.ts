import { Engine, Scene } from "@babylonjs/core";
import { AnimationPlayer, IDLE_ANIMATION } from "./character/animations";
import { loadCharacter } from "./character/character";
import { createCharacterController } from "./character/characterController";
import { createHeroLifecycle } from "./character/heroLifecycle";
import { requireElement } from "./ui/dom";
import { createGameplayEnvironment, PLAYGROUND_MOVEMENT_LIMIT } from "./world/environments";
import { createCamera } from "./world/scene";
import { createMapSystem } from "./world/maps/mapSystem";
import { SWORD_SWING } from "./combat/combat";
import { resolveHeroSwing } from "./combat/heroAttack";
import { loadHeroState } from "./character/heroState";
import { createHeroHud } from "./ui/heroHud";
import { createFloatingTextSystem } from "./ui/floatingTextSystem";
import { loadFloatingTextConfig } from "./ui/floatingTextConfig";
import { createTargetLockSystem } from "./character/targetLockSystem";
import { createTargetingSettings } from "./character/targetingSettings";
import { collectMapTargetCandidates } from "./enemies/targetCandidates";

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

    const heroState = await loadHeroState();
    const character = await loadCharacter(scene);
    const animationPlayer = new AnimationPlayer(character.animationGroups, scene);
    animationPlayer.play(IDLE_ANIMATION);

    // The Playground sidebar changes the canvas width, so reveal it before sizing the camera.
    if (mode === "playground") requireElement("playgroundPanel").hidden = false;
    const camera = createCamera(scene, canvas, signal);
    if (mode === "playground") {
      const { startPlayground } = await import("./playground");
      await startPlayground(scene, camera, character, animationPlayer, signal, heroState);
    } else {
      const floatingText = createFloatingTextSystem(scene, canvas, loadFloatingTextConfig());
      const { shadows, ambience } = createGameplayEnvironment(scene, character.root);
      const lifecycle = createHeroLifecycle(character.root, camera, animationPlayer, heroState.stats.maxHealth);
      const { vitals } = lifecycle;
      const hud = createHeroHud(signal, heroState.baseStats);
      hud.setEquipment(heroState.equipment.mainHand);
      let controller: ReturnType<typeof createCharacterController> | undefined;
      let targetLock: ReturnType<typeof createTargetLockSystem> | undefined;
      const maps = createMapSystem(scene, {
        hero: character.root, shadows,
        applyEnvironment: ambience.apply,
        isHeroAlive: () => vitals.isAlive,
        onHeroHit: (damage) => lifecycle.hit(damage, controller),
        onDamage: (damage) => {
          floatingText.showDamage(damage);
          targetLock?.lockOnHit("map:" + damage.targetId);
        },
        onEncounterEvent: hud.event,
        onWorldInteraction: hud.announce,
      });
      const loadedMap = await maps.load("dojo");
      const spawn = loadedMap?.definition.spawnPoints.find((point) => point.type === "player");
      if (spawn) {
        character.root.position.set(...spawn.position);
        character.root.rotation.y = spawn.rotationY * Math.PI / 180;
        camera.follow(character.root.position.x, character.root.position.z);
      }
      targetLock = createTargetLockSystem(scene, character.root,
        () => collectMapTargetCandidates(maps.world?.simulation.list() ?? []),
        () => vitals.isAlive, signal);
      targetLock.setSettings(createTargetingSettings());
      controller = createCharacterController(scene, canvas, character.root,
        PLAYGROUND_MOVEMENT_LIMIT, camera, animationPlayer, signal,
        undefined, undefined,
        () => maps.active?.strike([
          character.root.position.x, character.root.position.y, character.root.position.z,
        ], character.root.rotation.y, resolveHeroSwing(SWORD_SWING, heroState.stats.attack)) ?? false,
        (start, step) => maps.active?.resolveMovement(start, step, 0.4) ?? step,
        () => vitals.isAlive,
        (actionId) => {
          hud.flashSpell(actionId);
          floatingText.showAction('hero', actionId, character.root);
        }, maps.interact);
      controller.setTargetingProvider(() => targetLock?.motion);
      controller.setTargetingActions({
        cycle: () => targetLock?.cycleTarget(),
        cancel: () => targetLock?.clearTarget(),
      });
      scene.onBeforeRenderObservable.add(() => {
        lifecycle.update(scene.getEngine().getDeltaTime() / 1000, controller,
          maps.active?.definition.spawnPoints.find((entry) => entry.type === "player"));
        hud.refresh(vitals);
        hud.nearby(maps.active?.nearInteraction()?.label);
      });
      requireElement("movementHint").hidden = false;
    }

    const resize = engine.resize.bind(engine);
    const render = scene.render.bind(scene);
    const renderFps = requireElement("renderFps");
    let lastFpsUpdate = performance.now();
    scene.onAfterRenderObservable.add(() => {
      const now = performance.now();
      if (now - lastFpsUpdate < 500 || document.hidden) return;
      lastFpsUpdate = now;
      const label = `${Math.round(scene.getEngine().getFps())} FPS`;
      if (renderFps.textContent !== label) renderFps.textContent = label;
    });
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
