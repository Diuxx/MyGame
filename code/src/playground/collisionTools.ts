import { Color3, MeshBuilder, StandardMaterial, type Scene, type TransformNode } from "@babylonjs/core";
import type { Position } from "../combat/combat";
import type { GroundStep } from "../combat/bodyCollision";
import { DEFAULT_HERO_COLLISION, parseHeroCollisionSettings, type HeroCollisionSettings } from "../character/heroCollisionSettings";
import type { createEnemyScene } from "../enemies/enemyScene";
import { requireElement } from "../ui/dom";

const STORAGE_KEY = "mygame.playground.hero-collision.v1";

/** Development-only controls and mesh; the collision solver stays independent of Babylon.js. */
export function bindCollisionTools(
  scene: Scene,
  hero: TransformNode,
  enemies: ReturnType<typeof createEnemyScene>,
  signal: AbortSignal,
) {
  const enabled = requireElement<HTMLInputElement>("heroSolid");
  const showHero = requireElement<HTMLInputElement>("heroHitboxVisible");
  const showEnemyHurtboxes = requireElement<HTMLInputElement>("enemyHitboxesVisible");
  const showEnemyColliders = requireElement<HTMLInputElement>("enemyCollidersVisible");
  const radius = requireElement<HTMLInputElement>("heroCollisionRadius");
  const height = requireElement<HTMLInputElement>("heroCollisionHeight");
  const offsetY = requireElement<HTMLInputElement>("heroCollisionOffset");
  const status = requireElement<HTMLParagraphElement>("heroCollisionStatus");
  const reset = requireElement<HTMLButtonElement>("heroCollisionReset");

  let settings: HeroCollisionSettings = { ...DEFAULT_HERO_COLLISION };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) settings = parseHeroCollisionSettings(JSON.parse(saved));
  } catch (error) {
    status.textContent = `Réglages illisibles, valeurs par défaut : ${error instanceof Error ? error.message : String(error)}`;
  }

  const material = new StandardMaterial("heroHurtboxRed", scene);
  material.disableLighting = true;
  material.emissiveColor = Color3.FromHexString("#FF3655");
  material.alpha = 0.42;
  material.wireframe = true;
  material.backFaceCulling = false;
  const hitbox = MeshBuilder.CreateCylinder("hero-hurtbox-debug", {
    diameter: 2, height: 1, tessellation: 32,
  }, scene);
  hitbox.material = material;
  hitbox.isPickable = false;

  function showSettings(): void {
    enabled.checked = settings.enabled;
    showHero.checked = settings.showHero;
    showEnemyHurtboxes.checked = settings.showEnemyHurtboxes;
    showEnemyColliders.checked = settings.showEnemyColliders;
    radius.value = String(settings.radius);
    height.value = String(settings.height);
    offsetY.value = String(settings.offsetY);
    hitbox.scaling.set(settings.radius, settings.height, settings.radius);
    hitbox.setEnabled(settings.showHero);
    enemies.showHurtboxes(settings.showEnemyHurtboxes);
    enemies.showColliders(settings.showEnemyColliders);
  }

  function readInputs(): HeroCollisionSettings {
    return parseHeroCollisionSettings({
      enabled: enabled.checked,
      showHero: showHero.checked,
      showEnemyHurtboxes: showEnemyHurtboxes.checked,
      showEnemyColliders: showEnemyColliders.checked,
      radius: radius.valueAsNumber,
      height: height.valueAsNumber,
      offsetY: offsetY.valueAsNumber,
    });
  }

  function updateSettings(): void {
    try {
      settings = readInputs();
      showSettings();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      status.textContent = "";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
      showSettings();
    }
  }

  for (const element of [enabled, showHero, showEnemyHurtboxes, showEnemyColliders, radius, height, offsetY]) {
    element.addEventListener("change", updateSettings, { signal });
  }
  reset.addEventListener("click", () => {
    settings = { ...DEFAULT_HERO_COLLISION };
    showSettings();
    updateSettings();
  }, { signal });

  const updatePosition = scene.onBeforeCameraRenderObservable.add(() => {
    hitbox.position.set(hero.position.x, hero.position.y + settings.offsetY, hero.position.z);
  });
  signal.addEventListener("abort", () => {
    scene.onBeforeCameraRenderObservable.remove(updatePosition);
    hitbox.dispose();
    material.dispose();
  }, { once: true });
  showSettings();

  return {
    resolveMovement(start: Position, desired: GroundStep): GroundStep {
      return settings.enabled
        ? enemies.resolveMovement(start, desired, settings.radius)
        : desired;
    },
  };
}
