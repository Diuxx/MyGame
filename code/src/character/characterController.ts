import { Plane, type Scene, type TransformNode } from "@babylonjs/core";
import { ATTACK_ANIMATION, selectLocomotion, type AnimationPlayer } from "./animations";
import { clamp } from "../world/cameraMath";
import { bindHeroInput } from "./heroInput";
import { aimYaw, calculateMovementStep } from "./movement";
import type { CameraControls } from "../world/scene";

const TURN_SPEED = 18;
const AIM_DEAD_ZONE = 0.12;

export function createCharacterController(
  scene: Scene,
  canvas: HTMLCanvasElement,
  root: TransformNode,
  groundY: number,
  movementLimit: number,
  camera: CameraControls,
  animations: AnimationPlayer,
  signal: AbortSignal,
  onAnimationChange: () => void = () => {},
  onFacingChange: (yaw: number) => void = () => {},
  onAttack: () => void = () => {},
) {
  const groundPlane = new Plane(0, 1, 0, -groundY);
  let wasMoving = false;

  function updateAim(delta: number, speed = TURN_SPEED): void {
    const pointer = input.pointer;
    if (!pointer) return;
    const bounds = canvas.getBoundingClientRect();
    const x = pointer.clientX - bounds.left;
    const y = pointer.clientY - bounds.top;
    if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) return;
    const ray = scene.createPickingRay(x, y, null, scene.activeCamera);
    const distance = ray.intersectsPlane(groundPlane);
    if (distance === null) return;
    const dx = ray.origin.x + ray.direction.x * distance - root.position.x;
    const dz = ray.origin.z + ray.direction.z * distance - root.position.z;
    root.rotation.y = aimYaw(root.rotation.y, dx, dz, delta, speed, AIM_DEAD_ZONE);
    onFacingChange(root.rotation.y);
  }

  function attack(): void {
    if (animations.isPaused || animations.activeName === ATTACK_ANIMATION) return;
    updateAim(1, Infinity);
    animations.play(ATTACK_ANIMATION);
    onAttack();
    onAnimationChange();
  }

  const input = bindHeroInput(canvas, attack, signal);
  scene.onBeforeRenderObservable.add(() => {
    const { horizontal, vertical, running } = input.readMovement();
    if (animations.isPaused || animations.activeName === ATTACK_ANIMATION) return;

    const delta = scene.getEngine().getDeltaTime() / 1000;
    updateAim(delta);
    const { position, rotation } = root;
    const step = calculateMovementStep(horizontal, vertical, rotation.y, delta, running);
    const x = clamp(position.x + step.x, -movementLimit, movementLimit);
    const z = clamp(position.z + step.z, -movementLimit, movementLimit);
    const moving = x !== position.x || z !== position.z;
    if (moving) {
      position.x = x;
      position.z = z;
      camera.follow(x, z);
    }

    // Leave manual previews alone until the hero moves.
    if (moving || wasMoving) {
      const clip = moving ? selectLocomotion(vertical, running) : animations.restClip;
      if (clip !== animations.activeName) {
        animations.play(clip);
        onAnimationChange();
      }
    }
    wasMoving = moving;
  });

  return { attack, clearAim: input.clearAim };
}
