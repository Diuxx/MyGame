import assert from "node:assert/strict";
import test from "node:test";
import { Animation, AnimationGroup, NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { allowsLocomotion, attackLayerWeight, isUpperBodyBone } from "./animationLayers.ts";
import { AnimationPlayer } from "./animations.ts";

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
  assert.equal(attackLayerWeight(0, 1), 0);
  assert.equal(attackLayerWeight(0.06, 1), 0.5);
  assert.equal(attackLayerWeight(0.4, 0.4), 1);
  assert.ok(Math.abs(attackLayerWeight(0.8, 0.03) - 0.25) < 1e-9);
  assert.equal(attackLayerWeight(0.9, 0), 0);
  assert.equal(attackLayerWeight(Number.NaN, 1), 0);
});

test("light attacks permit movement but dodge and full-body previews do not", () => {
  assert.equal(allowsLocomotion(), true);
  assert.equal(allowsLocomotion("attack"), true);
  assert.equal(allowsLocomotion("dodge"), false);
  assert.equal(allowsLocomotion("preview"), false);
});

test("the attack animates idle legs and hands the legs back to walk or run during the same strike", (t) => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  t.after(() => engine.dispose());
  const bones = ["mixamorig:Spine", "mixamorig:LeftUpLeg"].map((name) => new TransformNode(name, scene));
  const clips = ["idle", "walk", "run", "stop", "attack", "dodge", "dying"].map((name) => {
    const group = new AnimationGroup(name, scene);
    for (const bone of bones) {
      const track = new Animation(name, "rotation.x", 30, Animation.ANIMATIONTYPE_FLOAT);
      track.setKeys([{ frame: 0, value: 0 }, { frame: 60, value: 1 }]);
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
  const upperAttack = layer("attack-upper");
  const lowerAttack = layer("attack-lower");

  player.play("attack", true, true);
  upperAttack.goToFrame(18);
  lowerAttack.goToFrame(18);
  player.updateLocomotion(undefined, 0.2);
  assert.equal(upperAttack.weight, 1);
  assert.equal(lowerAttack.weight, 1);
  assert.equal(layer("idle-lower").weight, 0);

  for (const movement of ["walk", "run"]) {
    player.updateLocomotion(movement, 1);
    assert.equal(upperAttack.weight, 1);
    assert.equal(lowerAttack.weight, 0);
    assert.equal(layer(movement + "-lower").weight, 1);
  }
  player.updateLocomotion(undefined, 1);
  assert.equal(lowerAttack.weight, 1);
  assert.equal(lowerAttack.getCurrentFrame(), 18);
  assert.equal(player.actionProgress, 0.3);

  player.play("dying");
  assert.equal(upperAttack.isStarted, false);
  assert.equal(lowerAttack.isStarted, false);
});
