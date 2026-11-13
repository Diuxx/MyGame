import type { AnimationGroup } from "@babylonjs/core";
import { HERO_TUNING } from "./heroTuning";
import { LOCOMOTION_CLIPS, locomotionWeights } from "./locomotion";
import type { GroundVector, MovementMode } from "./movement";

export const IDLE_ANIMATION = LOCOMOTION_CLIPS.idle;
export const ATTACK_ANIMATION = "Thrust_Slash";
export const DODGE_ANIMATION = "Roll_Dodge_3";
export const CROUCH_WALK = "Cautious_Crouch_Walk_Forward_inplace";
const LOOPING_CLIPS = new Set([...Object.values(LOCOMOTION_CLIPS), CROUCH_WALK]);

export const ANIMATION_LABELS: Record<string, string> = {
  [IDLE_ANIMATION]: "Repos",
  [LOCOMOTION_CLIPS.walk]: "Marche",
  [LOCOMOTION_CLIPS.backward]: "Marche arrière",
  [LOCOMOTION_CLIPS.run]: "Course",
  [LOCOMOTION_CLIPS.left]: "Pas à gauche",
  [LOCOMOTION_CLIPS.right]: "Pas à droite",
  [CROUCH_WALK]: "Marche accroupie",
  [ATTACK_ANIMATION]: "Attaque",
  [DODGE_ANIMATION]: "Esquive",
};

/** Manages only playback; no gameplay state or physics are implemented here. */
export class AnimationPlayer {
  private active: AnimationGroup | null = null;
  private speed = 1;
  private paused = false;
  private readonly available: Set<string>;
  private locomotion = new Map<AnimationGroup, number>();
  private controlled = false;
  private transitioning = false;
  private transitionDuration = HERO_TUNING.transition.move;
  // The GLB currently uses the same clip for neutral and combat rest.
  private combatIdle = false;

  get restClip(): string {
    return this.combatIdle ? this.combatIdleClip : IDLE_ANIMATION;
  }

  constructor(private readonly animations: AnimationGroup[], private readonly combatIdleClip = IDLE_ANIMATION) {
    this.available = new Set(animations.map(({ name }) => name));
    for (const clip of [IDLE_ANIMATION, LOCOMOTION_CLIPS.walk, LOCOMOTION_CLIPS.backward, LOCOMOTION_CLIPS.run, ATTACK_ANIMATION, DODGE_ANIMATION, combatIdleClip]) {
      if (!this.available.has(clip)) throw new Error(`Clip requis absent de hero.glb : ${clip}`);
    }
    for (const animation of animations) {
      animation.enableBlending = true;
      animation.blendingSpeed = 0.15;
      animation.onAnimationGroupEndObservable.add(() => {
        if (this.active === animation && !animation.loopAnimation && !this.controlled) {
          this.play(this.restClip);
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
    if (name === ATTACK_ANIMATION) this.combatIdle = true;
    else if (name === IDLE_ANIMATION && name !== this.restClip) this.combatIdle = false;
    const loop = LOOPING_CLIPS.has(name) || name === this.combatIdleClip;
    selected.enableBlending = true;
    selected.weight = -1;
    selected.start(loop, this.speed, selected.from, selected.to);
  }

  updateLocomotion(displacement: GroundVector, yaw: number, running: boolean, mode: MovementMode, delta: number): void {
    const weights = locomotionWeights(displacement, yaw, running, mode, this.restClip, this.available);
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
      group.start(true, this.speed, group.from, group.to);
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

  setSpeed(speed: number): void {
    this.speed = speed;
    if (this.active) this.active.speedRatio = speed;
    for (const group of this.locomotion.keys()) group.speedRatio = speed;
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
