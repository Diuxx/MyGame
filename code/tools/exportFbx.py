"""Convert a GLB to FBX without metallic or roughness texture maps."""

import argparse
from pathlib import Path
import sys

import bpy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Input GLB")
    parser.add_argument("output", type=Path, nargs="?", help="Output FBX (defaults to the input stem)")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    source = args.source.resolve()
    output = (args.output or source.with_suffix(".fbx")).resolve()
    if source.suffix.lower() != ".glb" or not source.is_file():
        parser.error(f"GLB introuvable ou invalide : {source}")
    if output.suffix.lower() != ".fbx":
        parser.error("Le fichier de sortie doit avoir l’extension .fbx.")
    if output.exists():
        parser.error(f"Le fichier de sortie existe déjà : {output}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    import_options = {"filepath": str(source)}
    if "disable_bone_shape" in bpy.ops.import_scene.gltf.get_rna_type().properties:
        # The FBX exporter would include the glTF importer's bone display mesh.
        import_options["disable_bone_shape"] = True
    if "FINISHED" not in bpy.ops.import_scene.gltf(**import_options):
        raise RuntimeError(f"Échec de l’import GLB : {source}")

    for material in bpy.data.materials:
        tree = material.node_tree
        if tree is None:
            continue
        for node in tree.nodes:
            if node.type != "BSDF_PRINCIPLED":
                continue
            for channel in ("Metallic", "Roughness"):
                for link in list(node.inputs[channel].links):
                    tree.links.remove(link)

    output.parent.mkdir(parents=True, exist_ok=True)
    if "FINISHED" not in bpy.ops.export_scene.fbx(
        filepath=str(output),
        path_mode="COPY",
        embed_textures=True,
        add_leaf_bones=False,
    ):
        raise RuntimeError(f"Échec de l’export FBX : {output}")
    print(f"FBX exporté : {output}")


if __name__ == "__main__":
    main()
