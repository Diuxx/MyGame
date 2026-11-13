import type { AnimationGroup } from "@babylonjs/core";
import { HERO_TUNING } from "./heroTuning";
import { LOCOMOTION_CLIPS, locomotionWeights } from "./locomotion";
import type { GroundVector, MovementMode } from "./movement";
import { createAnimationSettings, effectivePlaybackSpeed, getAnimationDefinition, HERO_ANIMATIONS, type AnimationSettings } from "./animationSettings";

export const IDLE_ANIMATION = LOCOMOTION_CLIPS.idle;
export const ATTACK_ANIMATION = HERO_ANIMATIONS.attack.id;
export const DODGE_ANIMATION = HERO_ANIMATIONS.dodge.id;

/** Manages only playback; no gameplay state or physics are implemented here. */
export class AnimationPlayer {
  private active: AnimationGroup | null = null;
  private settings = createAnimationSettings();
  private paused = false;
  private readonly available: Set<string>;
  private locomotion = new Map<AnimationGroup, number>();
  private controlled = false;
  private completedAction = false;
  private transitioning = false;
  private transitionDuration = HERO_TUNING.transition.move;
  private readonly combatIdleClip: string;
  private combatIdle = false;

  get restClip(): string {
    return this.combatIdle ? this.combatIdleClip : IDLE_ANIMATION;
  }

  constructor(private readonly animations: AnimationGroup[]) {
    this.available = new Set(animations.map(({ name }) => name));
    const combatIdle = HERO_ANIMATIONS.combatIdle.id;
    this.combatIdleClip = this.available.has(combatIdle) ? combatIdle : IDLE_ANIMATION;
    for (const clip of [IDLE_ANIMATION, LOCOMOTION_CLIPS.walk, LOCOMOTION_CLIPS.backward, LOCOMOTION_CLIPS.run, ATTACK_ANIMATION, DODGE_ANIMATION]) {
      if (!this.available.has(clip)) throw new Error(`Clip requis absent de hero.glb : ${clip}`);
    }
    for (const animation of animations) {
      animation.enableBlending = true;
      animation.blendingSpeed = 0.15;
      animation.onAnimationGroupEndObservable.add(() => {
        if (this.active === animation && !animation.loopAnimation) {
          if (this.controlled) this.completedAction = true;
          else this.play(this.restClip);
        }
      });
    }
  }

  get activeName(): string {
    return this.active?.name ?? "";
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isTransitioning(): boolean {
    return this.transitioning;
  }

  get isActionInterrupted(): boolean {
    return !this.controlled || (!this.active?.isStarted && !this.completedAction);
  }

  setCombatIdle(active: boolean): boolean {
    const previousRest = this.restClip;
    this.combatIdle = active;
    return this.restClip !== previousRest && this.activeName === previousRest;
  }

  /** Progress of a controller-owned one-shot, including the frame on which it ends. */
  get actionProgress(): number {
    const clip = this.active;
    if (!clip || !this.controlled || !clip.isStarted) return 1;
    const frames = clip.to - clip.from;
    return frames > 0 ? Math.max(0, Math.min(1, (clip.getCurrentFrame() - clip.from) / frames)) : 1;
  }

  play(name: string, controlled = false): void {
    const selected = this.animations.find((animation) => animation.name === name);
    if (!selected) throw new Error(`Animation inconnue : ${name}`);
    for (const animation of this.animations) animation.stop(true);
    this.locomotion.clear();
    this.transitioning = false;
    this.active = selected;
    this.paused = false;
    this.controlled = controlled;
    this.completedAction = false;
    const loop = getAnimationDefinition(name)?.loop || name === this.combatIdleClip;
    selected.enableBlending = true;
    selected.weight = -1;
    selected.start(loop, this.playbackSpeed(name), selected.from, selected.to);
  }

  updateLocomotion(displacement: GroundVector, yaw: number, running: boolean, mode: MovementMode, delta: number, movementClip?: string): void {
    const weights = movementClip && (displacement.x || displacement.z)
      ? new Map([[movementClip, 1]])
      : locomotionWeights(displacement, yaw, running, mode, this.restClip, this.available);
    const target = new Map<AnimationGroup, number>();
    let primary: AnimationGroup | undefined;
    for (const group of this.animations) {
      const weight = weights.get(group.name);
      if (weight === undefined) continue;
      target.set(group, weight);
      if (!primary || weight > target.get(primary)!) primary = group;
    }
    const previous = this.active;
    if (!this.locomotion.size && previous?.isStarted && previous.loopAnimation) {
      previous.weight = 1;
      this.locomotion.set(previous, 1);
    }
    const entering = this.locomotion.size === 0;
    if (entering) previous?.stop(true);
    const transition = HERO_TUNING.transition;
    if (primary !== previous) {
      this.transitionDuration = weights.has(this.restClip) ? transition.idle :
        previous?.name === LOCOMOTION_CLIPS.run && !weights.has(LOCOMOTION_CLIPS.run) ? transition.slowDown : transition.move;
    }
    for (const group of target.keys()) {
      if (this.locomotion.has(group)) continue;
      group.enableBlending = entering;
      group.weight = 0;
      group.start(true, this.playbackSpeed(group.name), group.from, group.to);
      this.locomotion.set(group, 0);
    }
    // Move the whole weight distribution together so the total remains one.
    let difference = 0;
    for (const [group, current] of this.locomotion) difference += Math.abs((target.get(group) ?? 0) - current);
    const fraction = entering || difference < 1e-8 ? 1 : Math.min(1, (2 * delta) / (this.transitionDuration * difference));
    this.transitioning = fraction < 1;
    for (const [group, current] of this.locomotion) {
      const desired = target.get(group) ?? 0;
      const weight = current + (desired - current) * fraction;
      if (weight === 0 && !target.has(group)) {
        group.stop(true);
        this.locomotion.delete(group);
      } else {
        group.weight = weight;
        this.locomotion.set(group, weight);
      }
    }
    this.active = primary ?? null;
    this.controlled = false;
  }

  private playbackSpeed(name: string): number {
    const definition = getAnimationDefinition(name);
    return definition ? effectivePlaybackSpeed(definition, this.settings[name]) : 1;
  }

  duration(name: string): number | undefined {
    const group = this.animations.find((animation) => animation.name === name);
    if (group) return group.getLength() * group.speedRatio / this.playbackSpeed(name);
  }

  setSettings(settings: AnimationSettings): void {
    this.settings = settings;
    for (const group of this.locomotion.size ? this.locomotion.keys() : this.active ? [this.active] : []) {
      const speed = this.playbackSpeed(group.name);
      if (group.speedRatio !== speed) group.speedRatio = speed;
    }
  }

  togglePause(): boolean {
    if (!this.active) return false;
    for (const group of this.locomotion.size ? this.locomotion.keys() : [this.active]) {
      if (this.paused) group.restart();
      else group.pause();
    }
    this.paused = !this.paused;
    return this.paused;
  }
}
