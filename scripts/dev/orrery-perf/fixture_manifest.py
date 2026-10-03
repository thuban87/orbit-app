#!/usr/bin/env python3
"""Orrery perf fixture manifest: record at the baseline, compare before every later run.

38.7 Plan 01 (D-56 "same data as the baseline", cycle-2 C-M5). What it reads:
the app's SQLite database and the seeded contacts' photo files, pulled from the
DEBUG build with `run-as com.bwales.orbit` (release builds are not run-as
debuggable). The database is copied with its -wal and -shm files and opened
read-only, so un-checkpointed WAL frames are seen.

Recorded:
  - total contacts (all rows and non-archived);
  - per custom System: its sorted member names, resolved from the same tables
    the System definition uses (include/exclude overrides over live, Bound
    contacts; the seeded Systems have no rules — any rule rows are recorded
    raw and flagged);
  - per seeded contact (the spec's cast in "Size 120", stress in "Orrery
    Stress"): interval, rarely-responds, last_contact, days since last contact
    as of --as-of, and its offset against the spec; the common offsetDays;
  - per seeded photo: presence, byte size, pixel dimensions (JPEG/PNG/WebP
    header) and SHA-256 (derivative caches under cache/orrery-photo are not
    part of the fixture and are not read);
  - SEED_SPEC_VERSION from src/__dev__/orrery-seed-spec.ts at the measured
    commit, plus that commit;
  - the persistent Orrery inputs: orrery_density, orrery_satellites_enabled,
    orrery_last_system (a custom ref as its System name), sun_contact_id (as a
    contact name or null), and the seeded contacts' ring order in the order
    listOrbitingContacts uses (src/db/orrery-read.ts:
    WHERE archived_at IS NULL AND tracking_enabled = 1 AND last_contact IS NOT NULL
    [AND id <> sun] ORDER BY COALESCE(ring_seq, 1e9), created_at, id) and its SHA-256.

Usage:
  fixture_manifest.py --model "Pixel 6 Pro" --record --as-of 2026-10-04 --out baseline-manifest.json
  fixture_manifest.py --model "Pixel 6 Pro" --compare baseline-manifest.json --as-of 2026-10-20 [--out now.json]
`--compare` prints every difference and exits 1 on any difference in contact
count, membership, status inputs, photo presence/dimensions/hash, spec version,
the four settings, or the ring order hash. Offline: --db/--files-dir/--spec-json.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import json
import os
import re
import shutil
import sqlite3
import struct
import subprocess
import sys
import tarfile
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adb_device  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SPEC_FILE = os.path.join(REPO, "src", "__dev__", "orrery-seed-spec.ts")
DB_REMOTE = "files/SQLite/orbit.db"
SEEDED_SYSTEMS = {"cast": "Size 120", "stress": "Orrery Stress"}


# --- Spec ---------------------------------------------------------------------
def spec_version(spec_file: str = SPEC_FILE) -> str | None:
    match = re.search(r'SEED_SPEC_VERSION\s*=\s*"([0-9a-f]+)"', open(spec_file, encoding="utf-8").read())
    return match.group(1) if match else None


def load_spec(spec_json: str | None = None) -> dict:
    """The seed plan as JSON: from a file, or evaluated from the TS spec via tsx."""
    if spec_json:
        return json.load(open(spec_json, encoding="utf-8"))
    script = (
        "import('./src/__dev__/orrery-seed-spec.ts').then((m) => { const s = m.default ?? m;"
        " process.stdout.write(JSON.stringify(s.buildOrrerySeedPlan())); })"
    )
    out = subprocess.run(["npx", "tsx", "-e", script], cwd=REPO, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


# --- Image headers ------------------------------------------------------------
def image_size(data: bytes) -> tuple[int, int] | None:
    """(width, height) from a JPEG SOF, PNG IHDR or WebP VP8/VP8L/VP8X header."""
    if data[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                i += 2
                continue
            length = struct.unpack(">H", data[i + 2:i + 4])[0]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                height, width = struct.unpack(">HH", data[i + 5:i + 9])
                return width, height
            i += 2 + length
        return None
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        chunk = data[12:16]
        if chunk == b"VP8 ":
            w, h = struct.unpack("<HH", data[26:30])
            return w & 0x3FFF, h & 0x3FFF
        if chunk == b"VP8L":
            b = data[21:25]
            return 1 + (((b[1] & 0x3F) << 8) | b[0]), 1 + (((b[3] & 0xF) << 10) | (b[2] << 2) | ((b[1] & 0xC0) >> 6))
        if chunk == b"VP8X":
            return 1 + int.from_bytes(data[24:27], "little"), 1 + int.from_bytes(data[27:30], "little")
    return None


# --- Manifest -----------------------------------------------------------------
def _days_between(stored: str, as_of: str) -> int:
    return (dt.date.fromisoformat(as_of) - dt.date.fromisoformat(stored[:10])).days


def custom_members(db: sqlite3.Connection) -> dict[str, dict]:
    systems = {}
    for sid, uid, name in db.execute("SELECT id, uid, name FROM systems ORDER BY name"):
        ref = f"custom:{uid}"
        include = list(db.execute(
            """SELECT c.id, c.name FROM system_overrides o JOIN contacts c ON c.id = o.contact_id
                WHERE o.system_ref = ? AND o.mode = 'include'
                  AND c.archived_at IS NULL AND c.tracking_enabled = 1""", (ref,)))
        exclude = {r[0] for r in db.execute(
            "SELECT contact_id FROM system_overrides WHERE system_ref = ? AND mode = 'exclude'", (ref,))}
        rules = [list(r) for r in db.execute(
            "SELECT family, value FROM system_rules WHERE system_id = ? ORDER BY id", (sid,))]
        kept = [(cid, n) for cid, n in include if cid not in exclude]
        systems[name] = {"uid": uid, "members": sorted(n for _, n in kept),
                         "member_ids": {cid for cid, _ in kept},
                         "rules": rules, "rules_unresolved": bool(rules)}
    return systems


def build_manifest(db_path: str, files_dir: str, plan: dict, as_of: str, version: str | None) -> dict:
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    systems = custom_members(db)
    contacts = {row[0]: row for row in db.execute(
        "SELECT id, name, interval_days, rarely_responds, last_contact, photo, archived_at FROM contacts")}
    by_name: dict[str, list[int]] = {}
    for cid, row in contacts.items():
        by_name.setdefault(row[1], []).append(cid)
    settings = db.execute(
        "SELECT orrery_density, orrery_satellites_enabled, orrery_last_system, sun_contact_id FROM app_settings WHERE id = 1"
    ).fetchone()
    uid_to_name = {v["uid"]: k for k, v in systems.items()}

    seeded, photos, offsets, problems, seeded_ids = {}, {}, {}, [], set()
    for part, system_name in SEEDED_SYSTEMS.items():
        member_ids = systems.get(system_name, {}).get("member_ids", set())
        for spec in plan[part]:
            ids = [cid for cid in by_name.get(spec["name"], []) if cid in member_ids]
            if len(ids) != 1:
                problems.append(f"{spec['name']}: {len(ids)} matching contacts in {system_name}")
                continue
            _, name, interval, rarely, last, photo, _ = contacts[ids[0]]
            seeded_ids.add(ids[0])
            days = _days_between(last, as_of) if last else None
            offset = days - spec["days"] if days is not None and spec["days"] is not None else None
            seeded[name] = {"part": part, "interval": interval, "rarely_responds": rarely,
                            "last_contact": last, "days_since": days, "offset": offset}
            if offset is not None:
                offsets[offset] = offsets.get(offset, 0) + 1
            entry = {"present": photo is not None}
            if photo:
                path = os.path.join(files_dir, photo)
                if os.path.exists(path):
                    data = open(path, "rb").read()
                    size = image_size(data)
                    entry.update({"bytes": len(data), "width": size[0] if size else None,
                                  "height": size[1] if size else None,
                                  "sha256": hashlib.sha256(data).hexdigest()})
                else:
                    entry["file"] = "missing"
            photos[name] = entry
    common = max(offsets, key=offsets.get) if offsets else None

    density, satellites, last_system, sun = settings
    last_name = last_system
    if last_system and last_system.startswith("custom:"):
        last_name = uid_to_name.get(last_system[len("custom:"):], f"<unknown {last_system}>")
    params: list = []
    where = "archived_at IS NULL AND tracking_enabled = 1 AND last_contact IS NOT NULL"
    if sun is not None:
        where += " AND id <> ?"
        params.append(sun)
    order = list(db.execute(
        f"SELECT id, name FROM contacts WHERE {where} ORDER BY COALESCE(ring_seq, 1e9), created_at, id", params))
    ring = [name for cid, name in order if cid in seeded_ids]
    db.close()
    return {
        "as_of": as_of,
        "spec_version": version,
        "contacts_total": len(contacts),
        "contacts_live": sum(1 for r in contacts.values() if r[6] is None),
        "systems": {k: v["members"] for k, v in systems.items()},
        "system_rules": {k: v["rules"] for k, v in systems.items() if v["rules"]},
        "seeded": seeded,
        "offset_days": common,
        "photos": photos,
        "settings": {
            "orrery_density": density,
            "orrery_satellites_enabled": satellites,
            "orrery_last_system": last_name,
            "sun_contact": contacts[sun][1] if sun in contacts else None,
        },
        "ring_order": ring,
        "ring_order_sha256": hashlib.sha256("\n".join(ring).encode()).hexdigest(),
        "problems": problems,
    }


def compare(baseline: dict, current: dict) -> list[str]:
    diffs = []

    def check(label: str, a, b) -> None:
        if a != b:
            diffs.append(f"{label}: baseline={a!r} now={b!r}")

    check("spec_version", baseline["spec_version"], current["spec_version"])
    check("contacts_total", baseline["contacts_total"], current["contacts_total"])
    check("contacts_live", baseline["contacts_live"], current["contacts_live"])
    for name in sorted(set(baseline["systems"]) | set(current["systems"])):
        a, b = baseline["systems"].get(name), current["systems"].get(name)
        if a != b:
            missing = sorted(set(a or []) - set(b or []))
            extra = sorted(set(b or []) - set(a or []))
            diffs.append(f"System {name}: missing={missing} extra={extra}")
    check("offset_days", baseline["offset_days"], current["offset_days"])
    for name in sorted(set(baseline["seeded"]) | set(current["seeded"])):
        a, b = baseline["seeded"].get(name), current["seeded"].get(name)
        if a is None or b is None:
            diffs.append(f"seeded {name}: baseline={a is not None} now={b is not None}")
            continue
        for key in ("interval", "rarely_responds", "days_since"):
            check(f"seeded {name} {key}", a[key], b[key])
    for name in sorted(set(baseline["photos"]) | set(current["photos"])):
        check(f"photo {name}", baseline["photos"].get(name), current["photos"].get(name))
    for key in sorted(baseline["settings"]):
        check(f"setting {key}", baseline["settings"][key], current["settings"].get(key))
    check("ring_order_sha256", baseline["ring_order_sha256"], current["ring_order_sha256"])
    return diffs


# --- Device pull --------------------------------------------------------------
def pull(serial: str, workdir: str) -> tuple[str, str]:
    """Copy orbit.db (+ -wal/-shm) and files/avatars out of the debug build."""
    db_dir = os.path.join(workdir, "db")
    os.makedirs(db_dir, exist_ok=True)
    for suffix in ("", "-wal", "-shm"):
        data = adb_device.adb_bytes(
            serial, "exec-out", f"run-as {adb_device.PACKAGE} sh -c 'cat {DB_REMOTE}{suffix} 2>/dev/null'"
        )
        if data or suffix == "":
            with open(os.path.join(db_dir, f"orbit.db{suffix}"), "wb") as handle:
                handle.write(data)
    archive = adb_device.adb_bytes(serial, "exec-out", f"run-as {adb_device.PACKAGE} tar -cf - -C files avatars")
    files_dir = os.path.join(workdir, "files")
    os.makedirs(files_dir, exist_ok=True)
    if archive:
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            tar.extractall(files_dir, filter="data")
    db_path = os.path.join(db_dir, "orbit.db")
    if os.path.getsize(db_path) == 0:
        raise adb_device.DeviceError("empty database copy: is a DEBUG build installed? (run-as needs one)")
    return db_path, files_dir


def git_head() -> str | None:
    out = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO, capture_output=True, text=True)
    return out.stdout.strip() or None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    adb_device.add_model_arg(parser)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--record", action="store_true")
    mode.add_argument("--compare", metavar="BASELINE_JSON")
    parser.add_argument("--as-of", required=True, help="local date YYYY-MM-DD of the measurement session")
    parser.add_argument("--out")
    parser.add_argument("--db", help="offline: a local orbit.db copy instead of pulling")
    parser.add_argument("--files-dir", help="offline: the local files dir holding avatars/")
    parser.add_argument("--spec-json", help="offline: the seed plan as JSON instead of evaluating the TS spec")
    args = parser.parse_args()
    workdir = tempfile.mkdtemp(prefix="orrery-manifest-")
    try:
        if args.db:
            db_path, files_dir = args.db, args.files_dir or os.path.dirname(args.db)
            serial = None
        else:
            serial = adb_device.resolve_serial(args.model)
            db_path, files_dir = pull(serial, workdir)
        manifest = build_manifest(db_path, files_dir, load_spec(args.spec_json), args.as_of, spec_version())
        manifest.update({"model": args.model, "commit": git_head(),
                         "android": adb_device.android_release(serial) if serial else None})
        if args.record:
            adb_device.write_json(args.out, manifest)
            return 1 if manifest["problems"] else 0
        baseline = json.load(open(args.compare, encoding="utf-8"))
        diffs = compare(baseline, manifest)
        if args.out:
            adb_device.write_json(args.out, {**manifest, "differences": diffs})
        for line in diffs:
            print(f"DIFF {line}")
        print(f"fixture compare: {'IDENTICAL' if not diffs else f'{len(diffs)} difference(s)'}")
        return 1 if diffs else 0
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
