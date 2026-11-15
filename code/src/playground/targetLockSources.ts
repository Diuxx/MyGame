import { getEnemyCollision, type Enemy } from "../enemies/enemyState.ts";
import type { FieldEnemy } from "../enemies/mapEnemySimulation.ts";
import { collectMapTargetCandidates } from "../enemies/targetCandidates.ts";
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
  targets.push(...collectMapTargetCandidates(encounters));
  return targets;
}
