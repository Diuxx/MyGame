import { AnimationGroup } from "@babylonjs/core";

export const IDLE_ANIMATION = "Idle_3";
export const ATTACK_ANIMATION = "Right_Hand_Sword_Slash";

export const ANIMATION_LABELS: Record<string, string> = {
  [IDLE_ANIMATION]: "Repos",
  "Walking": "Marche",
  "Running": "Course",
  [ATTACK_ANIMATION]: "Attaque",
};

/** Manages only playback; no gameplay state or physics are implemented here. */
export class AnimationPlayer {
  private active: AnimationGroup | null = null;
  private speed = 1;
  private paused = false;
  private readonly idle: AnimationGroup | undefined;

  constructor(private readonly animations: AnimationGroup[]) {
    this.idle = animations.find((animation) => animation.name === IDLE_ANIMATION);
    for (const animation of animations) {
      animation.onAnimationGroupEndObservable.add(() => {
        if (this.active === animation && animation.name === ATTACK_ANIMATION) {
          this.play(this.idle?.name ?? this.animations[0].name);
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
    const loop = name !== ATTACK_ANIMATION;
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
