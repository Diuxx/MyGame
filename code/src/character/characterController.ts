import { Plane, type Scene, type TransformNode } from "@babylonjs/core";
import { ATTACK_ANIMATION, DODGE_ANIMATION, type AnimationPlayer } from "./animations";
import { createAnimationSettings, createAttackHits, getAnimationDefinition, HERO_ANIMATIONS, type AnimationSettings } from "./animationSettings";
import { clamp } from "../world/cameraMath";
import { bindHeroInput } from "./heroInput";
import { HERO_TUNING } from "./heroTuning";
import { aimYaw, calculateMovementStep, consumeImpactWindow, dodgeDirection, dodgeInvulnerable, mouseRelativeDirection, type GroundVector } from "./movement";
import type { CameraControls } from "../world/scene";
import type { CharacterEquipment } from "./equipment";

type ActiveAction =
  | { kind: "attack"; progress: number; hits: ReturnType<typeof createAttackHits>; preview: boolean }
  | { kind: "dodge"; progress: number; direction: GroundVector; distance: number }
  | { kind: "preview" };

export function createCharacterController(
  scene: Scene,
  canvas: HTMLCanvasElement,
  root: TransformNode,
  movementLimit: number,
  camera: CameraControls,
  animations: AnimationPlayer,
  equipment: CharacterEquipment,
  signal: AbortSignal,
  onAnimationChange: () => void = () => {},
  onFacingChange: (yaw: number) => void = () => {},
  onAttackImpact: () => boolean = () => false,
) {
  const groundPlane = new Plane(0, 1, 0, 0);
  let wasMoving = false;
  let cursorYaw: number | undefined;
  let action: ActiveAction | undefined;
  let cooldown = 0;
  let combatCrouchRemaining = 0;
  let settings = createAnimationSettings();
  let selectedMovement = HERO_ANIMATIONS.walk;

  function updateCursorYaw(): number | undefined {
    const pointer = input.pointer;
    if (!pointer) return;
    const bounds = canvas.getBoundingClientRect();
    const x = pointer.clientX - bounds.left;
    const y = pointer.clientY - bounds.top;
    if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) return;
    const ray = scene.createPickingRay(x, y, null, scene.activeCamera);
    groundPlane.d = -root.position.y;
    const distance = ray.intersectsPlane(groundPlane);
    if (distance === null) return;
    const dx = ray.origin.x + ray.direction.x * distance - root.position.x;
    const dz = ray.origin.z + ray.direction.z * distance - root.position.z;
    if (Math.hypot(dx, dz) < HERO_TUNING.aimDeadZone) return;
    cursorYaw = Math.atan2(dx, dz);
    return cursorYaw;
  }

  function turn(dx: number, dz: number, delta: number, speed = HERO_TUNING.turnSpeed): void {
    if (!dx && !dz) return;
    root.rotation.y = aimYaw(root.rotation.y, dx, dz, delta, speed, 0);
    onFacingChange(root.rotation.y);
  }

  function canStartAction(): boolean {
    return !action && !animations.isPaused;
  }

  function beginAction(clip: string, next: ActiveAction): void {
    action = next;
    animations.play(clip, true);
    onAnimationChange();
  }

  function attack(preview = false): void {
    if (!canStartAction()) return;
    const yaw = updateCursorYaw() ?? root.rotation.y;
    turn(Math.sin(yaw), Math.cos(yaw), 1, Infinity);
    equipment.transition(true);
    beginAction(ATTACK_ANIMATION, { kind: "attack", progress: 0, hits: createAttackHits(settings[ATTACK_ANIMATION].impact!), preview });
  }

  function startDodge(horizontal: number, vertical: number): void {
    if (!canStartAction() || cooldown > 0) return;
    const requested = horizontal || vertical
      ? mouseRelativeDirection(horizontal, vertical, updateCursorYaw() ?? cursorYaw ?? root.rotation.y)
      : { x: 0, z: 0 };
    const direction = dodgeDirection(requested, root.rotation.y);
    turn(direction.x, direction.z, 1, Infinity);
    cooldown = HERO_TUNING.dodge.cooldown;
    beginAction(DODGE_ANIMATION, { kind: "dodge", direction, progress: 0, distance: settings[DODGE_ANIMATION].dodge!.distance });
  }

  function move(step: GroundVector): GroundVector {
    const { position } = root;
    const x = clamp(position.x + step.x, -movementLimit, movementLimit);
    const z = clamp(position.z + step.z, -movementLimit, movementLimit);
    const actual = { x: x - position.x, z: z - position.z };
    if (actual.x || actual.z) {
      position.x = x;
      position.z = z;
      camera.follow(x, z);
    }
    return actual;
  }

  function refreshCombatCrouch(): void {
    combatCrouchRemaining = HERO_TUNING.combatCrouchDuration;
  }

  function isInvulnerable(): boolean {
    return action?.kind === "dodge" && dodgeInvulnerable(animations.actionProgress, settings[DODGE_ANIMATION].dodge!.window);
  }

  function updateAction(active: ActiveAction): void {
    if (active.kind === "attack" && (animations.activeName !== ATTACK_ANIMATION || animations.isActionInterrupted)) {
      finishAction(active);
      return;
    }
    const progress = animations.actionProgress;
    if (active.kind === "dodge") {
      const distance = active.distance * Math.max(0, progress - active.progress);
      move({ x: active.direction.x * distance, z: active.direction.z * distance });
      active.progress = progress;
    } else if (active.kind === "attack" && !active.preview) {
      for (const hit of active.hits) {
        if (consumeImpactWindow(hit, active.progress, progress) && onAttackImpact()) {
          refreshCombatCrouch();
        }
      }
      active.progress = progress;
    }
    if (progress >= 1) finishAction(active);
  }

  function finishAction(active: ActiveAction): void {
    if (active.kind === "attack") equipment.transition(false);
    action = undefined;
    // Force one locomotion update even when no movement key is held.
    wasMoving = true;
  }

  const input = bindHeroInput(canvas, attack, startDodge, signal);
  scene.onBeforeRenderObservable.add(() => {
    const { horizontal, vertical, running } = input.readMovement(!!action);
    if (animations.isPaused || document.hidden) return;
    const delta = scene.getEngine().getDeltaTime() / 1000;
    cooldown = Math.max(0, cooldown - delta);
    combatCrouchRemaining = Math.max(0, combatCrouchRemaining - delta);
    if (action) updateAction(action);
    if (action) return;

    const inCombat = combatCrouchRemaining > 0;
    const restChanged = animations.setCombatIdle(inCombat);
    const movement = inCombat
      ? HERO_ANIMATIONS.crouch
      : running ? HERO_ANIMATIONS.run : selectedMovement;
    let actual: GroundVector = { x: 0, z: 0 };
    if (horizontal || vertical) {
      cursorYaw = updateCursorYaw() ?? cursorYaw ?? root.rotation.y;
      const direction = mouseRelativeDirection(horizontal, vertical, cursorYaw);
      const speed = settings[movement.id].movement!.speed;
      actual = move(calculateMovementStep(direction, delta, speed));
      if (actual.x || actual.z) {
        const yaw = Math.atan2(actual.x, actual.z) + (movement.movement?.facingOffset ?? 0);
        turn(Math.sin(yaw), Math.cos(yaw), delta);
      }
    }
    const moving = !!(actual.x || actual.z);
    if (moving || wasMoving || restChanged) {
      const previous = animations.activeName;
      animations.updateLocomotion(actual, root.rotation.y, running, "exploration", delta, movement.id);
      if (previous !== animations.activeName) onAnimationChange();
    }
    wasMoving = moving || animations.isTransitioning;
  });

  return {
    attack,
    previewAttack: () => attack(true),
    receiveHit() {
      if (!isInvulnerable()) refreshCombatCrouch();
    },
    preview(id: string) {
      if (!canStartAction()) return;
      if (getAnimationDefinition(id)?.category === "action") {
        beginAction(id, { kind: "preview" });
        return;
      }
      if (animations.activeName === id && getAnimationDefinition(id)?.loop) return;
      wasMoving = false;
      animations.play(id);
    },
    selectMovement(id: string) {
      const definition = getAnimationDefinition(id);
      selectedMovement = definition?.movement?.facingOffset !== undefined ? definition : HERO_ANIMATIONS.walk;
    },
    setAnimationSettings(value: AnimationSettings) {
      settings = value;
      animations.setSettings(value);
    },
    setBindings: input.setBindings,
    clearAim() {
      cursorYaw = undefined;
      input.clearAim();
    },
    get isActing() { return !!action; },
    get isInvulnerable() { return isInvulnerable(); },
  };
}
