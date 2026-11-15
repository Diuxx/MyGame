#!/usr/bin/env python3
"""Install the glTF subset of Quaternius Stylized Nature MegaKit into this project.

Uses only the Python standard library. Unpacks glTF, .bin and referenced textures,
keeping relative resource paths intact. Run from any working directory.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from zipfile import BadZipFile, ZipFile

DESTINATION = Path(__file__).resolve().parents[1] / "public/assets/models/nature-megakit"
SOURCE_FOLDER = "glTF/"
ALLOWED_SUFFIXES = {".gltf", ".bin", ".png", ".jpg", ".jpeg", ".webp"}
MAX_UNCOMPRESSED_BYTES = 180 * 1024 * 1024


def read_members(archive: ZipFile) -> dict[str, object]:
    members = {}
    total_size = 0
    for item in archive.infolist():
        if not item.filename.startswith(SOURCE_FOLDER) or item.is_dir():
            continue
        name = item.filename[len(SOURCE_FOLDER):]
        if not name or "/" in name or "\\" in name or Path(name).suffix.lower() not in ALLOWED_SUFFIXES:
            raise ValueError(f"Chemin glTF inattendu dans l'archive : {item.filename}")
        if name in members:
            raise ValueError(f"Fichier dupliqué : {name}")
        total_size += item.file_size
        if total_size > MAX_UNCOMPRESSED_BYTES:
            raise ValueError("Archive trop volumineuse pour l'import standard.")
        members[name] = item
    models = [name for name in members if name.endswith(".gltf")]
    if not models:
        raise ValueError("L'archive ne contient aucun fichier glTF dans le dossier glTF/.")
    return members


def validate_references(archive: ZipFile, members: dict[str, object]) -> None:
    for model in (name for name in members if name.endswith(".gltf")):
        document = json.loads(archive.read(members[model]))
        referenced = [
            item.get("uri", "")
            for group in ("buffers", "images")
            for item in document.get(group, [])
            if "uri" in item
        ]
        for reference in referenced:
            if not reference or reference not in members:
                raise ValueError(f"{model} référence un fichier absent ou externe : {reference}")


def install(archive_path: Path, destination: Path) -> int:
    if not archive_path.is_file():
        raise FileNotFoundError(f"Archive introuvable : {archive_path}")
    with ZipFile(archive_path) as archive:
        members = read_members(archive)
        validate_references(archive, members)
        destination.mkdir(parents=True, exist_ok=True)
        for name, item in members.items():
            # The files live in the same directory so glTF relative URIs resolve.
            (destination / name).write_bytes(archive.read(item))
        if "License_Standard.txt" in archive.namelist():
            (destination / "LICENSE.txt").write_bytes(archive.read("License_Standard.txt"))
    return sum(name.endswith(".gltf") for name in members)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="Stylized Nature MegaKit[Standard].zip")
    args = parser.parse_args()
    try:
        count = install(args.archive, DESTINATION)
    except (OSError, BadZipFile, ValueError, json.JSONDecodeError) as error:
        parser.exit(1, f"Import impossible : {error}\n")
    print(f"{count} modèles glTF installés avec leurs textures dans : {DESTINATION}")


if __name__ == "__main__":
    main()
