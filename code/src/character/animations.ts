import { AnimationGroup, type Scene } from "@babylonjs/core";
import { attackLayerWeight, isUpperBodyBone } from "./animationLayers.ts";
import { createTransitionSettings, type TransitionSettings } from "./transitionSettings.ts";
import { createAnimationSettings, effectivePlaybackSpeed, getAnimationDefinition, HERO_ANIMATIONS, type AnimationSettings } from "./animationSettings.ts";
import { HERO_TUNING } from "./heroTuning.ts";

export const IDLE_ANIMATION = HERO_ANIMATIONS.idle.id;
const COMBAT_STANCE_ANIMATION = HERO_ANIMATIONS.combatStance.id;
const COMBAT_LEGS_ANIMATION = HERO_TUNING.blending.combatLegsClip;
export const ATTACK_ANIMATION = HERO_ANIMATIONS.attack.id;
export const DODGE_ANIMATION = HERO_ANIMATIONS.dodge.id;
export const DEATH_ANIMATION = HERO_ANIMATIONS.dying.id;

interface BodyLayers {
  name: string;
  lower: AnimationGroup;
  upper: AnimationGroup;
}

/** Split tracks rather than blending two full-body clips on the same bones. */
function createBodyLayer(
  scene: Scene, source: AnimationGroup, upper: boolean,
  name = source.name + (upper ? "-upper" : "-lower"),
): AnimationGroup {
  const layer = new AnimationGroup(name, scene);
  for (const { animation, target } of source.targetedAnimations) {
    const name: string = typeof target?.name === "string" ? target.name : "";
    if (isUpperBodyBone(name) === upper) layer.addTargetedAnimation(animation, target);
  }
  return layer;
}

/**
 * Playback only. Light attacks replace the upper-body pose and blend over
 * the idle pose of the legs, while walk and run continue driving the legs.
 */
export class AnimationPlayer {
  private readonly animations: AnimationGroup[];
  private readonly bodyLayers = new Map<string, BodyLayers>();
  private readonly combatWalk: BodyLayers;
  private readonly combatLegsPlaybackRate: number;
  private readonly attackUpper: AnimationGroup;
  private readonly attackLower: AnimationGroup;
  private locomotion = new Map<BodyLayers, number>();
  private primary: BodyLayers | null = null;
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
  private combatIdle = false;

  constructor(animations: AnimationGroup[], scene: Scene) {
    this.animations = animations;
    const available = new Set(animations.map(({ name }) => name));
    for (const clip of [IDLE_ANIMATION, COMBAT_STANCE_ANIMATION, HERO_ANIMATIONS.walk.id, HERO_ANIMATIONS.run.id, HERO_ANIMATIONS.stop.id, ATTACK_ANIMATION, DODGE_ANIMATION, DEATH_ANIMATION]) {
      if (!available.has(clip)) throw new Error("Clip du héros requis : " + clip);
    }
    for (const source of animations) {
      source.enableBlending = true;
      source.blendingSpeed = HERO_TUNING.blending.fullBodySpeed;
      if (getAnimationDefinition(source.name)?.category === "movement") {
        this.bodyLayers.set(source.name, {
          name: source.name,
          lower: createBodyLayer(scene, source, false),
          upper: createBodyLayer(scene, source, true),
        });
      }
      source.onAnimationGroupEndObservable.add(() => {
        if (this.action === source && this.actionControlled) this.actionCompleted = true;
        else if (this.fullBody === source && !this.actionControlled && !source.loopAnimation && source.name !== DEATH_ANIMATION) {
          this.play(this.restClip);
        }
      });
    }

    const legs = getAnimationDefinition(COMBAT_LEGS_ANIMATION)?.movement?.syncReference;
    if (!legs) throw new Error("ANIMATIONS.json · le clip des jambes en combat requiert une référence de synchronisation.");
    this.combatLegsPlaybackRate = legs.playbackSpeed * HERO_ANIMATIONS.combatStance.movement!.syncReference.speed / legs.speed;
    this.combatWalk = {
      name: COMBAT_STANCE_ANIMATION,
      lower: createBodyLayer(scene, this.requireClip(COMBAT_LEGS_ANIMATION), false, "combat-walk-lower"),
      upper: this.bodyLayers.get(COMBAT_STANCE_ANIMATION)!.upper,
    };

    const attack = this.requireClip(ATTACK_ANIMATION);
    this.attackUpper = createBodyLayer(scene, attack, true);
    this.attackLower = createBodyLayer(scene, attack, false);
    if (!this.attackUpper.targetedAnimations.length) {
      throw new Error("Le clip " + ATTACK_ANIMATION + " n'anime aucun os du haut du corps.");
    }
    this.attackUpper.onAnimationGroupEndObservable.add(() => {
      if (this.action === this.attackUpper) this.actionCompleted = true;
    });
    scene.onDisposeObservable.addOnce(() => {
      this.attackUpper.dispose();
      this.attackLower.dispose();
      this.combatWalk.lower.dispose();
      for (const { lower, upper } of this.bodyLayers.values()) {
        lower.dispose();
        upper.dispose();
      }
    });
  }

  get restClip(): string {
    return this.combatIdle ? COMBAT_STANCE_ANIMATION : IDLE_ANIMATION;
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
    for (const layers of this.locomotion.keys()) {
      layers.lower.stop(true);
      layers.upper.stop(true);
    }
    this.locomotion.clear();
    this.primary = null;
    this.transitioning = false;
  }

  private stopActionPlayback(): void {
    if (this.action === this.attackUpper) this.attackLower.stop(true);
    this.action?.stop(true);
  }

  private startLayeredAttack(source: AnimationGroup): void {
    this.fullBody?.stop(true);
    this.fullBody = null;
    this.stopActionPlayback();
    this.action = this.attackUpper;
    this.actionSource = source;
    this.actionControlled = true;
    this.actionCompleted = false;
    this.overlayElapsed = 0;
    const speed = this.playbackSpeed(source.name);
    for (const layer of [this.attackUpper, this.attackLower]) {
      layer.weight = 0;
      layer.start(false, speed, source.from, source.to);
    }
  }

  /** Full-body actions (including dodge) preempt both animation layers. */
  play(name: string, controlled = false, layered = false): void {
    const selected = this.requireClip(name);
    if (name === ATTACK_ANIMATION && controlled && layered) {
      this.startLayeredAttack(selected);
      return;
    }
    this.stopLocomotion();
    this.stopActionPlayback();
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
    const loop = !controlled && (getAnimationDefinition(name)?.loop ?? false);
    selected.start(loop, this.playbackSpeed(name), selected.from, selected.to);
  }

  /** Called by the controller once a one-shot finishes or is interrupted. */
  finishAction(): void {
    this.stopActionPlayback();
    if (this.fullBody === this.action) this.fullBody = null;
    this.action = null;
    this.actionSource = null;
    this.actionControlled = false;
    this.actionCompleted = false;
    this.overlayElapsed = 0;
    this.applyLayerWeights(0);
  }

  private applyLayerWeights(attackWeight: number): void {
    let lowerAttackWeight = 0;
    let sharedStanceWeight = 0;
    for (const [layers, weight] of this.locomotion) {
      const isIdle = layers !== this.combatWalk &&
        (layers.name === IDLE_ANIMATION || layers.name === COMBAT_STANCE_ANIMATION);
      const replacement = isIdle ? weight * attackWeight : 0;
      lowerAttackWeight += replacement;
      layers.lower.weight = weight - replacement;
      const upperWeight = weight * (1 - attackWeight);
      if (layers.upper === this.combatWalk.upper) sharedStanceWeight += upperWeight;
      else layers.upper.weight = upperWeight;
    }
    this.combatWalk.upper.weight = sharedStanceWeight;
    if (this.action === this.attackUpper) {
      this.attackUpper.weight = attackWeight;
      this.attackLower.weight = lowerAttackWeight;
    }
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

  updateLocomotion(movementClip: string | undefined, delta: number): void {
    const name = movementClip ?? this.restClip;
    const primary = movementClip === COMBAT_STANCE_ANIMATION ? this.combatWalk : this.bodyLayers.get(name);
    if (!primary) throw new Error("Animation de déplacement inconnue : " + name);
    this.fullBody?.stop(true);
    this.fullBody = null;
    const previous = this.primary;
    const entering = this.locomotion.size === 0;
    if (primary !== previous) {
      this.transitionDuration = movementClip === undefined ? this.transitions.idle :
        previous?.name === HERO_ANIMATIONS.run.id
          ? this.transitions.slowDown : this.transitions.move;
    }

    if (!this.locomotion.has(primary)) {
      for (const layer of [primary.lower, primary.upper]) {
        if (layer.isStarted) continue;
        layer.weight = 0;
        const source = primary === this.combatWalk && layer === primary.lower ? COMBAT_LEGS_ANIMATION : primary.name;
        layer.start(getAnimationDefinition(source)?.loop ?? false, this.locomotionSpeed(primary, layer));
      }
      this.locomotion.set(primary, 0);
    }

    let difference = 0;
    for (const [layers, current] of this.locomotion) {
      difference += Math.abs(Number(layers === primary) - current);
    }
    const fraction = entering || difference < 1e-8
      ? 1 : Math.min(1, (2 * delta) / (this.transitionDuration * difference));
    this.transitioning = fraction < 1;
    const fadedLayers = new Set<AnimationGroup>();
    for (const [layers, current] of this.locomotion) {
      const desired = Number(layers === primary);
      const weight = current + (desired - current) * fraction;
      if (weight === 0 && layers !== primary) {
        fadedLayers.add(layers.lower);
        fadedLayers.add(layers.upper);
        this.locomotion.delete(layers);
      } else {
        this.locomotion.set(layers, weight);
      }
    }
    // The same upper-body stance keeps playing when the hero starts or stops walking.
    for (const layers of this.locomotion.keys()) {
      fadedLayers.delete(layers.lower);
      fadedLayers.delete(layers.upper);
    }
    for (const layer of fadedLayers) layer.stop(true);
    this.primary = primary;
    this.updateAttackBlend(delta);
  }

  private playbackSpeed(name: string): number {
    const definition = getAnimationDefinition(name);
    return definition ? effectivePlaybackSpeed(definition, this.settings[name]) : 1;
  }

  private locomotionSpeed(layers: BodyLayers, layer: AnimationGroup): number {
    const speed = this.playbackSpeed(layers.name);
    if (layers !== this.combatWalk || layer !== layers.lower) return speed;
    return speed * this.combatLegsPlaybackRate;
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
    for (const layers of this.locomotion.keys()) {
      layers.lower.speedRatio = this.locomotionSpeed(layers, layers.lower);
      layers.upper.speedRatio = this.locomotionSpeed(layers, layers.upper);
    }
    if (this.action && this.actionSource) {
      this.action.speedRatio = this.playbackSpeed(this.actionSource.name);
      if (this.action === this.attackUpper) this.attackLower.speedRatio = this.action.speedRatio;
    } else if (this.fullBody) this.fullBody.speedRatio = this.playbackSpeed(this.fullBody.name);
  }

  togglePause(): boolean {
    if (this.fullBody?.name === DEATH_ANIMATION) return false;
    const groups = new Set<AnimationGroup>();
    for (const layers of this.locomotion.keys()) {
      groups.add(layers.lower);
      groups.add(layers.upper);
    }
    if (this.action) groups.add(this.action);
    if (this.action === this.attackUpper) groups.add(this.attackLower);
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
