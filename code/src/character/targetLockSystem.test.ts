import assert from "node:assert/strict";
import test from "node:test";
import { NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { createTargetLockSystem } from "./targetLockSystem.ts";
import { createTargetingSettings } from "./targetingSettings.ts";
import type { TargetCandidate } from "./targetSelection.ts";

const enemy = (id: string, x: number): TargetCandidate =>
  ({ id, x, z: 0, alive: true, radius: 0.8, groundY: 0 });

// Read the getter through a fresh call so static narrowing never assumes it cannot change.
function targetId(lock: ReturnType<typeof createTargetLockSystem>): string | undefined {
  return lock.target?.id;
}

test("lock requires W or a confirmed hit and never reacquires simply on proximity", (t) => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const hero = new TransformNode("hero", scene);
  const abort = new AbortController();
  t.after(() => { abort.abort(); engine.dispose(); });
  const enemies = [enemy("practice:one", 2), enemy("map:two", 4)];
  const lock = createTargetLockSystem(scene, hero, () => enemies, () => true, abort.signal);
  lock.setSettings({ ...createTargetingSettings(), enabled: true });
  const tick = () => scene.onBeforeRenderObservable.notifyObservers(scene);

  tick();
  assert.equal(lock.target, undefined);
  assert.equal(lock.motion, undefined);

  lock.cycleTarget();
  assert.equal(targetId(lock), "practice:one");
  assert.ok(lock.motion);
  lock.cycleTarget();
  assert.equal(targetId(lock), "map:two");
  lock.clearTarget();
  tick();
  assert.equal(lock.target, undefined);
  assert.equal(lock.motion, undefined);

  lock.lockOnHit("map:two");
  assert.equal(targetId(lock), "map:two", "a confirmed strike locks the specific hit target");
  lock.lockOnHit("practice:one");
  assert.equal(targetId(lock), "map:two", "additional hits cannot replace an existing lock");

  enemies[1].x = 10.5;
  tick();
  assert.equal(lock.target, undefined, "release radius exceeded");
  assert.equal(lock.motion, undefined, "normal movement resumes immediately");
  enemies[1].x = 4;
  tick();
  assert.equal(lock.target, undefined, "returning inside radius does not cause reacquisition");
  lock.lockOnHit("practice:one");
  assert.equal(targetId(lock), "practice:one");

  enemies[0].alive = false;
  tick();
  assert.equal(lock.target, undefined, "defeated targets release the lock");
  lock.lockOnHit("practice:one");
  assert.equal(lock.target, undefined, "lethal hits cannot target a dead enemy");
});

test("disabled lock and unavailable hero cannot be activated through W or hit", (t) => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const hero = new TransformNode("hero", scene);
  const abort = new AbortController();
  t.after(() => { abort.abort(); engine.dispose(); });
  let available = false;
  const lock = createTargetLockSystem(scene, hero, () => [enemy("target", 1)], () => available, abort.signal);
  lock.setSettings({ ...createTargetingSettings(), enabled: true });
  lock.cycleTarget();
  lock.lockOnHit("target");
  assert.equal(lock.target, undefined);
  available = true;
  lock.lockOnHit("target");
  assert.equal(targetId(lock), "target");
  lock.setSettings({ ...createTargetingSettings(), enabled: false });
  assert.equal(lock.target, undefined);
  lock.cycleTarget();
  assert.equal(lock.target, undefined);
});
