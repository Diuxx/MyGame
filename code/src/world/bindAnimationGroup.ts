import { Quaternion, TransformNode, type AnimationGroup, type Skeleton } from "@babylonjs/core";

function sameRestPose(source: TransformNode, target: TransformNode): boolean {
  const sourceRotation = source.rotationQuaternion ?? Quaternion.FromEulerVector(source.rotation);
  const targetRotation = target.rotationQuaternion ?? Quaternion.FromEulerVector(target.rotation);
  if (source.name !== target.name ||
      // A Blender round trip can introduce sub-millimetre differences in joint positions.
      !source.position.equalsWithEpsilon(target.position, 1e-3) ||
      !source.scaling.equalsWithEpsilon(target.scaling, 1e-4) ||
      Math.abs(Quaternion.Dot(sourceRotation, targetRotation)) < 1 - 1e-6) return false;
  if (source.name === "__root__") return true;
  return source.parent instanceof TransformNode && target.parent instanceof TransformNode &&
    sameRestPose(source.parent, target.parent);
}

/** Give a GLB clip its own tracks on the target model's linked bone nodes. */
export function bindAnimationGroup(group: AnimationGroup, skeletons: readonly Skeleton[]): AnimationGroup {
  if (!group.targetedAnimations.length) throw new Error("Clip vide : " + group.name);
  const targets = new Map<string, TransformNode | null>();
  for (const skeleton of skeletons) {
    for (const bone of skeleton.bones) {
      const node = bone.getTransformNode();
      if (node) targets.set(node.name, targets.has(node.name) ? null : node);
    }
  }
  const bindings = new Map<TransformNode, TransformNode>();
  for (const { target } of group.targetedAnimations) {
    if (bindings.has(target)) continue;
    const instanceNode = targets.get(target.name);
    if (!(target instanceof TransformNode) || !instanceNode || !sameRestPose(target, instanceNode)) {
      throw new Error("Os absent, ambigu ou pose de repos incompatible : " + target.name);
    }
    bindings.set(target, instanceNode);
  }
  return group.clone(group.name, (target: TransformNode) => bindings.get(target), true);
}
