import { Plane, type Scene, type TransformNode } from "@babylonjs/core";
import { ATTACK_ANIMATION, DODGE_ANIMATION, type AnimationPlayer } from "./animations";
import { clamp } from "../world/cameraMath";
import { bindHeroInput } from "./heroInput";
import { HERO_TUNING } from "./heroTuning";
import { aimYaw, calculateMovementStep, dodgeDirection, dodgeInvulnerable, mouseRelativeDirection, type GroundVector } from "./movement";
import type { CameraControls } from "../world/scene";

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
  onAttack: () => void = () => {},
) {
  const groundPlane = new Plane(0, 1, 0, 0);
  let wasMoving = false;
  let cursorYaw: number | undefined;
  let dodge: { direction: GroundVector; progress: number } | undefined;
  let cooldown = 0;
  let attacking = false;

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

  function attack(): void {
    if (dodge || attacking || animations.isPaused || animations.activeName === ATTACK_ANIMATION) return;
    const yaw = updateCursorYaw() ?? root.rotation.y;
    turn(Math.sin(yaw), Math.cos(yaw), 1, Infinity);
    attacking = true;
    animations.play(ATTACK_ANIMATION, true);
    onAttack();
    onAnimationChange();
  }

  function startDodge(horizontal: number, vertical: number): void {
    if (dodge || attacking || cooldown > 0 || animations.isPaused ||
        animations.activeName === ATTACK_ANIMATION || animations.activeName === DODGE_ANIMATION) return;
    const requested = horizontal || vertical
      ? mouseRelativeDirection(horizontal, vertical, updateCursorYaw() ?? cursorYaw ?? root.rotation.y)
      : { x: 0, z: 0 };
    const direction = dodgeDirection(requested, root.rotation.y);
    turn(direction.x, direction.z, 1, Infinity);
    animations.play(DODGE_ANIMATION, true);
    dodge = { direction, progress: 0 };
    cooldown = HERO_TUNING.dodge.cooldown;
    onAnimationChange();
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

  const input = bindHeroInput(canvas, attack, startDodge, signal);
  scene.onBeforeRenderObservable.add(() => {
    const { horizontal, vertical, running } = input.readMovement();
    if (animations.isPaused || document.hidden) return;
    const delta = scene.getEngine().getDeltaTime() / 1000;
    cooldown = Math.max(0, cooldown - delta);
    if (dodge) {
      const progress = animations.actionProgress;
      const distance = HERO_TUNING.dodge.distance * Math.max(0, progress - dodge.progress);
      move({ x: dodge.direction.x * distance, z: dodge.direction.z * distance });
      dodge.progress = progress;
      if (progress < 1) return;
      dodge = undefined;
      wasMoving = true;
    } else if (attacking) {
      if (animations.actionProgress < 1) return;
      attacking = false;
      wasMoving = true;
    } else if (animations.activeName === ATTACK_ANIMATION || animations.activeName === DODGE_ANIMATION) {
      return;
    }

    let actual: GroundVector = { x: 0, z: 0 };
    if (horizontal || vertical) {
      cursorYaw = updateCursorYaw() ?? cursorYaw ?? root.rotation.y;
      const direction = mouseRelativeDirection(horizontal, vertical, cursorYaw);
      const speed = running ? HERO_TUNING.runSpeed : HERO_TUNING.walkSpeed;
      actual = move(calculateMovementStep(direction, delta, speed));
      turn(actual.x, actual.z, delta);
    }
    const moving = !!(actual.x || actual.z);
    if (moving || wasMoving) {
      const previous = animations.activeName;
      animations.updateLocomotion(actual, root.rotation.y, running, "exploration", delta);
      if (previous !== animations.activeName) onAnimationChange();
    }
    wasMoving = moving || animations.isTransitioning;
  });

  return {
    attack,
    setBindings: input.setBindings,
    clearAim() {
      cursorYaw = undefined;
      input.clearAim();
    },
    get isActing() { return !!dodge || attacking; },
    get isInvulnerable() { return !!dodge && dodgeInvulnerable(animations.actionProgress); },
  };
}
