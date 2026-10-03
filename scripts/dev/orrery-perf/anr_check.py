#!/usr/bin/env python3
"""ANR and main-thread jank log check (38.7 D-56 hard gate: no ANR).

What it reads: `am_anr` entries in the events log buffer (system_server records
one per Application Not Responding), and the app's own `Davey!` (a frame that
took > 700 ms on the UI thread / RenderThread path) and Choreographer
`Skipped N frames` (UI-thread stalls) lines from the main log buffer. These are
UI-thread signals; a stall confined to the JS thread does not appear here.

  anr_check.py --model "Pixel_3a" --mark --out mark.json
      clears the main and events buffers (`logcat -c`, `logcat -b events -c`;
      acceptable on a test phone, and recorded in the output)
  anr_check.py --model "Pixel_3a" --report [--mark-file mark.json] --out anr.json
      counts since the mark, plus the raw lines
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adb_device  # noqa: E402

SKIPPED_RE = re.compile(r"Skipped (\d+) frames")


def parse_events(events_text: str, package: str = adb_device.PACKAGE) -> dict:
    lines = [l for l in events_text.splitlines() if "am_anr" in l]
    ours = [l for l in lines if package in l]
    return {"am_anr_total": len(lines), "am_anr_app": len(ours), "am_anr_lines": lines}


def _pid_of(line: str) -> int | None:
    """threadtime format: date time PID TID level tag: message."""
    parts = line.split()
    return int(parts[2]) if len(parts) > 3 and parts[2].isdigit() else None


def parse_main(main_text: str, pid: int | None) -> dict:
    davey, skipped = [], []
    for line in main_text.splitlines():
        if pid is not None and _pid_of(line) not in (pid, None):
            continue
        if "Davey!" in line:
            davey.append(line)
        elif SKIPPED_RE.search(line):
            skipped.append(line)
    frames = [int(SKIPPED_RE.search(l).group(1)) for l in skipped]
    return {
        "app_pid": pid,
        "davey": len(davey),
        "skipped_reports": len(skipped),
        "skipped_frames_total": sum(frames),
        "skipped_frames_max": max(frames, default=0),
        "davey_lines": davey,
        "skipped_lines": skipped,
    }


def mark(serial: str) -> dict:
    adb_device.adb(serial, "logcat", "-c")
    adb_device.adb(serial, "logcat", "-b", "events", "-c")
    return {"marked_at_host": time.time(), "cleared_buffers": ["main", "events"],
            "note": "logcat buffers cleared on a test phone to mark the window"}


def report(serial: str, mark_info: dict | None) -> dict:
    events = adb_device.adb(serial, "logcat", "-b", "events", "-d")
    main = adb_device.adb(serial, "logcat", "-d", "-v", "threadtime")
    pid = adb_device.app_pid(serial)
    return {"mark": mark_info, **parse_events(events), **parse_main(main, pid)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    adb_device.add_model_arg(parser)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--mark", action="store_true")
    group.add_argument("--report", action="store_true")
    parser.add_argument("--mark-file")
    parser.add_argument("--out")
    args = parser.parse_args()
    serial = adb_device.resolve_serial(args.model)
    if args.mark:
        adb_device.write_json(args.out, {"model": args.model, **mark(serial)})
        return 0
    mark_info = json.load(open(args.mark_file, encoding="utf-8")) if args.mark_file else None
    result = report(serial, mark_info)
    adb_device.write_json(args.out, {"model": args.model, **result})
    return 1 if result["am_anr_app"] else 0


if __name__ == "__main__":
    sys.exit(main())
