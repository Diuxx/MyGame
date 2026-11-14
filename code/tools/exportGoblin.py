"""Build the rigged goblin and its separate Babylon.js clips with Blender."""

from collections import Counter
from pathlib import Path

import bpy
from mathutils import Vector


PUBLIC = Path(__file__).resolve().parents[1] / "public"
SOURCE_MODEL = PUBLIC / "models/enemies"
CLIPS = PUBLIC / "assets/animations/common"
MODEL = PUBLIC / "assets/models/enemies/goblin.glb"
HIPS = "mixamorig:Hips"


def only_object(kind, objects=None):
    obj, = (obj for obj in (bpy.context.scene.objects if objects is None else objects)
            if obj.type == kind)
    return obj


def triangle_uvs(mesh):
    mesh.calc_loop_triangles()
    uvs = mesh.uv_layers.active.uv
    return Counter(tuple(sorted(tuple(round(value, 4) for value in uvs[i].vector)
                                for i in triangle.loops))
                   for triangle in mesh.loop_triangles)


def export_glb(path, objects, clip_name=""):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=True,
        export_animations=bool(clip_name), export_animation_mode="ACTIVE_ACTIONS",
        export_nla_strips_merged_animation_name=clip_name,
        export_image_format="AUTO", export_all_influences=False,
    )


def export_clip(rig, file_name, clip_name):
    previous_objects = set(bpy.context.scene.objects)
    bpy.ops.import_scene.fbx(filepath=str(CLIPS / (file_name + ".fbx")))
    imported = set(bpy.context.scene.objects) - previous_objects
    source = only_object("ARMATURE", imported)
    action = source.animation_data.action
    start, end = map(int, action.frame_range)

    target_bones = rig.pose.bones
    source_bones = source.pose.bones
    if (set(target_bones.keys()) != set(source_bones.keys())
            or any((bone.parent and bone.parent.name) !=
                   (source_bones[bone.name].parent and source_bones[bone.name].parent.name)
                   for bone in target_bones)):
        raise ValueError(f"{file_name}: incompatible bone names or hierarchy")

    def rest_world(armature, name):
        return armature.matrix_world @ armature.data.bones[name].matrix_local

    # Express each rest-relative rotation in the goblin bone's axes.
    change_basis = {
        bone.name: rest_world(rig, bone.name).to_quaternion().inverted()
        @ rest_world(source, bone.name).to_quaternion()
        for bone in target_bones
    }
    hip_rest = rest_world(rig, HIPS)
    source_hip_rest = rest_world(source, HIPS)
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
        source_height = (source.matrix_world @ source_bones[HIPS].head).z
        hip = target_bones[HIPS]
        hip.location = world_to_hip @ Vector(
            (0, 0, (source_height - source_hip_rest.translation.z) * height_ratio)
        )
        hip.keyframe_insert(data_path="location", frame=frame)

    rig.animation_data.action.name = clip_name
    export_glb(CLIPS / (file_name + ".glb"), [rig], clip_name)
    rig.animation_data_clear()
    for bone in target_bones:
        bone.matrix_basis.identity()
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_MODEL / "goblin.glb"))
    original = only_object("MESH")
    uvs = triangle_uvs(original.data)
    material, = original.data.materials
    bpy.data.objects.remove(original, do_unlink=True)

    bpy.ops.import_scene.fbx(filepath=str(SOURCE_MODEL / "goblin.fbx"))
    rig = only_object("ARMATURE")
    mesh = only_object("MESH")
    if uvs != triangle_uvs(mesh.data):
        raise ValueError("The textured GLB and rigged FBX do not share the same UVs")
    mesh.data.materials.clear()
    mesh.data.materials.append(material)
    export_glb(MODEL, [rig, mesh])

    export_clip(rig, "dwarf-idle", "Idle")
    export_clip(rig, "mutant-run", "Run")


if __name__ == "__main__":
    main()
