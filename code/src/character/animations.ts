import { AnimationGroup } from "@babylonjs/core";

export const IDLE_ANIMATION = "Idle_9";
export const ATTACK_ANIMATION = "Thrust_Slash";
const WALK = "Walking";
const BACKWARD = "Walk_Backward_inplace";
const RUN = "Running";
const CROUCH_WALK = "Cautious_Crouch_Walk_Forward_inplace";
const LOOPING_CLIPS = new Set([IDLE_ANIMATION, WALK, BACKWARD, RUN, CROUCH_WALK]);

export function selectLocomotion(vertical: number, running: boolean): string {
  return vertical < 0 ? BACKWARD : running ? RUN : WALK;
}

export const ANIMATION_LABELS: Record<string, string> = {
  [IDLE_ANIMATION]: "Repos",
  [WALK]: "Marche",
  [BACKWARD]: "Marche arrière",
  [RUN]: "Course",
  [CROUCH_WALK]: "Marche accroupie",
  [ATTACK_ANIMATION]: "Attaque",
};

/** Manages only playback; no gameplay state or physics are implemented here. */
export class AnimationPlayer {
  private active: AnimationGroup | null = null;
  private speed = 1;
  private paused = false;
  // The GLB currently uses the same clip for neutral and combat rest.
  private combatIdle = false;

  get restClip(): string {
    return this.combatIdle ? this.combatIdleClip : IDLE_ANIMATION;
  }

  constructor(private readonly animations: AnimationGroup[], private readonly combatIdleClip = IDLE_ANIMATION) {
    for (const clip of [IDLE_ANIMATION, WALK, BACKWARD, RUN, ATTACK_ANIMATION, combatIdleClip]) {
      if (!animations.some(({ name }) => name === clip)) throw new Error(`Clip requis absent de hero.glb : ${clip}`);
    }
    for (const animation of animations) {
      animation.enableBlending = true;
      animation.blendingSpeed = 0.15;
      animation.onAnimationGroupEndObservable.add(() => {
        if (this.active === animation && !animation.loopAnimation) {
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

  play(name: string): void {
    const selected = this.animations.find((animation) => animation.name === name);
    if (!selected) throw new Error(`Animation inconnue : ${name}`);
    for (const animation of this.animations) animation.stop(true);
    this.active = selected;
    this.paused = false;
    if (name === ATTACK_ANIMATION) this.combatIdle = true;
    else if (name === IDLE_ANIMATION && name !== this.restClip) this.combatIdle = false;
    const loop = LOOPING_CLIPS.has(name) || name === this.combatIdleClip;
    selected.start(loop, this.speed, selected.from, selected.to);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    if (this.active) this.active.speedRatio = speed;
  }

  togglePause(): boolean {
    if (!this.active) return false;
    if (this.paused) this.active.play();
    else this.active.pause();
    this.paused = !this.paused;
    return this.paused;
  }
}
