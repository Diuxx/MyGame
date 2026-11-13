import { applyDamage, intersectsSwing, regenerate, SWORD_SWING, type Position } from "../combat/combat.ts";
import { resolveCircleMovement, type GroundStep } from "../combat/bodyCollision.ts";
import { getEnemyCollision, type Enemy } from "./enemyState.ts";

/** Runtime enemy state, independent of Babylon.js and developer UI. */
export function createEnemyManager() {
  const instances = new Map<string, Enemy>();

  return {
    add(enemy: Enemy): void {
      if (instances.has(enemy.id)) throw new Error(`Identifiant d'ennemi déjà utilisé : ${enemy.id}`);
      instances.set(enemy.id, enemy);
    },
    get(id: string): Enemy | undefined {
      return instances.get(id);
    },
    list(): Enemy[] {
      return [...instances.values()];
    },
    remove(id: string): void {
      instances.delete(id);
    },
    clear(): void {
      instances.clear();
    },
    update(deltaSeconds: number): void {
      for (const enemy of instances.values()) regenerate(enemy, deltaSeconds);
    },
    resolveMovement(start: Position, desired: GroundStep, heroRadius: number): GroundStep {
      const solids = [...instances.values()].flatMap((enemy) => {
        const collision = getEnemyCollision(enemy);
        return enemy.defeated || !collision.solid
          ? []
          : [{ x: enemy.position[0], z: enemy.position[2], radius: collision.radius }];
      });
      return resolveCircleMovement(start, desired, heroRadius, solids);
    },
    strike(origin: Position, facingYaw: number): boolean {
      let hit = false;
      for (const enemy of instances.values()) {
        if (intersectsSwing(origin, facingYaw, enemy.position, enemy.definition.hurtbox) &&
            applyDamage(enemy, SWORD_SWING.damage)) {
          hit = true;
        }
      }
      return hit;
    },
  };
}
