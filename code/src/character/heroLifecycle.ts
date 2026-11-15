import type { TransformNode } from "@babylonjs/core";
import { createHeroVitals } from "../combat/heroVitals";
import type { Position } from "../combat/combat";
import type { CameraControls } from "../world/scene";
import { DEATH_ANIMATION, type AnimationPlayer } from "./animations";
import type { createCharacterController } from "./characterController";

type Controller = ReturnType<typeof createCharacterController>;

export function createHeroLifecycle(root: TransformNode, camera: CameraControls, animations: AnimationPlayer) {
  const duration = animations.duration(DEATH_ANIMATION);
  if (!duration || !Number.isFinite(duration)) throw new Error("Durée du clip de mort invalide.");
  const vitals = createHeroVitals(100, Math.max(2, duration + 0.5));
  const initialPosition = root.position.clone();
  const initialYaw = root.rotation.y;

  return {
    vitals,
    hit(damage: number, controller?: Controller): void {
      if (!vitals.hit(damage, controller?.isInvulnerable)) return;
      if (vitals.isAlive) controller?.receiveHit();
      else controller?.die();
    },
    defeat(controller: Controller): void {
      if (vitals.defeat()) controller.die();
    },
    update(delta: number, controller: Controller, spawn?: { position: Position; rotationY: number }): void {
      if (document.hidden || !vitals.update(Math.min(delta, 0.1))) return;
      if (spawn) root.position.set(...spawn.position);
      else root.position.copyFrom(initialPosition);
      root.rotation.y = spawn ? spawn.rotationY * Math.PI / 180 : initialYaw;
      camera.follow(root.position.x, root.position.z);
      controller.respawn();
    },
  };
}
