import { Plane, type Scene, type TransformNode } from "@babylonjs/core";
import { ATTACK_ANIMATION, DEATH_ANIMATION, DODGE_ANIMATION, IDLE_ANIMATION, type AnimationPlayer } from "./animations";
import { createAnimationSettings, createAttackHits, getAnimationDefinition, HERO_ANIMATIONS, type AnimationSettings } from "./animationSettings";
import { clamp } from "../world/cameraMath";
import type { Position } from "../combat/combat";
import { bindHeroInput } from "./heroInput";
import { allowsLocomotion } from "./animationLayers";
import { HERO_TUNING } from "./heroTuning";
import { aimYaw, calculateMovementStep, consumeImpactWindow, dodgeDirection, dodgeInvulnerable, dodgeTravelProgress, mouseRelativeDirection, type GroundVector } from "./movement";
import type { CameraControls } from "../world/scene";

type ActiveAction =
  | { kind: "attack"; progress: number; hits: ReturnType<typeof createAttackHits> }
  | { kind: "dodge"; progress: number; direction: GroundVector; distance: number }
  | { kind: "preview" | "stop" };

export function createCharacterController(
  scene: Scene,
  canvas: HTMLCanvasElement,
  root: TransformNode,
  movementLimit: number,
  camera: CameraControls,
  animations: AnimationPlayer,
  signal: AbortSignal,
  onAnimationChange: () => void = () => {},
  onFacingChange: (yaw: number) => void = () => {},
  onAttackImpact: () => boolean = () => false,
  resolveMovement: (start: Position, step: GroundVector) => GroundVector = (_start, step) => step,
  isInputEnabled: () => boolean = () => true,
) {
  const groundPlane = new Plane(0, 1, 0, 0);
  let wasMoving = false;
  let wasSprinting = false;
  let cursorYaw: number | undefined;
  let action: ActiveAction | undefined;
  let cooldown = 0;
  let combatStanceRemaining = 0;
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
    return isInputEnabled() && (!action || action.kind === "stop") && !animations.isPaused;
  }

  function beginAction(clip: string, next: ActiveAction): void {
    if (action?.kind === "stop") finishAction();
    wasSprinting = false;
    action = next;
    animations.play(clip, true, next.kind === "attack");
    onAnimationChange();
  }

  function attack(): void {
    if (!canStartAction()) return;
    const yaw = updateCursorYaw() ?? root.rotation.y;
    turn(Math.sin(yaw), Math.cos(yaw), 1, Infinity);
    beginAction(ATTACK_ANIMATION, { kind: "attack", progress: 0, hits: createAttackHits(settings[ATTACK_ANIMATION].impact!) });
  }

  function startDodge(): void {
    if (!canStartAction() || cooldown > 0) return;
    const direction = dodgeDirection(root.rotation.y);
    cooldown = HERO_TUNING.dodge.cooldown;
    beginAction(DODGE_ANIMATION, { kind: "dodge", direction, progress: 0, distance: settings[DODGE_ANIMATION].dodge!.distance });
  }

  function move(step: GroundVector): GroundVector {
    const { position } = root;
    const desired = {
      x: clamp(position.x + step.x, -movementLimit, movementLimit) - position.x,
      z: clamp(position.z + step.z, -movementLimit, movementLimit) - position.z,
    };
    const resolved = resolveMovement([position.x, position.y, position.z], desired);
    const nextX = clamp(position.x + resolved.x, -movementLimit, movementLimit);
    const nextZ = clamp(position.z + resolved.z, -movementLimit, movementLimit);
    const actual = { x: nextX - position.x, z: nextZ - position.z };
    if (actual.x || actual.z) {
      position.x = nextX;
      position.z = nextZ;
      camera.follow(nextX, nextZ);
    }
    return actual;
  }

  function refreshCombatStance(): void {
    combatStanceRemaining = HERO_TUNING.combatStanceDuration;
  }

  function isInvulnerable(): boolean {
    return action?.kind === "dodge" && dodgeInvulnerable(animations.actionProgress, settings[DODGE_ANIMATION].dodge!.window);
  }

  function updateAction(active: ActiveAction): void {
    if (active.kind === "attack" && (animations.activeName !== ATTACK_ANIMATION || animations.isActionInterrupted)) {
      finishAction();
      return;
    }
    const progress = animations.actionProgress;
    if (active.kind === "dodge") {
      const distance = active.distance * Math.max(0, dodgeTravelProgress(progress) - dodgeTravelProgress(active.progress));
      move({ x: active.direction.x * distance, z: active.direction.z * distance });
      active.progress = progress;
    } else if (active.kind === "attack") {
      for (const hit of active.hits) {
        if (consumeImpactWindow(hit, active.progress, progress) && onAttackImpact()) {
          refreshCombatStance();
        }
      }
      active.progress = progress;
    }
    if (progress >= 1) finishAction();
  }

  function finishAction(): void {
    animations.finishAction();
    action = undefined;
    // Force one locomotion update even when no movement key is held.
    wasMoving = true;
  }

  const input = bindHeroInput(canvas, attack, startDodge, signal);
  function resetForLifeChange(clip: string): void {
    action = undefined;
    wasSprinting = false;
    wasMoving = false;
    cooldown = 0;
    combatStanceRemaining = 0;
    cursorYaw = undefined;
    input.clearInput();
    animations.setCombatIdle(false);
    animations.play(clip);
    onAnimationChange();
  }

  scene.onBeforeRenderObservable.add(() => {
    const { horizontal, vertical, running } = input.readMovement(!allowsLocomotion(action?.kind));
    if (animations.isPaused || document.hidden || !isInputEnabled()) {
      wasSprinting = false;
      return;
    }
    const wantsMovement = horizontal !== 0 || vertical !== 0;
    const previousAnimation = animations.activeName;
    const delta = scene.getEngine().getDeltaTime() / 1000;
    cooldown = Math.max(0, cooldown - delta);
    combatStanceRemaining = Math.max(0, combatStanceRemaining - delta);
    if (action?.kind === "stop" && wantsMovement) finishAction();
    if (action) updateAction(action);
    if (!allowsLocomotion(action?.kind)) return;

    const attacking = action?.kind === "attack";
    // Combat stance resumes after the strike; running is not slowed mid-attack.
    const inCombat = combatStanceRemaining > 0 && !attacking;
    const restChanged = animations.setCombatIdle(inCombat);
    const movement = inCombat
      ? HERO_ANIMATIONS.combatStance
      : running ? HERO_ANIMATIONS.run : selectedMovement;
    if (wasSprinting && !wantsMovement && !action) {
      beginAction(HERO_ANIMATIONS.stop.id, { kind: "stop" });
      return;
    }
    let actual: GroundVector = { x: 0, z: 0 };
    if (wantsMovement) {
      const movementYaw = attacking
        ? root.rotation.y
        : (cursorYaw = updateCursorYaw() ?? cursorYaw ?? root.rotation.y);
      const direction = mouseRelativeDirection(horizontal, vertical, movementYaw);
      const speed = settings[movement.id].movement!.speed;
      actual = move(calculateMovementStep(direction, delta, speed));
      if (!attacking) {
        const yaw = Math.atan2(direction.x, direction.z) + (movement.movement?.facingOffset ?? 0);
        turn(Math.sin(yaw), Math.cos(yaw), delta);
      }
    }
    const moving = !!(actual.x || actual.z);
    wasSprinting = moving && movement === HERO_ANIMATIONS.run && !action;
    if (moving || wasMoving || restChanged || attacking) {
      animations.updateLocomotion(moving ? movement.id : undefined, delta);
    }
    if (previousAnimation !== animations.activeName) onAnimationChange();
    wasMoving = moving || animations.isTransitioning;
  });

  return {
    attack,
    dodge: startDodge,
    die: () => resetForLifeChange(DEATH_ANIMATION),
    respawn() {
      resetForLifeChange(IDLE_ANIMATION);
      onFacingChange(root.rotation.y);
    },
    receiveHit() {
      if (!isInvulnerable()) refreshCombatStance();
    },
    preview(id: string) {
      if (!canStartAction()) return;
      if (action?.kind === "stop") finishAction();
      if (getAnimationDefinition(id)?.category === "action") {
        beginAction(id, { kind: id === HERO_ANIMATIONS.stop.id ? "stop" : "preview" });
        return;
      }
      if (animations.activeName === id && getAnimationDefinition(id)?.loop) return;
      wasMoving = false;
      wasSprinting = false;
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
    get isActing() { return !!action || animations.activeName === DEATH_ANIMATION; },
    get isAttacking() { return action?.kind === "attack"; },
    get isInvulnerable() { return isInvulnerable(); },
  };
}
