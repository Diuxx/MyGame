"""Convert one skeletal FBX animation to a standalone GLB clip."""

import argparse
from pathlib import Path
import re
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
    clip_name = re.sub(r"[^a-z0-9]+", "-", output.stem.lower()).strip("-")
    if not clip_name:
        parser.error("Le nom de sortie doit contenir au moins une lettre ASCII ou un chiffre.")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    if "FINISHED" not in bpy.ops.import_scene.fbx(filepath=str(source)):
        raise RuntimeError(f"Échec de l’import FBX : {source}")

    rigs = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if len(rigs) != 1 or len(bpy.data.actions) != 1:
        raise RuntimeError("Le FBX doit contenir une seule armature et une seule animation.")
    rig = rigs[0]
    animation = rig.animation_data
    if not animation or not animation.action:
        raise RuntimeError("L’armature ne porte aucune animation active.")

    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    output.parent.mkdir(parents=True, exist_ok=True)
    if "FINISHED" not in bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIVE_ACTIONS",
        export_nla_strips_merged_animation_name=clip_name,
    ):
        raise RuntimeError(f"Échec de l’export GLB : {output}")
    print(f"Clip {clip_name} exporté : {output}")


if __name__ == "__main__":
    main()
