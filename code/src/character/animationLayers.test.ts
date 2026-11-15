import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Animation, AnimationGroup, NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { allowsLocomotion, attackLayerWeight, isUpperBodyBone } from "./animationLayers.ts";
import { AnimationPlayer } from "./animations.ts";
import { createAnimationSettings, effectivePlaybackSpeed, getAnimationDefinition, HERO_ANIMATIONS } from "./animationSettings.ts";
import { HERO_TUNING } from "./heroTuning.ts";
import { createCharacterController } from "./characterController.ts";

test("upper-body mask includes the spine, arms, hands and fingers", () => {
  for (const name of [
    "mixamorig:Spine", "mixamorig:Spine1", "mixamorig:Spine2",
    "mixamorig:Neck", "mixamorig:Head", "mixamorig:LeftShoulder",
    "mixamorig:RightArm", "mixamorig:LeftForeArm",
    "mixamorig:RightHand", "mixamorig:LeftHandThumb1",
  ]) assert.equal(isUpperBodyBone(name), true, name);
});

test("hips, legs, feet and mesh roots stay in the locomotion layer", () => {
  for (const name of [
    "mixamorig:Hips", "mixamorig:LeftUpLeg", "mixamorig:RightLeg",
    "mixamorig:LeftFoot", "mixamorig:RightToeBase", "Armature", "RootNode",
  ]) assert.equal(isUpperBodyBone(name), false, name);
});

test("attack blending ramps in, remains full, then fades before the clip ends", () => {
  const fade = HERO_TUNING.blending.attackFadeSeconds;
  assert.equal(attackLayerWeight(0, fade), 0);
  assert.equal(attackLayerWeight(fade / 2, fade), 0.5);
  assert.equal(attackLayerWeight(fade, fade), 1);
  assert.equal(attackLayerWeight(fade, fade / 4), 0.25);
  assert.equal(attackLayerWeight(fade, 0), 0);
  assert.equal(attackLayerWeight(Number.NaN, fade), 0);
});

test("light attacks permit movement but dodge and full-body previews do not", () => {
  assert.equal(allowsLocomotion(), true);
  assert.equal(allowsLocomotion("attack"), HERO_TUNING.attack.allowMovement);
  assert.equal(allowsLocomotion("dodge"), false);
  assert.equal(allowsLocomotion("preview"), false);
});

function createPlayer(t: TestContext) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  t.after(() => engine.dispose());
  const bones = ["mixamorig:Spine", "mixamorig:LeftUpLeg"].map((name) => new TransformNode(name, scene));
  const names = new Set(["idle", "walk", "run", "stop", "attack", "dodge", "dying", "combat-stance", HERO_TUNING.blending.combatLegsClip]);
  const clips = [...names].map((name) => {
    const group = new AnimationGroup(name, scene);
    for (const bone of bones) {
      const track = new Animation(name, "rotation.x", 30, Animation.ANIMATIONTYPE_FLOAT);
      track.setKeys([{ frame: 0, value: 0 }, { frame: name === "combat-stance" ? 50 : 60, value: 1 }]);
      group.addTargetedAnimation(track, bone);
    }
    return group;
  });
  const player = new AnimationPlayer(clips, scene);
  const layer = (name: string) => {
    const group = scene.animationGroups.find((group) => group.name === name);
    assert.ok(group, name);
    return group;
  };
  return { player, layer, scene };
}

test("a stationary attack blends directly into combat stance on hit and returns to idle on miss", (t) => {
  Object.assign(globalThis, { window: new EventTarget(), document: new EventTarget() });
  t.after(() => {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "document");
  });
  for (const hit of [true, false]) {
    const { player, layer, scene } = createPlayer(t);
    const root = new TransformNode("hero", scene);
    const controller = createCharacterController(
      scene, new EventTarget() as HTMLCanvasElement, root, 10,
      { follow() {}, alpha: 0 }, player, new AbortController().signal,
      undefined, undefined, () => hit,
    );
    controller.setAnimationSettings(createAnimationSettings({
      attack: { impact: { from: 0.95, until: 0.99, doubleHit: false } },
    }));
    t.mock.method(scene.getEngine(), "getDeltaTime", () => 16);
    controller.attack();
    const attack = layer("attack-upper");
    const idle = layer("idle-upper");
    const stance = layer("combat-stance-upper");
    const tick = (progress: number) => {
      attack.goToFrame(attack.from + (attack.to - attack.from) * progress);
      scene.onBeforeRenderObservable.notifyObservers(scene);
    };
    tick(0.5);
    assert.equal(idle.isStarted, true);
    tick(0.97);
    assert.equal(Boolean(idle.isStarted), !hit);
    assert.equal(Boolean(stance.isStarted), hit);
    assert.equal(player.activeName, "attack");
    tick(1);
    assert.equal(player.activeName, hit ? "combat-stance" : "idle");
    assert.equal(Boolean(idle.isStarted), !hit);
  }
});

test("combat stance keeps its upper pose while the legs transition from stance to walk and back", (t) => {
  const { player, layer } = createPlayer(t);
  player.setCombatIdle(true);
  player.updateLocomotion(undefined, 1);
  const upper = layer("combat-stance-upper");
  const idleLegs = layer("combat-stance-lower");
  const walkingLegs = layer("combat-walk-lower");
  upper.goToFrame(18);
  assert.equal(upper.weight, 1);
  assert.equal(idleLegs.weight, 1);
  assert.ok(!walkingLegs.isStarted);

  player.updateLocomotion("combat-stance", HERO_TUNING.transition.move / 2);
  assert.equal(upper.weight, 1);
  assert.equal(upper.getCurrentFrame(), 18);
  assert.equal(idleLegs.weight, 0.5);
  assert.equal(walkingLegs.weight, 0.5);
  assert.equal(walkingLegs.targetedAnimations[0].animation.name, HERO_TUNING.blending.combatLegsClip);
  assert.equal(upper.to, 50);
  assert.equal(walkingLegs.to, HERO_TUNING.blending.combatLegsClip === "combat-stance" ? 50 : 60);
  const reference = getAnimationDefinition(HERO_TUNING.blending.combatLegsClip)!.movement!.syncReference;
  const stance = HERO_ANIMATIONS.combatStance;
  const rate = effectivePlaybackSpeed(stance, createAnimationSettings()[stance.id]);
  assert.equal(walkingLegs.speedRatio, rate * (reference.playbackSpeed * stance.movement!.syncReference.speed / reference.speed));
  player.updateLocomotion("combat-stance", 1);
  assert.equal(idleLegs.isStarted, false);
  assert.equal(upper.weight, 1);
  assert.equal(upper.getCurrentFrame(), 18);

  player.updateLocomotion(undefined, 1);
  assert.equal(walkingLegs.isStarted, false);
  assert.equal(idleLegs.weight, 1);
  assert.equal(upper.getCurrentFrame(), 18);
  player.setCombatIdle(false);
  player.updateLocomotion(undefined, 1);
  assert.equal(player.activeName, "idle");
  assert.equal(upper.isStarted, false);
});

test("the attack animates idle legs and hands the legs back to walk or run during the same strike", (t) => {
  const { player, layer } = createPlayer(t);
  const upperAttack = layer("attack-upper");
  const lowerAttack = layer("attack-lower");

  player.play("attack", true, true);
  upperAttack.goToFrame(18);
  lowerAttack.goToFrame(18);
  const fade = HERO_TUNING.blending.attackFadeSeconds;
  player.updateLocomotion(undefined, fade);
  const weight = attackLayerWeight(fade, 0.7 * player.duration("attack")!);
  assert.equal(upperAttack.weight, weight);
  assert.equal(lowerAttack.weight, weight);
  assert.equal(layer("idle-lower").weight, 1 - weight);

  for (const movement of ["walk", "run"]) {
    player.updateLocomotion(movement, 1);
    assert.equal(upperAttack.weight, weight);
    assert.equal(lowerAttack.weight, 0);
    assert.equal(layer(movement + "-lower").weight, 1);
  }
  player.updateLocomotion(undefined, 1);
  assert.equal(lowerAttack.weight, weight);
  assert.equal(lowerAttack.getCurrentFrame(), 18);
  assert.equal(player.actionProgress, 0.3);

  player.play("dying");
  assert.equal(upperAttack.isStarted, false);
  assert.equal(lowerAttack.isStarted, false);
});

test("cancelled dodge keeps its outgoing animation until the return-to-run fade progresses", (t) => {
  const { player, layer } = createPlayer(t);
  player.play("dodge", true);
  const dodge = layer("dodge");
  player.finishAction(0.1);
  assert.equal(dodge.isStarted, true);
  player.updateLocomotion("run", 0.025);
  assert.ok(layer("run-lower").weight > 0);
  assert.ok(layer("run-lower").weight < 1);
  assert.equal(dodge.isStarted, true);
  player.updateLocomotion("run", 0.075);
  assert.equal(layer("run-lower").weight, 1);
});


test("combo follow-up starts at the configured frame while fading out the first slash", (t) => {
  const { player, layer } = createPlayer(t);
  player.play("attack", true, true);
  layer("attack-upper").goToFrame(45);
  player.updateLocomotion(undefined, 0.2);

  player.finishAction(0.08);
  player.play("attack", true, true, 0.25, 0.08);
  const incoming = layer("attack-upper-combo");
  const outgoing = layer("attack-upper");
  assert.equal(incoming.isStarted, true);
  assert.equal(outgoing.isStarted, true);
  assert.ok(Math.abs(player.actionProgress - 0.25) < 0.01);

  player.updateLocomotion(undefined, 0.04);
  assert.ok(incoming.weight > 0);
  assert.ok(outgoing.weight > 0);
  assert.ok(incoming.weight + outgoing.weight <= 1.000001);
  player.play("dying");
  assert.equal(incoming.isStarted, false);
  assert.equal(outgoing.isStarted, false);
});

test("a third chained slash can reuse the first layer after the first fade", (t) => {
  const { player, layer } = createPlayer(t);
  player.play("attack", true, true);
  player.updateLocomotion(undefined, 0.2);
  player.finishAction(0.08);
  player.play("attack", true, true, 0.25, 0.08);
  player.updateLocomotion(undefined, 0.2);
  player.finishAction(0.08);
  player.play("attack", true, true, 0.25, 0.08);
  assert.equal(layer("attack-upper").isStarted, true);
  assert.equal(layer("attack-upper-combo").isStarted, true);
});

/**
 * Real controller/input integration with Babylon NullEngine.
 * Pointer movement deliberately has no aiming API or picking surface.
 */
function createManualInputFixture(t: TestContext) {
  const originals = ["window", "document", "HTMLElement", "HTMLInputElement"].map((name) => ({
    name, descriptor: Object.getOwnPropertyDescriptor(globalThis, name),
  }));
  const keyboard = new EventTarget();
  const document = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperties(globalThis, {
    window: { value: keyboard, configurable: true },
    document: { value: document, configurable: true },
    HTMLElement: { value: class MockElement {}, configurable: true },
    HTMLInputElement: { value: class MockInputElement {}, configurable: true },
  });
  t.after(() => {
    for (const { name, descriptor } of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  });
  const canvas = Object.assign(new EventTarget(), { focus() {} }) as HTMLCanvasElement;
  function key(value: string, type: "keydown" | "keyup"): void {
    keyboard.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), {
      key: value, code: "Key" + value.toUpperCase(),
      ctrlKey: false, altKey: false, metaKey: false, repeat: false,
    }));
  }
  function pointer(type: "pointermove" | "pointerdown", button = 0): void {
    canvas.dispatchEvent(Object.assign(new Event(type), {
      pointerType: "mouse", button, clientX: 500, clientY: 400,
    }));
  }
  return { canvas, key, pointer };
}

test("normal ZQSD follows camera, keeps last facing and attacks without mouse aim", (t) => {
  const { player, scene } = createPlayer(t);
  const { canvas, key, pointer } = createManualInputFixture(t);
  const root = new TransformNode("hero", scene);
  const camera = { alpha: 0, follow() {} };
  const controller = createCharacterController(
    scene, canvas, root, 20, camera, player, new AbortController().signal,
  );
  player.play("idle");
  t.mock.method(scene.getEngine(), "getDeltaTime", () => 16);
  // Any cursor-based raycast would fail the test immediately.
  t.mock.method(scene, "createPickingRay", () => { throw new Error("Cursor aiming is disabled"); });

  key("z", "keydown");
  scene.onBeforeRenderObservable.notifyObservers(scene);
  assert.ok(root.position.x < -0.01, "Z moves toward the top of the camera (world -X)");
  assert.ok(Math.abs(root.position.z) < 1e-6);
  assert.ok(root.rotation.y < 0, "hero rotates toward the direction of travel");

  key("z", "keyup");
  const facingAtRest = root.rotation.y;
  const positionAtRest = root.position.clone();
  pointer("pointermove");
  scene.onBeforeRenderObservable.notifyObservers(scene);
  assert.equal(root.rotation.y, facingAtRest, "idle facing must not track the pointer");
  assert.ok(root.position.equals(positionAtRest));

  pointer("pointerdown", 0);
  assert.equal(controller.isAttacking, true);
  assert.equal(root.rotation.y, facingAtRest, "attack uses the last movement facing");
});

test("changing camera angle changes ZQSD direction without requiring a cursor", (t) => {
  const { player, scene } = createPlayer(t);
  const { canvas, key } = createManualInputFixture(t);
  const root = new TransformNode("hero", scene);
  const camera = { alpha: Math.PI / 2, follow() {} };
  createCharacterController(scene, canvas, root, 20, camera, player, new AbortController().signal);
  player.play("idle");
  t.mock.method(scene.getEngine(), "getDeltaTime", () => 16);
  key("z", "keydown");
  scene.onBeforeRenderObservable.notifyObservers(scene);
  assert.ok(root.position.z < -0.01, "camera rotated 90°: Z now moves along world -Z");
  assert.ok(Math.abs(root.position.x) < 1e-6);
});

test("Target Lock keeps enemy facing and falls back to camera ZQSD when switched off", (t) => {
  const { player, scene } = createPlayer(t);
  const { canvas, key } = createManualInputFixture(t);
  const root = new TransformNode("hero", scene);
  const camera = { alpha: 0, follow() {} };
  const controller = createCharacterController(
    scene, canvas, root, 20, camera, player, new AbortController().signal,
  );
  player.play("idle");
  t.mock.method(scene.getEngine(), "getDeltaTime", () => 16);
  let locked = true;
  let movementReference: "camera" | "target" = "target";
  controller.setTargetingProvider(() => locked
    ? { target: { x: 0, z: 5 }, movementReference, turnSpeed: 25 }
    : undefined);
  key("z", "keydown");
  scene.onBeforeRenderObservable.notifyObservers(scene);
  assert.ok(root.position.z > 0, "target-relative Z approaches the enemy");
  assert.ok(Math.abs(root.position.x) < 1e-6);

  // Same key, camera reference: movement changes direction but facing stays on enemy.
  movementReference = "camera";
  const previousX = root.position.x;
  scene.onBeforeRenderObservable.notifyObservers(scene);
  assert.ok(root.position.x < previousX, "camera-relative Z follows the camera instead of the target");
  assert.ok(root.rotation.y > 0, "hero faces the target, not its movement direction");

  // Switching off Target Lock immediately restores normal camera movement and facing.
  locked = false;
  const facingBeforeUnlock = root.rotation.y;
  scene.onBeforeRenderObservable.notifyObservers(scene);
  assert.ok(root.rotation.y < facingBeforeUnlock, "hero now rotates toward camera-relative movement");
  key("z", "keyup");
  const facingAfterStop = root.rotation.y;
  scene.onBeforeRenderObservable.notifyObservers(scene);
  assert.equal(root.rotation.y, facingAfterStop, "without movement or lock, facing remains stable");
});

test("W cycles targets and X cancels the lock through the same hero input controller", (t) => {
  const { player, scene } = createPlayer(t);
  const { canvas, key } = createManualInputFixture(t);
  const hero = new TransformNode("hero", scene);
  const controller = createCharacterController(
    scene, canvas, hero, 20, { alpha: 0, follow() {} },
    player, new AbortController().signal,
  );
  let cycles = 0;
  let cancels = 0;
  controller.setTargetingActions({
    cycle: () => { cycles++; },
    cancel: () => { cancels++; },
  });

  key("w", "keydown");
  key("x", "keydown");
  assert.equal(cycles, 1);
  assert.equal(cancels, 1);
  assert.equal(hero.position.x, 0, "target shortcuts must not alter normal movement");
  assert.equal(hero.position.z, 0);
});
