#!/usr/bin/env python3
"""Re-analyse saved tab_return.py recordings with the current detector (no phone).

Used when the detector changes after recordings exist (runbook §10: a method change
requires re-measuring; re-analysing the identical raw recordings re-measures every
number that depends only on the detector). Reads <dir>/tab-return.json for the
regions, mode and recording paths; writes <dir>/tab-return.reanalysed.json and fresh
index-cut hand-check strips (<stem>-tfull-before/at/after.png).

  reanalyse_tab_return.py <dir> [<dir> ...]
"""
from __future__ import annotations

import json
import os
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tab_return  # noqa: E402


def reanalyse(directory: str) -> dict:
    with open(os.path.join(directory, "tab-return.json"), encoding="utf-8") as handle:
        original = json.load(handle)
    background = original.get("mode") == "background"
    runs = []
    for run in original["runs"]:
        mp4 = run["mp4"]
        frames, width, height, duration = tab_return.decode(mp4)
        duration = max(duration, float(tab_return.RECORD_LIMIT_S))  # recorder ran its full limit
        factor = width / original["regions"]["full"][2]
        scaled = {k: tab_return.scale(tuple(v), factor, width, height) for k, v in original["regions"].items()}
        result = tab_return.analyse_frames(frames, width, scaled, duration,
                                           tap_region="full" if background else "tab")
        result.pop("content", None)
        stem = os.path.splitext(os.path.basename(mp4))[0]
        if result.get("outcome") == "valid":
            k = result["k_full"]
            result["strip"] = tab_return.save_strip(mp4, [max(0, k - 1), k, min(len(frames) - 1, k + 1)],
                                                    directory, stem)
            result["t_photos_context"] = tab_return.photo_probe_time(frames, width, scaled["canvas"], result["t_canvas"])
        runs.append({"mp4": mp4, "frames": len(frames), **result})
    totals = [r["total_s"] for r in runs if r.get("outcome") == "valid"]
    payload = {"source": "tab-return.json", "detector": "absolute fine-structure level (2026-10-03)",
               "mode": original.get("mode"), "runs": runs, "valid_runs": len(totals),
               "median_total_s": statistics.median(totals) if len(totals) == len(runs) else "insufficient"}
    with open(os.path.join(directory, "tab-return.reanalysed.json"), "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    return payload


def main() -> int:
    for directory in sys.argv[1:]:
        out = reanalyse(directory)
        print(directory, out["mode"], "median", out["median_total_s"],
              [(r.get("outcome"), r.get("total_s"), r.get("mount_s"), r.get("fill_s")) for r in out["runs"]])
    return 0


if __name__ == "__main__":
    sys.exit(main())
