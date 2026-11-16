import { type Scene, type TransformNode } from "@babylonjs/core";
import { ATTACK_ANIMATION, DEATH_ANIMATION, DODGE_ANIMATION, IDLE_ANIMATION, type AnimationPlayer } from "./animations.ts";
import { createAnimationSettings, createAttackHits, getAnimationDefinition, HERO_ANIMATIONS, type AnimationSettings } from "./animationSettings.ts";
import { clamp } from "../world/cameraMath.ts";
import type { Position } from "../combat/combat";
import { bindHeroInput } from "./heroInput.ts";
import { canCancelAction, type CancelTarget } from "./actionCancelling.ts";
import { canBufferComboInput, canStartBufferedCombo, followUpStartProgress } from "./attackCombo.ts";
import { allowsLocomotion } from "./animationLayers.ts";
import { HERO_TUNING } from "./heroTuning.ts";
import { cameraMovementYaw, targetYaw, type TargetingMotion } from "./targetSelection.ts";
import { aimYaw, calculateMovementStep, consumeImpactWindow, dodgeDirection, dodgeInvulnerable, dodgeTravelProgress, relativeMovementDirection, type GroundVector } from "./movement.ts";
import type { CameraControls } from "../world/scene";

export interface MovementBounds { minX: number; maxX: number; minZ: number; maxZ: number }

type ActiveAction =
  | { kind: "attack"; progress: number; hits: ReturnType<typeof createAttackHits> }
  | { kind: "dodge"; progress: number; direction: GroundVector; distance: number }
  | { kind: "preview" | "stop" };

export function createCharacterController(
  scene: Scene,
  canvas: HTMLCanvasElement,
  root: TransformNode,
  movementLimit: number | (() => MovementBounds),
  camera: Pick<CameraControls, "follow" | "alpha">,
  animations: AnimationPlayer,
  signal: AbortSignal,
  onAnimationChange: () => void = () => {},
  onFacingChange: (yaw: number) => void = () => {},
  onAttackImpact: () => boolean = () => false,
  resolveMovement: (start: Position, step: GroundVector) => GroundVector = (_start, step) => step,
  isInputEnabled: () => boolean = () => true,
  onActionStarted: (id: string) => void = () => {},
  onInteract: () => void = () => {},
) {
  let wasMoving = false;
  let wasSprinting = false;
  let lastLocomotion: 'walk' | 'sprint' | undefined;
  let action: ActiveAction | undefined;
  let cooldown = 0;
  let combatStanceRemaining = 0;
  let settings = createAnimationSettings();
  let selectedMovement = HERO_ANIMATIONS.walk;
  let comboCount = 0;
  let comboResetRemaining = 0;
  let queuedComboRemaining = 0;
  let readTargeting: () => TargetingMotion | undefined = () => undefined;
  let targetActions: { cycle(): void; cancel(): void } | undefined;
  let tryTargetClick: (event: PointerEvent) => boolean = () => false;

  function resetCombo(): void {
    comboCount = 0;
    comboResetRemaining = 0;
    queuedComboRemaining = 0;
  }

  function turn(dx: number, dz: number, delta: number, speed = HERO_TUNING.turnSpeed): void {
    if (!dx && !dz) return;
    root.rotation.y = aimYaw(root.rotation.y, dx, dz, delta, speed, 0);
    onFacingChange(root.rotation.y);
  }

  function actionAnimationId(kind: ActiveAction["kind"]): string | undefined {
    if (kind === "attack") return ATTACK_ANIMATION;
    if (kind === "dodge") return DODGE_ANIMATION;
    return undefined;
  }

  function actionBlendOut(): number {
    const id = action && actionAnimationId(action.kind);
    return id ? settings[id]?.blendOutSeconds ?? 0 : 0;
  }

  function canInterrupt(target: CancelTarget): boolean {
    if (!action || action.kind === "stop") return true;
    const id = actionAnimationId(action.kind);
    return !!id && canCancelAction(animations.actionProgress, settings[id]?.cancel, target);
  }

  function canStartAction(target: "attack" | "dodge"): boolean {
    return isInputEnabled() && !animations.isPaused && canInterrupt(target);
  }

  function beginAction(
    clip: string, next: ActiveAction, startProgress = 0, comboBlendSeconds?: number,
  ): void {
    if (action) finishAction(comboBlendSeconds ?? actionBlendOut());
    wasSprinting = false;
    action = next;
    animations.play(clip, true, next.kind === "attack" && HERO_TUNING.attack.allowMovement,
      startProgress, comboBlendSeconds);
    if (next.kind === "attack" || next.kind === "dodge") onActionStarted(next.kind);
    onAnimationChange();
  }

  function startAttack(chained: boolean): void {
    const attackSettings = settings[ATTACK_ANIMATION];
    const combo = attackSettings.combo;
    const startProgress = chained && combo
      ? followUpStartProgress(combo, attackSettings.impact!.from) : 0;
    const blendSeconds = chained ? combo?.followUp.blendSeconds : undefined;
    const lock = readTargeting();
    // Normal attacks inherit the hero's last movement heading, not the pointer location.
    // Target Lock retains its precise enemy-facing attack direction.
    if (lock) {
      const yaw = targetYaw(root.position, lock.target);
      turn(Math.sin(yaw), Math.cos(yaw), 1, Infinity);
    }
    comboCount = chained ? comboCount + 1 : 1;
    comboResetRemaining = 0;
    queuedComboRemaining = 0;
    beginAction(ATTACK_ANIMATION, {
      kind: "attack", progress: startProgress,
      hits: createAttackHits(attackSettings.impact!),
    }, startProgress, blendSeconds);
  }

  function attack(): void {
    if (!isInputEnabled() || animations.isPaused) return;
    const combo = settings[ATTACK_ANIMATION].combo;
    if (action?.kind === "attack" && combo?.enabled) {
      const progress = animations.actionProgress;
      if (!canBufferComboInput(progress, animations.duration(ATTACK_ANIMATION) ?? 0, combo, comboCount)) return;
      if (canStartBufferedCombo(progress, combo)) startAttack(true);
      else queuedComboRemaining = combo.inputBufferMs / 1000;
      return;
    }
    if (!canStartAction("attack")) return;
    const chained = !!combo?.enabled && !action &&
      comboCount > 0 && comboCount < combo.maxChain && comboResetRemaining > 0;
    startAttack(chained);
  }

  function startDodge(): void {
    if (!canStartAction("dodge") || cooldown > 0) return;
    const direction = dodgeDirection(root.rotation.y);
    cooldown = HERO_TUNING.dodge.cooldown;
    resetCombo();
    beginAction(DODGE_ANIMATION, { kind: "dodge", direction, progress: 0, distance: settings[DODGE_ANIMATION].dodge!.distance });
  }

  function move(step: GroundVector): GroundVector {
    const { position } = root;
    const bounds = typeof movementLimit === "number"
      ? { minX: -movementLimit, maxX: movementLimit, minZ: -movementLimit, maxZ: movementLimit }
      : movementLimit();
    const desired = {
      x: clamp(position.x + step.x, bounds.minX, bounds.maxX) - position.x,
      z: clamp(position.z + step.z, bounds.minZ, bounds.maxZ) - position.z,
    };
    const resolved = resolveMovement([position.x, position.y, position.z], desired);
    const nextX = clamp(position.x + resolved.x, bounds.minX, bounds.maxX);
    const nextZ = clamp(position.z + resolved.z, bounds.minZ, bounds.maxZ);
    const actual = { x: nextX - position.x, z: nextZ - position.z };
    if (actual.x || actual.z) {
      position.x = nextX;
      position.z = nextZ;
      camera.follow(nextX, nextZ);
    }
    return actual;
  }

  function refreshCombatStance(): void {
    combatStanceRemaining = HERO_TUNING.combatStance.duration;
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
        if (consumeImpactWindow(hit, active.progress, progress) && onAttackImpact() && HERO_TUNING.combatStance.onHitDealt) {
          refreshCombatStance();
        }
      }
      active.progress = progress;
      const combo = settings[ATTACK_ANIMATION].combo;
      if (combo?.enabled && queuedComboRemaining > 0 && comboCount < combo.maxChain &&
          canStartBufferedCombo(progress, combo)) {
        startAttack(true);
        return;
      }
    }
    if (progress >= 1) {
      if (active.kind === "attack") {
        comboResetRemaining = settings[ATTACK_ANIMATION].combo?.enabled
          ? settings[ATTACK_ANIMATION].combo!.resetAfterMs / 1000 : 0;
      }
      queuedComboRemaining = 0;
      finishAction(actionBlendOut());
    }
  }

  function finishAction(blendOutSeconds = 0): void {
    animations.finishAction(blendOutSeconds);
    action = undefined;
    // Force one locomotion update even when no movement key is held.
    wasMoving = true;
  }

  const input = bindHeroInput(canvas, attack, startDodge, signal, (slot) => {
    if (isInputEnabled() && !animations.isPaused) onActionStarted(slot);
  }, () => {
    if (isInputEnabled()) onInteract();
  }, () => {
    if (isInputEnabled() && !animations.isPaused) targetActions?.cycle();
  }, () => {
    if (isInputEnabled() && !animations.isPaused) targetActions?.cancel();
  }, (event) => {
    if (!isInputEnabled() || animations.isPaused || document.hidden || !tryTargetClick(event)) return false;
    const lock = readTargeting();
    if (lock && allowsLocomotion(action?.kind)) {
      // Explicit pointer selection feels responsive; later movement continues
      // to track the enemy at the configured turn speed.
      const yaw = targetYaw(root.position, lock.target);
      turn(Math.sin(yaw), Math.cos(yaw), 1, Infinity);
    }
    return true;
  });
  function resetForLifeChange(clip: string): void {
    action = undefined;
    wasSprinting = false;
    wasMoving = false;
    lastLocomotion = undefined;
    cooldown = 0;
    combatStanceRemaining = 0;
    input.clearInput();
    resetCombo();
    animations.setCombatIdle(false);
    animations.play(clip);
    onAnimationChange();
  }

  scene.onBeforeRenderObservable.add(() => {
    const { horizontal, vertical, running } = input.readMovement(!allowsLocomotion(action?.kind));
    if (animations.isPaused || document.hidden || !isInputEnabled()) {
      wasSprinting = false;
      lastLocomotion = undefined;
      return;
    }
    const wantsMovement = horizontal !== 0 || vertical !== 0;
    const previousAnimation = animations.activeName;
    const delta = scene.getEngine().getDeltaTime() / 1000;
    cooldown = Math.max(0, cooldown - delta);
    combatStanceRemaining = Math.max(0, combatStanceRemaining - delta);
    if (!action && comboResetRemaining > 0) {
      comboResetRemaining = Math.max(0, comboResetRemaining - delta);
      if (!comboResetRemaining) resetCombo();
    }
    if (action?.kind === "stop" && wantsMovement) finishAction();
    if (action) updateAction(action);
    // A click buffered shortly before the chain window is consumed only once.
    if (queuedComboRemaining > 0) queuedComboRemaining = Math.max(0, queuedComboRemaining - delta);
    // Read held movement even while dodging, then cancel on the first permitted frame.
    if (action && wantsMovement && canInterrupt("run")) {
      if (action.kind === "attack") resetCombo();
      finishAction(actionBlendOut());
    }

    const attacking = action?.kind === "attack";
    const lock = readTargeting();
    const facingLocked = attacking && HERO_TUNING.attack.lockFacing;
    // When a target is locked, facing follows that enemy independently of ZQSD.
    // Otherwise, only movement input changes facing (never the mouse position).
    // Do not rotate a full-body dodge or preview midway through its animation.
    if (lock && allowsLocomotion(action?.kind)) {
      const yaw = targetYaw(root.position, lock.target);
      turn(Math.sin(yaw), Math.cos(yaw), delta, lock.turnSpeed);
    }
    if (!allowsLocomotion(action?.kind)) return;
    const inCombat = combatStanceRemaining > 0;
    // A confirmed hit prepares the resting pose while the attack is still blending.
    const restChanged = animations.setCombatIdle(inCombat);
    const movement = inCombat && !attacking
      ? HERO_ANIMATIONS.combatStance
      : running ? HERO_ANIMATIONS.run : selectedMovement;
    if (wasSprinting && !wantsMovement && !action && !lock) {
      beginAction(HERO_ANIMATIONS.stop.id, { kind: "stop" });
      return;
    }
    let actual: GroundVector = { x: 0, z: 0 };
    if (wantsMovement) {
      // A single camera-relative ZQSD baseline is used with or without target lock.
      // Target-relative strafing changes only the movement reference when selected.
      const directionYaw = lock?.movementReference === "target"
        ? targetYaw(root.position, lock.target)
        : cameraMovementYaw(camera.alpha);
      const direction = relativeMovementDirection(horizontal, vertical, directionYaw);
      const speed = settings[movement.id].movement!.speed;
      actual = move(calculateMovementStep(direction, delta, speed));
      if (lock) {
        const yaw = targetYaw(root.position, lock.target);
        turn(Math.sin(yaw), Math.cos(yaw), delta, lock.turnSpeed);
      } else if (!facingLocked) {
        // Keep the last heading when keys are released; attacks can lock that heading.
        const yaw = Math.atan2(direction.x, direction.z) + (movement.movement?.facingOffset ?? 0);
        turn(Math.sin(yaw), Math.cos(yaw), delta);
      }
    }
    const moving = !!(actual.x || actual.z);
    const locomotion = moving ? (movement === HERO_ANIMATIONS.run ? 'sprint' : 'walk') : undefined;
    if (locomotion && locomotion !== lastLocomotion) onActionStarted(locomotion);
    lastLocomotion = locomotion;
    wasSprinting = moving && movement === HERO_ANIMATIONS.run && !action;
    if (moving || wasMoving || restChanged || attacking) {
      animations.updateLocomotion(moving ? movement.id : undefined, delta, previousAnimation === ATTACK_ANIMATION);
    }
    if (previousAnimation !== animations.activeName) onAnimationChange();
    wasMoving = moving || animations.isTransitioning;
  });

  return {
    attack,
    dodge: startDodge,
    clearHeldInput(): void { input.clearInput(); },
    interruptForZoneChange(): void {
      if (action) finishAction();
      input.clearInput();
      resetCombo();
      combatStanceRemaining = 0;
      wasMoving = false;
      wasSprinting = false;
      lastLocomotion = undefined;
      animations.setCombatIdle(false);
      animations.play(IDLE_ANIMATION);
      onAnimationChange();
    },
    die: () => resetForLifeChange(DEATH_ANIMATION),
    respawn() {
      resetForLifeChange(IDLE_ANIMATION);
      onFacingChange(root.rotation.y);
    },
    receiveHit() {
      if (HERO_TUNING.combatStance.onHitReceived && !isInvulnerable()) refreshCombatStance();
    },
    /** Playground-only preview: restarts a clip without altering real combat cooldowns. */
    restartAnimationPreview(id: string) {
      if (!isInputEnabled() || animations.isPaused || getAnimationDefinition(id)?.category !== "action") return;
      if (action) finishAction();
      resetCombo();
      beginAction(id, { kind: "preview" });
    },
    preview(id: string) {
      if (!isInputEnabled() || animations.isPaused || (action && action.kind !== "stop")) return;
      if (action?.kind === "stop") finishAction();
      resetCombo();
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
      resetCombo();
      animations.setSettings(value);
    },
    setBindings: input.setBindings,
    /** Optional gameplay adapter; Playground can switch lock-on without changing manual inputs. */
    setTargetingProvider(provider: () => TargetingMotion | undefined) {
      readTargeting = provider;
    },
    setTargetingActions(actions: { cycle(): void; cancel(): void }) {
      targetActions = actions;
    },
    setTargetClickHandler(handler: (event: PointerEvent) => boolean) {
      tryTargetClick = handler;
    },
    get isActing() { return !!action || animations.activeName === DEATH_ANIMATION; },
    get isAttacking() { return action?.kind === "attack"; },
    get isInvulnerable() { return isInvulnerable(); },
  };
}
