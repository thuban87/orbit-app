#!/usr/bin/env python3
"""Per-thread CPU of the Orbit process over a window (38.7 D-40/D-56).

What it measures: for every thread of `com.bwales.orbit`, (utime + stime) ticks
from /proc/<pid>/task/<tid>/stat at the start and end of `--seconds`, as % of ONE
core (100 % = one core busy for the whole window). The process main thread is
the Android UI thread (tid == pid); RenderThread is the HWUI render thread;
`mqt_v_js` / `mqt_js` is the React Native JS thread; `hades`/HeapTaskDaemon/GC
threads are garbage collection. Skia work on a SurfaceView canvas lands on the
UI thread or RenderThread depending on the renderer, so both are reported.
The denominator is the device's own /proc/uptime delta, ticks are converted
with the device's CLK_TCK (`getconf CLK_TCK`).

Usage: thread_cpu.py --model "Pixel 6 Pro" --seconds 75 [--out cpu.json]
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adb_device  # noqa: E402

JS_THREADS = ("mqt_v_js", "mqt_js")
GC_PATTERN = re.compile(r"hades|HeapTaskDaemon|GC", re.IGNORECASE)


def parse_stat(line: str) -> tuple[int, str, int] | None:
    """(tid, comm, utime+stime ticks) from one `<tid> <stat contents>` line.

    comm sits in parentheses and may contain spaces, so fields are split after
    the LAST ')': field 3 (state) is index 0 there, utime (14) index 11, stime
    (15) index 12.
    """
    line = line.strip()
    match = re.match(r"^(\d+)\s+\d+\s+\((.*)\)\s+(.*)$", line)
    if not match:
        return None
    tid, comm, rest = int(match.group(1)), match.group(2), match.group(3).split()
    if len(rest) < 13:
        return None
    return tid, comm, int(rest[11]) + int(rest[12])


def parse_snapshot(text: str) -> dict:
    """First line: /proc/uptime; then one `<tid> <stat>` line per thread."""
    lines = [l for l in text.splitlines() if l.strip()]
    uptime = float(lines[0].split()[0])
    threads = {}
    for line in lines[1:]:
        parsed = parse_stat(line)
        if parsed:
            tid, comm, ticks = parsed
            threads[tid] = {"comm": comm, "ticks": ticks}
    return {"uptime_s": uptime, "threads": threads}


def compute(first: dict, second: dict, clk_tck: int, pid: int) -> dict:
    elapsed = second["uptime_s"] - first["uptime_s"]
    rows = []
    for tid, thread in second["threads"].items():
        if tid not in first["threads"]:
            continue
        delta = thread["ticks"] - first["threads"][tid]["ticks"]
        pct = 100.0 * delta / clk_tck / elapsed if elapsed > 0 else 0.0
        rows.append({"tid": tid, "comm": thread["comm"], "cpu_pct": round(pct, 2)})
    rows.sort(key=lambda r: r["cpu_pct"], reverse=True)

    def pick(predicate) -> float:
        return round(sum(r["cpu_pct"] for r in rows if predicate(r)), 2)

    return {
        "window_s": round(elapsed, 2),
        "clk_tck": clk_tck,
        "main_ui": pick(lambda r: r["tid"] == pid),
        "render_thread": pick(lambda r: r["comm"] == "RenderThread"),
        "js": pick(lambda r: r["comm"] in JS_THREADS),
        "gc": pick(lambda r: bool(GC_PATTERN.search(r["comm"]))),
        "total": pick(lambda r: True),
        "threads": rows,
    }


def snapshot(serial: str, pid: int) -> dict:
    command = (
        "cat /proc/uptime; for t in /proc/%d/task/*; do "
        'echo "${t##*/} $(cat $t/stat 2>/dev/null)"; done' % pid
    )
    return parse_snapshot(adb_device.shell(serial, command))


def sample(serial: str, seconds: float, pid: int | None = None) -> dict:
    pid = pid or adb_device.app_pid(serial)
    if not pid:
        raise adb_device.DeviceError(f"{adb_device.PACKAGE} is not running")
    clk = int(adb_device.shell(serial, "getconf CLK_TCK").strip() or 100)
    first = snapshot(serial, pid)
    time.sleep(seconds)
    second = snapshot(serial, pid)
    return {"pid": pid, **compute(first, second, clk, pid)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    adb_device.add_model_arg(parser)
    parser.add_argument("--seconds", type=float, required=True)
    parser.add_argument("--out")
    args = parser.parse_args()
    serial = adb_device.resolve_serial(args.model)
    adb_device.write_json(args.out, {"model": args.model, **sample(serial, args.seconds)})
    return 0


if __name__ == "__main__":
    sys.exit(main())
