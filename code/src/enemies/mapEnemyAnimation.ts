import type { EnemyActivity } from "./mapEnemySimulation.ts";

const FADE_SECONDS = 0.15;
interface Clip {
  readonly name: string;
  readonly isStarted: boolean;
  weight: number;
  start(loop: boolean): void;
  stop(skipEndEvent: boolean): void;
}

export function createMapEnemyAnimation(groups: readonly Clip[]) {
  const idle = groups.find(({ name }) => name === "Idle");
  const run = groups.find(({ name }) => name === "Run");
  let active: Clip | undefined;

  return {
    get activeName() { return active?.name; },
    update(state: EnemyActivity, moving: boolean, delta: number): void {
      if (state === "dead" || state === "inactive") {
        if (idle?.isStarted) idle.stop(true);
        if (run?.isStarted) run.stop(true);
        active = undefined;
        return;
      }
      const running = moving && (state === "chase" || state === "return" || state === "patrol");
      const next = running ? run ?? idle : idle;
      if (!next) {
        active?.stop(true);
        active = undefined;
        return;
      }
      const previous = next === idle ? run : idle;
      const fading = previous?.isStarted;
      if (!next.isStarted) {
        next.weight = fading ? 0 : 1;
        next.start(true);
      }
      if (fading) {
        next.weight = Math.min(1, next.weight + delta / FADE_SECONDS);
        previous.weight = 1 - next.weight;
        if (next.weight === 1) previous.stop(true);
      }
      active = next;
    },
  };
}
