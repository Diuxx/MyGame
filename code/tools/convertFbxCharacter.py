"""Convert a skinned character FBX to a static GLB without its animations."""

import argparse
from pathlib import Path
import sys

import bpy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Input FBX")
    parser.add_argument("output", type=Path, nargs="?", help="Output GLB")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    source = args.source.resolve()
    output = (args.output or source.with_suffix(".glb")).resolve()
    if source.suffix.lower() != ".fbx" or not source.is_file():
        parser.error(f"FBX introuvable ou invalide : {source}")
    if output.suffix.lower() != ".glb":
        parser.error("Le fichier de sortie doit avoir l’extension .glb.")
    if output.exists():
        parser.error(f"Le fichier de sortie existe déjà : {output}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    if "FINISHED" not in bpy.ops.import_scene.fbx(filepath=str(source)):
        raise RuntimeError(f"Échec de l’import FBX : {source}")
    rigs = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(rigs) != 1 or not meshes:
        raise RuntimeError("Le FBX doit contenir une armature et au moins un maillage.")
    rig = rigs[0]
    skinned_meshes = [
        mesh for mesh in meshes
        if any(modifier.type == "ARMATURE" and modifier.object == rig for modifier in mesh.modifiers)
    ]
    if len(skinned_meshes) != len(meshes):
        raise RuntimeError("Chaque maillage exporté doit être déformé par l’armature importée.")
    if not any(bone.name in ("Hips", "mixamorig:Hips") for bone in rig.data.bones):
        raise RuntimeError("Le squelette ne contient pas de bassin Hips compatible.")

    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = rig
    output.parent.mkdir(parents=True, exist_ok=True)
    if "FINISHED" not in bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_skins=True,
        export_image_format="AUTO",
        export_materials="EXPORT",
        export_yup=True,
    ):
        raise RuntimeError(f"Échec de l’export GLB : {output}")
    print(f"Personnage exporté : {output}")


if __name__ == "__main__":
    main()
