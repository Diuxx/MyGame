import { getEnemyCollision } from "./enemyState.ts";
import type { FieldEnemy } from "./mapEnemySimulation.ts";
import type { TargetCandidate } from "../character/targetSelection.ts";

/** Read only living, active map enemies; never depend on Babylon mesh positions. */
export function collectMapTargetCandidates(encounters: readonly FieldEnemy[]): TargetCandidate[] {
  return encounters.flatMap((actor) => {
    const enemy = actor.entity;
    if (actor.state === "inactive" || actor.state === "dead" || enemy.defeated || enemy.health <= 0) return [];
    return [{
      id: "map:" + actor.spec.id,
      x: enemy.position[0], z: enemy.position[2], groundY: enemy.position[1],
      radius: getEnemyCollision(enemy).radius, alive: true,
      clickHeight: enemy.definition.hurtbox.height,
      clickOffsetY: enemy.definition.hurtbox.offset[1],
    }];
  });
}
