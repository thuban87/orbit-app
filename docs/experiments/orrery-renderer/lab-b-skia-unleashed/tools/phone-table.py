#!/usr/bin/env python3
"""Phone-pass markdown table from r1-perf summary.tsv run with SF=1 OPAQUE=1.
Usage: phone-table.py <summary.tsv> [--probe]
Presented fps = SurfaceFlinger presents of the canvas layer / window length
(idle 10 s, pan ~10 s, focus 7 s, switch 9 s). gfx columns = HWUI (overlay views only
on the opaque canvas; main-thread blocking shows up there)."""
import re, sys

WIN = {"idle": 10.0, "pan": 10.0, "focus": 7.0, "switch_out": 9.0, "switch_in": 9.0}
KEYS = ["frame", "alloc", "bodies", "labels", "rings", "wakes", "trim", "nebula"]
rows = [l.split("\t") for l in open(sys.argv[1]).read().splitlines()[1:]]
probe = "--probe" in sys.argv


def pr(cell):
    out = {}
    for name, runs, mean, p95 in re.findall(r"(\w[\w.]*):(\d+)x([\d.]+)/p95 ([\d.]+)", cell or ""):
        out[name] = (int(runs), float(mean), float(p95))
    return out


if not probe:
    print("| config-bodies | scene | presents | fps | interval p50/p90/p99 ms | gfx frames (p50) | skipped max |")
    print("|---|---|---|---|---|---|---|")
    for c in rows:
        n = c[12] if len(c) > 12 else "-"
        fps = f"{int(n)/WIN.get(c[1],10):.1f}" if n not in ("-", "") else "-"
        iv = f"{c[14]}/{c[15]}/{c[16]}" if len(c) > 16 and c[14] != "-" else "–"
        print(f"| {c[0]} | {c[1]} | {n} | {fps} | {iv} | {c[2]} ({c[4]}) | {c[10]} |")
else:
    print("| config-bodies | scene | " + " | ".join(f"{k}" for k in KEYS) + " |")
    print("|---|---|" + "---|" * len(KEYS))
    for c in rows:
        p = pr(c[11] if len(c) > 11 else "")
        print(f"| {c[0]} | {c[1]} | " + " | ".join(f"{p[k][1]:.1f}/{p[k][2]:.1f}" if k in p else "–" for k in KEYS) + " |")
