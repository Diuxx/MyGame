import assert from "node:assert/strict";
import test from "node:test";
import { allowsLocomotion, attackLayerWeight, isUpperBodyBone } from "./animationLayers.ts";

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
