#!/usr/bin/env python3
"""Markdown tables from r1-perf summary.tsv files (R1).
Usage: r1-table.py <summary.tsv> [<summary2.tsv> ...]   (rows tagged by file dir name)"""
import re
import sys

KEYS = ["frame", "alloc", "bodies", "labels", "rings", "wakes", "trim"]


def probe(cell):
    out = {}
    for name, runs, mean, p95 in re.findall(r"(\w[\w.]*):(\d+)x([\d.]+)/p95 ([\d.]+)", cell or ""):
        out[name] = (int(runs), float(mean), float(p95))
    return out


print("| build | label | scenario | frames | janky | p50 | p90 | p99 | gpu p50 | skipped | " + " | ".join(f"{k} mean/p95 ms" for k in KEYS) + " |")
print("|" + "---|" * (10 + len(KEYS)))
for path in sys.argv[1:]:
    build = path.split("/")[-2]
    for line in open(path).read().splitlines()[1:]:
        c = line.split("\t")
        if len(c) < 11:
            continue
        p = probe(c[11] if len(c) > 11 else "")
        cells = [f"{p[k][1]:.1f}/{p[k][2]:.1f}" if k in p else "–" for k in KEYS]
        print(f"| {build} | {c[0]} | {c[1]} | {c[2]} | {c[3]} | {c[4]} | {c[5]} | {c[7]} | {c[8]} | {c[10]} | " + " | ".join(cells) + " |")
