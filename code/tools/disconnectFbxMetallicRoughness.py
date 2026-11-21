"""Re-export an FBX after disconnecting Metallic and Roughness shader inputs."""

import argparse
from pathlib import Path
import sys

import bpy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="FBX source")
    parser.add_argument("output", type=Path, nargs="?", help="Output FBX")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    source = args.source.resolve()
    output = (args.output or source.with_name(
        source.stem + "-no-metallic-roughness.fbx"
    )).resolve()
    if source.suffix.lower() != ".fbx" or not source.is_file():
        parser.error(f"FBX source introuvable ou invalide : {source}")
    if output.suffix.lower() != ".fbx":
        parser.error("Le fichier de sortie doit avoir l’extension .fbx.")
    if output == source:
        parser.error("La sortie doit être différente du fichier source.")
    if output.exists():
        parser.error(f"Le fichier de sortie existe déjà : {output}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    if "FINISHED" not in bpy.ops.import_scene.fbx(filepath=str(source)):
        raise RuntimeError(f"Échec de l’import FBX : {source}")
    objects = list(bpy.context.scene.objects)
    if not objects:
        raise RuntimeError(f"Aucun objet importé depuis le FBX : {source}")

    disconnected = {"Metallic": 0, "Roughness": 0}
    for material in bpy.data.materials:
        tree = material.node_tree
        if tree is None:
            continue
        for node in tree.nodes:
            if node.type != "BSDF_PRINCIPLED":
                continue
            for channel, count in disconnected.items():
                socket = node.inputs.get(channel)
                if socket is None:
                    continue
                links = list(socket.links)
                for link in links:
                    tree.links.remove(link)
                disconnected[channel] += len(links)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next(
        (obj for obj in objects if obj.type == "ARMATURE"),
        objects[0],
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    if "FINISHED" not in bpy.ops.export_scene.fbx(
        filepath=str(output),
        use_selection=True,
        path_mode="COPY",
        embed_textures=True,
        add_leaf_bones=False,
    ):
        raise RuntimeError(f"Échec de l’export FBX : {output}")
    if not output.is_file() or output.stat().st_size == 0:
        raise RuntimeError(f"L’export FBX n’a pas produit de fichier valide : {output}")

    print(f"FBX exporté : {output}")
    print("Liens déconnectés — Metallic : {}, Roughness : {}".format(
        disconnected["Metallic"], disconnected["Roughness"],
    ))


if __name__ == "__main__":
    main()
