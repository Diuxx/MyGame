import { getEnemyCollision, type Enemy } from "../enemies/enemyState.ts";
import type { FieldEnemy } from "../enemies/mapEnemySimulation.ts";
import type { TargetCandidate } from "../character/targetSelection.ts";

/** Adapt the two existing enemy runtimes to a shared, render-independent target snapshot. */
export function collectTargetCandidates(
  practice: readonly Enemy[],
  encounters: readonly FieldEnemy[],
): TargetCandidate[] {
  const targets: TargetCandidate[] = [];
  for (const enemy of practice) {
    if (enemy.defeated || enemy.health <= 0) continue;
    const collision = getEnemyCollision(enemy);
    targets.push({
      id: "practice:" + enemy.id,
      x: enemy.position[0], z: enemy.position[2], groundY: enemy.position[1],
      radius: collision.radius, alive: true,
    });
  }
  for (const actor of encounters) {
    const enemy = actor.entity;
    if (actor.state === "inactive" || actor.state === "dead" || enemy.defeated || enemy.health <= 0) continue;
    targets.push({
      id: "map:" + actor.spec.id,
      x: enemy.position[0], z: enemy.position[2], groundY: enemy.position[1],
      radius: getEnemyCollision(enemy).radius, alive: true,
    });
  }
  return targets;
}
