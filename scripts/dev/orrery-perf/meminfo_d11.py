#!/usr/bin/env python3
"""The 38.6 D-11 memory method, scripted (38.7 D-58 / G7).

What it measures: process-level `dumpsys meminfo com.bwales.orbit` PSS figures
(KB) — not per-thread, not per-allocation. Rows, parsed exactly as 38.6's
d11run3.sh did: GL mtrack and EGL mtrack (Pss Total column of the table),
Graphics, Native Heap and TOTAL PSS (App Summary).

Fixed steps (38.6-DEVICE-PASS.md "D-11" and "D-41 re-measure"): force-stop;
cold launch; 18 s on the launch tab (Digest); dismiss the LogBox toast if
shown; tap the Orrery tab = T0; samples at T0+2 s (PEAK), T0+20 s (SETTLED)
and T0+70 s (LATE); no interaction in between. View: the Orrery's default view
of the System it opens on.

Modes:
  --t0-now                    T0 is now (invoke right after tapping the Orrery tab yourself)
  --run cold                  the full fixed steps above
  --run cold --pre-steps churn       from the cold start: 5 System-switch cycles
        (Size 5 -> Size 120 -> All Contacts) and 5 tab returns (Digest -> Orrery),
        ending on All Contacts; T0 = the last Orrery tab tap
  --run cold --pre-steps background  Orrery open, Home key, 30 s in the
        background, relaunch; T0 = the relaunch
  --summarise r1.json r2.json r3.json [--reference ref-summary.json]
        per-sample medians in the 38.6 D-11 shape; with a reference, the
        JUDGED rows (Graphics and GL mtrack at peak, settled, late) get a % change
        and pass/fail against the <= 5 % limit; Native Heap, TOTAL PSS and EGL
        mtrack are reported only.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adb_device  # noqa: E402

SAMPLES = {"peak": 2.0, "settled": 20.0, "late": 70.0}
LAUNCH_WAIT_S = 18.0
LIMIT_PCT = 5.0
JUDGED = ("graphics", "gl_mtrack")
REPORTED = ("native_heap", "total_pss", "egl_mtrack")
CHURN_CYCLE = ("Size 5", "Size 120", "All Contacts")
CHURN_REPEATS = 5
BACKGROUND_S = 30.0


def parse_meminfo(text: str) -> dict:
    def table(label: str) -> int | None:
        match = re.search(rf"^\s*{label}\s+(\d+)", text, re.M)
        return int(match.group(1)) if match else None

    def summary(label: str) -> int | None:
        match = re.search(rf"{label}:\s+(\d+)", text)
        return int(match.group(1)) if match else None

    pid = re.search(r"MEMINFO in pid (\d+)", text)
    return {
        "pid": int(pid.group(1)) if pid else None,
        "gl_mtrack": table("GL mtrack"),
        "egl_mtrack": table("EGL mtrack"),
        "graphics": summary("Graphics"),
        "native_heap": summary("Native Heap"),
        "total_pss": summary("TOTAL PSS"),
    }


def sample_from(serial: str, t0_host: float, out_dir: str | None) -> dict:
    samples = {}
    for name, at in SAMPLES.items():
        time.sleep(max(0.0, at - (time.monotonic() - t0_host)))
        started = time.monotonic() - t0_host
        text = adb_device.shell(serial, f"dumpsys meminfo {adb_device.PACKAGE}")
        samples[name] = {"started_s": round(started, 2),
                         "finished_s": round(time.monotonic() - t0_host, 2), **parse_meminfo(text)}
        if out_dir:
            with open(os.path.join(out_dir, f"meminfo-{name}.txt"), "w", encoding="utf-8") as handle:
                handle.write(text)
    return samples


def cold_start(serial: str) -> None:
    adb_device.shell(serial, f"am force-stop {adb_device.PACKAGE}")
    time.sleep(2)
    adb_device.shell(serial, f"monkey -p {adb_device.PACKAGE} -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1")
    time.sleep(LAUNCH_WAIT_S)
    adb_device.dismiss_logbox(serial)


def run(serial: str, pre_steps: str | None, out_dir: str | None) -> dict:
    cold_start(serial)
    steps: list[str] = []
    # Before T0, every Orrery tab tap is followed by a still-screen wait so that no UI
    # dump runs while a scene loads (adb_device.A11Y_QUIET_S). T0 sampling is unchanged.
    if pre_steps == "churn":
        adb_device.tap_tab(serial, "Orrery")
        adb_device.wait_screen_still(serial)
        time.sleep(4)
        for _ in range(CHURN_REPEATS):
            for system in CHURN_CYCLE:
                adb_device.select_system(serial, system)
                steps.append(f"switch:{system}")
                time.sleep(4)
        for i in range(CHURN_REPEATS):
            adb_device.tap_tab(serial, "Digest")
            time.sleep(3)
            if i < CHURN_REPEATS - 1:
                adb_device.tap_tab(serial, "Orrery")
                steps.append("tab-return")
                adb_device.wait_screen_still(serial)
                time.sleep(4)
        t0 = adb_device.tap_tab(serial, "Orrery")
        steps.append("tab-return (T0)")
    elif pre_steps == "background":
        adb_device.tap_tab(serial, "Orrery")
        adb_device.wait_screen_still(serial)
        time.sleep(4)
        adb_device.shell(serial, "input keyevent KEYCODE_HOME")
        steps.append("home")
        time.sleep(BACKGROUND_S)
        t0 = time.monotonic()
        adb_device.shell(serial, f"monkey -p {adb_device.PACKAGE} -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1")
        steps.append("relaunch (T0)")
    else:
        t0 = adb_device.tap_tab(serial, "Orrery")
        steps.append("orrery tab (T0)")
    return {"pre_steps": pre_steps or "none", "steps": steps, "samples": sample_from(serial, t0, out_dir)}


def summarise(runs: list[dict], reference: dict | None = None) -> dict:
    """Per-sample medians across runs; % change and the <= 5 % judgement vs a reference summary."""
    medians: dict[str, dict] = {}
    for sample in SAMPLES:
        medians[sample] = {}
        for row in JUDGED + REPORTED:
            values = [r["samples"][sample][row] for r in runs if r["samples"][sample].get(row) is not None]
            medians[sample][row] = statistics.median(values) if values else None
    out: dict = {"runs": len(runs), "medians": medians}
    if reference:
        judged, reported = [], []
        for sample in SAMPLES:
            for row in JUDGED + REPORTED:
                base = reference["medians"][sample].get(row)
                now = medians[sample].get(row)
                change = round(100.0 * (now - base) / base, 1) if base and now is not None else None
                entry = {"metric": row, "sample": sample, "reference": base, "candidate": now, "change_pct": change}
                if row in JUDGED:
                    entry["pass"] = change is not None and change <= LIMIT_PCT
                    judged.append(entry)
                else:
                    reported.append(entry)
        out.update({"limit_pct": LIMIT_PCT, "judged": judged, "reported": reported,
                    "pass": all(e["pass"] for e in judged)})
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    adb_device.add_model_arg(parser)
    parser.add_argument("--t0-now", action="store_true")
    parser.add_argument("--run", choices=["cold"])
    parser.add_argument("--pre-steps", choices=["churn", "background"])
    parser.add_argument("--summarise", nargs="+", metavar="RUN_JSON")
    parser.add_argument("--reference", help="a --summarise output to compare against")
    parser.add_argument("--raw-dir", help="also save each raw dumpsys here")
    parser.add_argument("--out")
    args = parser.parse_args()
    if args.summarise:
        runs = [json.load(open(p, encoding="utf-8")) for p in args.summarise]
        reference = json.load(open(args.reference, encoding="utf-8")) if args.reference else None
        result = {"model": args.model, **summarise(runs, reference)}
        adb_device.write_json(args.out, result)
        return 0 if result.get("pass", True) else 1
    serial = adb_device.resolve_serial(args.model)
    if args.raw_dir:
        os.makedirs(args.raw_dir, exist_ok=True)
    if args.t0_now:
        result = {"pre_steps": "manual", "samples": sample_from(serial, time.monotonic(), args.raw_dir)}
    elif args.run:
        result = run(serial, args.pre_steps, args.raw_dir)
    else:
        parser.error("one of --t0-now, --run or --summarise is required")
    adb_device.write_json(args.out, {"model": args.model, **result})
    return 0


if __name__ == "__main__":
    sys.exit(main())
