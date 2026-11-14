import { AnimationGroup, type Scene } from "@babylonjs/core";
import { attackLayerWeight, isUpperBodyBone } from "./animationLayers";
import { createTransitionSettings, type TransitionSettings } from "./transitionSettings";
import { LOCOMOTION_CLIPS, locomotionWeights } from "./locomotion";
import type { GroundVector, MovementMode } from "./movement";
import { createAnimationSettings, effectivePlaybackSpeed, getAnimationDefinition, HERO_ANIMATIONS, type AnimationSettings } from "./animationSettings";

export const IDLE_ANIMATION = LOCOMOTION_CLIPS.idle;
export const ATTACK_ANIMATION = HERO_ANIMATIONS.attack.id;
export const DODGE_ANIMATION = HERO_ANIMATIONS.dodge.id;

interface BodyLayers {
  lower: AnimationGroup;
  upper: AnimationGroup;
}

/** Split tracks rather than blending two full-body clips on the same bones. */
function createBodyLayer(scene: Scene, source: AnimationGroup, upper: boolean): AnimationGroup {
  const layer = new AnimationGroup(source.name + (upper ? "-upper" : "-lower"), scene);
  for (const { animation, target } of source.targetedAnimations) {
    const name: string = typeof target?.name === "string" ? target.name : "";
    if (isUpperBodyBone(name) === upper) layer.addTargetedAnimation(animation, target);
  }
  return layer;
}

/**
 * Playback only. Locomotion drives the legs and a baseline upper-body pose;
 * light attacks temporarily replace just that upper-body pose.
 */
export class AnimationPlayer {
  private readonly available: Set<string>;
  private readonly bodyLayers = new Map<AnimationGroup, BodyLayers>();
  private readonly attackUpper: AnimationGroup;
  private locomotion = new Map<AnimationGroup, number>();
  private primary: AnimationGroup | null = null;
  private fullBody: AnimationGroup | null = null;
  private action: AnimationGroup | null = null;
  private actionSource: AnimationGroup | null = null;
  private actionCompleted = false;
  private actionControlled = false;
  private overlayElapsed = 0;
  private settings = createAnimationSettings();
  private paused = false;
  private transitioning = false;
  private transitions = createTransitionSettings();
  private transitionDuration = this.transitions.move;
  private readonly combatIdleClip: string;
  private combatIdle = false;

  constructor(private readonly animations: AnimationGroup[], scene: Scene) {
    this.available = new Set(animations.map(({ name }) => name));
    const combatIdle = HERO_ANIMATIONS.combatIdle.id;
    this.combatIdleClip = this.available.has(combatIdle) ? combatIdle : IDLE_ANIMATION;
    for (const clip of [IDLE_ANIMATION, LOCOMOTION_CLIPS.walk, LOCOMOTION_CLIPS.backward, LOCOMOTION_CLIPS.run, ATTACK_ANIMATION, DODGE_ANIMATION]) {
      if (!this.available.has(clip)) throw new Error("Clip du héros requis : " + clip);
    }
    for (const source of animations) {
      source.enableBlending = true;
      source.blendingSpeed = 0.15;
      if (getAnimationDefinition(source.name)?.category === "movement") {
        this.bodyLayers.set(source, {
          lower: createBodyLayer(scene, source, false),
          upper: createBodyLayer(scene, source, true),
        });
      }
      source.onAnimationGroupEndObservable.add(() => {
        if (this.action === source && this.actionControlled) this.actionCompleted = true;
        else if (this.fullBody === source && !this.actionControlled && !source.loopAnimation) {
          this.play(this.restClip);
        }
      });
    }

    const attack = this.requireClip(ATTACK_ANIMATION);
    this.attackUpper = createBodyLayer(scene, attack, true);
    if (!this.attackUpper.targetedAnimations.length) {
      throw new Error("Le clip " + ATTACK_ANIMATION + " n'anime aucun os du haut du corps.");
    }
    this.attackUpper.onAnimationGroupEndObservable.add(() => {
      if (this.action === this.attackUpper) this.actionCompleted = true;
    });
    scene.onDisposeObservable.addOnce(() => {
      this.attackUpper.dispose();
      for (const { lower, upper } of this.bodyLayers.values()) {
        lower.dispose();
        upper.dispose();
      }
    });
  }

  get restClip(): string {
    return this.combatIdle ? this.combatIdleClip : IDLE_ANIMATION;
  }

  get activeName(): string {
    return this.actionSource?.name ?? this.primary?.name ?? this.fullBody?.name ?? "";
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isTransitioning(): boolean {
    return this.transitioning;
  }

  get isActionInterrupted(): boolean {
    return !this.actionControlled || (!this.action?.isStarted && !this.actionCompleted);
  }

  setCombatIdle(active: boolean): boolean {
    const previousRest = this.restClip;
    this.combatIdle = active;
    return this.restClip !== previousRest && this.activeName === previousRest;
  }

  /** Always measured on the action clip, never on a changing locomotion clip. */
  get actionProgress(): number {
    if (!this.action || !this.actionControlled) return 1;
    if (this.actionCompleted) return 1;
    if (!this.action.isStarted) return 1;
    const frames = this.action.to - this.action.from;
    return frames > 0
      ? Math.max(0, Math.min(1, (this.action.getCurrentFrame() - this.action.from) / frames))
      : 1;
  }

  private requireClip(name: string): AnimationGroup {
    const group = this.animations.find((animation) => animation.name === name);
    if (!group) throw new Error("Animation inconnue : " + name);
    return group;
  }

  private stopLocomotion(): void {
    for (const source of this.locomotion.keys()) {
      const layers = this.bodyLayers.get(source)!;
      layers.lower.stop(true);
      layers.upper.stop(true);
    }
    this.locomotion.clear();
    this.primary = null;
    this.transitioning = false;
  }

  private startUpperAttack(source: AnimationGroup): void {
    this.fullBody?.stop(true);
    this.fullBody = null;
    this.attackUpper.stop(true);
    this.action = this.attackUpper;
    this.actionSource = source;
    this.actionControlled = true;
    this.actionCompleted = false;
    this.overlayElapsed = 0;
    this.attackUpper.weight = 0;
    this.attackUpper.start(false, this.playbackSpeed(source.name), source.from, source.to);
  }

  /** Full-body actions (including dodge) preempt both animation layers. */
  play(name: string, controlled = false): void {
    const selected = this.requireClip(name);
    if (name === ATTACK_ANIMATION && controlled) {
      this.startUpperAttack(selected);
      return;
    }
    this.stopLocomotion();
    this.action?.stop(true);
    this.action = null;
    this.actionSource = null;
    this.fullBody?.stop(true);
    this.fullBody = selected;
    this.action = controlled ? selected : null;
    this.actionSource = controlled ? selected : null;
    this.actionControlled = controlled;
    this.actionCompleted = false;
    this.paused = false;
    selected.enableBlending = true;
    selected.weight = -1;
    const loop = getAnimationDefinition(name)?.loop || name === this.combatIdleClip;
    selected.start(loop, this.playbackSpeed(name), selected.from, selected.to);
  }

  /** Called by the controller once a one-shot finishes or is interrupted. */
  finishAction(): void {
    this.action?.stop(true);
    if (this.fullBody === this.action) this.fullBody = null;
    this.action = null;
    this.actionSource = null;
    this.actionControlled = false;
    this.actionCompleted = false;
    this.overlayElapsed = 0;
    this.applyLayerWeights(0);
  }

  private applyLayerWeights(upperAttackWeight: number): void {
    for (const [source, weight] of this.locomotion) {
      const layers = this.bodyLayers.get(source)!;
      layers.lower.weight = weight;
      layers.upper.weight = weight * (1 - upperAttackWeight);
    }
    if (this.action === this.attackUpper) this.attackUpper.weight = upperAttackWeight;
  }

  private updateAttackBlend(delta: number): void {
    if (this.action !== this.attackUpper) {
      this.applyLayerWeights(0);
      return;
    }
    this.overlayElapsed += delta;
    const remaining = (1 - this.actionProgress) * (this.duration(ATTACK_ANIMATION) ?? 0);
    this.applyLayerWeights(attackLayerWeight(this.overlayElapsed, remaining));
  }

  updateLocomotion(displacement: GroundVector, yaw: number, running: boolean, mode: MovementMode, delta: number, movementClip?: string): void {
    const weights = movementClip && (displacement.x || displacement.z)
      ? new Map([[movementClip, 1]])
      : locomotionWeights(displacement, yaw, running, mode, this.restClip, this.available);
    const target = new Map<AnimationGroup, number>();
    let primary: AnimationGroup | undefined;
    for (const source of this.animations) {
      const weight = weights.get(source.name);
      if (weight === undefined || !this.bodyLayers.has(source)) continue;
      target.set(source, weight);
      if (!primary || weight > target.get(primary)!) primary = source;
    }

    this.fullBody?.stop(true);
    this.fullBody = null;
    const previous = this.primary;
    const entering = this.locomotion.size === 0;
    if (primary !== previous) {
      this.transitionDuration = weights.has(this.restClip) ? this.transitions.idle :
        previous?.name === LOCOMOTION_CLIPS.run && !weights.has(LOCOMOTION_CLIPS.run)
          ? this.transitions.slowDown : this.transitions.move;
    }

    for (const source of target.keys()) {
      if (this.locomotion.has(source)) continue;
      const layers = this.bodyLayers.get(source)!;
      for (const layer of [layers.lower, layers.upper]) {
        layer.weight = 0;
        layer.start(true, this.playbackSpeed(source.name), source.from, source.to);
      }
      this.locomotion.set(source, 0);
    }

    let difference = 0;
    for (const [source, current] of this.locomotion) {
      difference += Math.abs((target.get(source) ?? 0) - current);
    }
    const fraction = entering || difference < 1e-8
      ? 1 : Math.min(1, (2 * delta) / (this.transitionDuration * difference));
    this.transitioning = fraction < 1;
    for (const [source, current] of this.locomotion) {
      const desired = target.get(source) ?? 0;
      const weight = current + (desired - current) * fraction;
      if (weight === 0 && !target.has(source)) {
        const layers = this.bodyLayers.get(source)!;
        layers.lower.stop(true);
        layers.upper.stop(true);
        this.locomotion.delete(source);
      } else {
        this.locomotion.set(source, weight);
      }
    }
    this.primary = primary ?? null;
    this.updateAttackBlend(delta);
  }

  private playbackSpeed(name: string): number {
    const definition = getAnimationDefinition(name);
    return definition ? effectivePlaybackSpeed(definition, this.settings[name]) : 1;
  }

  duration(name: string): number | undefined {
    const group = this.animations.find((animation) => animation.name === name);
    if (group) return group.getLength() * group.speedRatio / this.playbackSpeed(name);
  }

  setTransitions(settings: TransitionSettings): void {
    this.transitions = createTransitionSettings(settings);
  }

  setSettings(settings: AnimationSettings): void {
    this.settings = settings;
    for (const source of this.locomotion.keys()) {
      const speed = this.playbackSpeed(source.name);
      const layers = this.bodyLayers.get(source)!;
      layers.lower.speedRatio = speed;
      layers.upper.speedRatio = speed;
    }
    if (this.action && this.actionSource) this.action.speedRatio = this.playbackSpeed(this.actionSource.name);
    else if (this.fullBody) this.fullBody.speedRatio = this.playbackSpeed(this.fullBody.name);
  }

  togglePause(): boolean {
    const groups = new Set<AnimationGroup>();
    for (const source of this.locomotion.keys()) {
      const layers = this.bodyLayers.get(source)!;
      groups.add(layers.lower);
      groups.add(layers.upper);
    }
    if (this.action) groups.add(this.action);
    if (this.fullBody) groups.add(this.fullBody);
    if (!groups.size) return false;
    for (const group of groups) {
      if (this.paused) group.restart();
      else group.pause();
    }
    this.paused = !this.paused;
    return this.paused;
  }
}
