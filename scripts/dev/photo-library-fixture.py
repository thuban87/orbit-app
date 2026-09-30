#!/usr/bin/env python3
"""Photo-library backup fixture (38.6-07; dev-only, never shipped).

Builds a readable (plaintext) Orbit backup holding N synthetic contacts, each
with a distinct square photo master made from real photographs, so restore,
backup-size (D-20) and Orrery-memory (D-11) checks run against realistic bytes
instead of flat test images (research A5: flat images under-state sizes).

  python3 scripts/dev/photo-library-fixture.py --count 50 \
      --sources $HOME/orbit-art/38.6/device-pass/sources \
      --format webp --edge 1024 --uid-prefix fxwebp- \
      --modified-at "2026-09-01 00:00:00" --out fixture.json

Masters: N distinct squares from the source photos (varied centre crops,
horizontal flips and small rotations), resized to --edge (never upscaled past
the crop) and encoded as WebP at --quality (default round(MASTER_QUALITY*100),
read from src/services/photos/master-encode.ts) or JPEG at 75 (the legacy 512
master quality). The manifest mirrors `syntheticManifest`
(src/services/backup/__dev__/ingress-measure.ts): the same top-level keys and
contact row shape, with the format version read from src/backup/types.ts.
Validate the output with scripts/dev/validate-backup-fixture.ts.
"""

import argparse
import base64
import glob
import io
import json
import os
import re
import sys

from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LEGACY_JPEG_QUALITY = 75


def read_constant(rel_path, pattern, label):
    with open(os.path.join(REPO, rel_path), encoding="utf8") as handle:
        match = re.search(pattern, handle.read())
    if not match:
        sys.exit(f"could not read {label} from {rel_path}")
    return match.group(1)


def format_versions():
    types_path = "src/backup/types.ts"
    backup = int(
        read_constant(
            types_path, r"BACKUP_FORMAT_VERSION\s*=\s*(\d+)", "BACKUP_FORMAT_VERSION"
        )
    )
    envelope = int(
        read_constant(
            types_path,
            r"BACKUP_ENVELOPE_VERSION\s*=\s*(\d+)",
            "BACKUP_ENVELOPE_VERSION",
        )
    )
    return backup, envelope


def master_quality_percent():
    value = float(
        read_constant(
            "src/services/photos/master-encode.ts",
            r"MASTER_QUALITY\s*=\s*([0-9.]+)",
            "MASTER_QUALITY",
        )
    )
    return round(value * 100)


def load_sources(directory):
    paths = sorted(
        path
        for pattern in ("*.jpg", "*.jpeg", "*.png", "*.webp")
        for path in glob.glob(os.path.join(directory, pattern))
    )
    images = []
    for path in paths:
        image = Image.open(path).convert("RGB")
        if min(image.size) >= 256:
            images.append(image)
    if not images:
        sys.exit(f"no usable source photos (>=256 px) in {directory}")
    return images


def make_master(sources, index, edge):
    """A distinct square for this index: crop scale, offset, flip, rotation."""
    source = sources[index % len(sources)]
    variant = index // len(sources)
    width, height = source.size
    side = min(width, height)
    # Scale cycles 1.0 → 0.55 so repeated sources give different framing.
    scale = 1.0 - 0.09 * (variant % 6)
    crop = max(int(side * scale), 64)
    # Offset walks around the centre on a small spiral.
    step = (side - crop) // 2
    dx = [0, 1, -1, 1, -1, 0, 0][variant % 7]
    dy = [0, 1, 1, -1, -1, 1, -1][variant % 7]
    left = (width - crop) // 2 + dx * step // 2
    top = (height - crop) // 2 + dy * step // 2
    tile = source.crop((left, top, left + crop, top + crop))
    if variant % 2 == 1:
        tile = tile.transpose(Image.FLIP_LEFT_RIGHT)
    angle = [0, 3, -3, 6, -6][variant % 5]
    if angle:
        # Rotate, then trim the corners the rotation exposed.
        rotated = tile.rotate(angle, resample=Image.BICUBIC, expand=False)
        trim = int(crop * 0.06)
        tile = rotated.crop((trim, trim, crop - trim, crop - trim))
    target = min(edge, tile.size[0])  # never upscale
    return tile.resize((target, target), Image.LANCZOS)


def encode(image, fmt, quality):
    buffer = io.BytesIO()
    if fmt == "webp":
        image.save(buffer, "WEBP", quality=quality, method=4)
    else:
        image.save(buffer, "JPEG", quality=quality)
    return buffer.getvalue()


def build_manifest(args):
    backup_version, envelope_version = format_versions()
    sources = load_sources(args.sources)
    if args.format == "webp":
        quality = args.quality if args.quality is not None else master_quality_percent()
    else:
        quality = args.quality if args.quality is not None else LEGACY_JPEG_QUALITY
    stamp = args.modified_at
    contacts = []
    photo_bytes = 0
    for index in range(args.count):
        data = encode(make_master(sources, index, args.edge), args.format, quality)
        photo_bytes += len(data)
        contacts.append(
            {
                "uid": f"{args.uid_prefix}{index}",
                "name": f"Fixture {index}",
                "categoryUid": None,
                "trackingEnabled": 1,
                "intervalDays": 30,
                "socialBattery": None,
                "birthday": None,
                "photoBase64": base64.b64encode(data).decode("ascii"),
                "archivedAt": None,
                "snoozeUntil": None,
                "rarelyResponds": 0,
                "remindersOff": 0,
                "createdAt": stamp,
                "modifiedAt": stamp,
            }
        )
    manifest = {
        "backupFormatVersion": backup_version,
        "envelopeVersion": envelope_version,
        "metadata": {"exportedAt": stamp, "sqliteUserVersion": None},
        "appSettings": {"modifiedAt": stamp, "sunContactUid": None},
        "categories": [],
        "profile": None,
        "contacts": contacts,
        "contactMethods": [],
        "externalContactLinks": [],
        "contactMethodProvenance": [],
        "interactions": [],
        "events": [],
        "fuel": [],
        "contactLinks": [],
        "customFieldDefs": [],
        "customFieldValues": [],
        "memories": [],
        "relationships": [],
        "currentStateEntries": [],
        "customFieldValueHistory": [],
        "systems": [],
        "systemRules": [],
        "systemOverrides": [],
        "systemPrefs": [],
        "profileLayoutTemplates": [],
        "profileBackgroundTemplates": [],
        "aiConnections": [],
        "personalizationSections": [],
        "groupEvents": [],
        "profileContactPresentation": [],
        "profileCategoryPresentation": [],
        "tombstones": [],
    }
    return manifest, quality, photo_bytes


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--count", type=int, required=True)
    parser.add_argument("--sources", required=True, help="directory of source photos")
    parser.add_argument("--format", choices=("webp", "jpeg"), required=True)
    parser.add_argument("--edge", type=int, choices=(1024, 512), required=True)
    parser.add_argument("--quality", type=int, help="encoder quality 1-100")
    parser.add_argument("--uid-prefix", required=True)
    parser.add_argument(
        "--modified-at",
        required=True,
        help='"YYYY-MM-DD HH:MM:SS" for createdAt/modifiedAt and metadata.exportedAt',
    )
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", args.modified_at):
        sys.exit("--modified-at must be YYYY-MM-DD HH:MM:SS")
    manifest, quality, photo_bytes = build_manifest(args)
    text = json.dumps(manifest, separators=(",", ":"))
    with open(args.out, "w", encoding="utf8") as handle:
        handle.write(text)
    print(
        json.dumps(
            {
                "out": args.out,
                "count": args.count,
                "format": args.format,
                "edge": args.edge,
                "quality": quality,
                "photoBytes": photo_bytes,
                "meanPhotoBytes": round(photo_bytes / max(args.count, 1)),
                "fileBytes": len(text.encode("utf8")),
            }
        )
    )


if __name__ == "__main__":
    main()
