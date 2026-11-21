import bpy
from mathutils import Vector


HIP_NAMES = ("Hips", "mixamorig:Hips")


def retarget_mixamo_clip(source, rig):
    action = source.animation_data.action
    start, end = map(int, action.frame_range)

    target_bones = rig.pose.bones
    source_bones = source.pose.bones
    if (set(target_bones.keys()) != set(source_bones.keys())
            or any((bone.parent and bone.parent.name) !=
                   (source_bones[bone.name].parent and source_bones[bone.name].parent.name)
                   for bone in target_bones)):
        raise ValueError(f"{source.name}: noms ou hiérarchie des os incompatibles")
    hips_name = next((name for name in HIP_NAMES if name in target_bones and name in source_bones), None)
    if hips_name is None:
        raise ValueError(f"{source.name}: bassin introuvable (attendu : {', '.join(HIP_NAMES)})")

    def rest_world(armature, name):
        return armature.matrix_world @ armature.data.bones[name].matrix_local

    # Express each rest-relative rotation in the target bone's axes.
    change_basis = {
        bone.name: rest_world(rig, bone.name).to_quaternion().inverted()
        @ rest_world(source, bone.name).to_quaternion()
        for bone in target_bones
    }
    hip_rest = rest_world(rig, hips_name)
    source_hip_rest = rest_world(source, hips_name)
    height_ratio = hip_rest.translation.z / source_hip_rest.translation.z
    world_to_hip = hip_rest.to_3x3().inverted()
    scene = bpy.context.scene
    rotations = {}
    for frame in range(start, end + 1):
        scene.frame_set(frame)
        for bone in target_bones:
            axes = change_basis[bone.name]
            rotation = axes @ source_bones[bone.name].matrix_basis.to_quaternion() @ axes.inverted()
            if bone.name in rotations:
                rotation.make_compatible(rotations[bone.name])
            rotations[bone.name] = rotation.copy()
            bone.rotation_mode = "QUATERNION"
            bone.rotation_quaternion = rotation
            bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)

        # Preserve vertical bounce only. The gameplay root handles XZ movement.
        source_height = (source.matrix_world @ source_bones[hips_name].head).z
        hip = target_bones[hips_name]
        hip.location = world_to_hip @ Vector(
            (0, 0, (source_height - source_hip_rest.translation.z) * height_ratio)
        )
        hip.keyframe_insert(data_path="location", frame=frame)
