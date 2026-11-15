import type { MapPosition } from "./types.ts";
import type { MapExit } from "./zoneContent.ts";

export function nearestExit(exits: readonly MapExit[], position: MapPosition): MapExit | undefined {
  let nearest: MapExit | undefined;
  let nearestDistance = Infinity;
  for (const exit of exits) {
    const distance = Math.hypot(position[0] - exit.position[0], position[2] - exit.position[2]);
    if (distance <= exit.triggerRadius && distance < nearestDistance) {
      nearest = exit;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** Re-arm only after leaving every exit's trigger, including following a map switch. */
export function createExitActivationGuard() {
  let mustLeave = false;
  return {
    observe(nearby: MapExit | undefined): void {
      if (!nearby) mustLeave = false;
    },
    get canActivate(): boolean { return !mustLeave; },
    consume(): void { mustLeave = true; },
  };
}
