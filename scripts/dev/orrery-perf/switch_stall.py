#!/usr/bin/env python3
"""System-switch stall and Choose System ANR check (38.7 D-56 hard gates).

What it measures: the longest wait between consecutive SurfaceFlinger presents
of the Orrery canvas layer (sf_sampler.py; compositor side) inside
[row tap, row tap + 2.6 s] — the 2100 ms switch plus margin — and the presents
in that window. A gap is a frame the compositor never received: it does not say
which app thread stalled (thread_cpu.py does that). Gate: no gap over 100 ms on
the Pixel 6 Pro or over 150 ms on the Pixel 3a. Each run also reports
anr_check.py counts (am_anr, Davey!, Skipped frames) since that run's mark.

The script switches Systems itself through the selector (button by its
accessibility label with `input touchscreen tap`, the row by its label with
plain `input tap`), with the sampler started at least 1 s before the row tap,
and alternates direction each run (--from -> --to, then back, ...).

  switch_stall.py --model "Pixel 6 Pro" --from "Size 5" --to "Size 120" --runs 3 --out s.json
  switch_stall.py --model "Pixel_3a" --open-selector 3 --out open.json   # Choose System open x3 + ANR
"""
from __future__ import annotations

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adb_device  # noqa: E402
import anr_check  # noqa: E402
import sf_sampler  # noqa: E402

WINDOW_S = 2.6
PRE_TAP_S = 1.0
SETTLE_S = 4.0


def score_switch(presents: list[int], tap_ns: int, window_s: float = WINDOW_S) -> dict:
    """Max inter-present gap and present count in [tap, tap + window)."""
    end = tap_ns + int(window_s * 1e9)
    gap = sf_sampler.max_gap_ms(presents, tap_ns, end)
    if gap is None:
        return {"outcome": "no-present", "max_gap_ms": None, "presents": 0}
    return {"outcome": "valid", "max_gap_ms": gap,
            "presents": len(sf_sampler.presents_in(presents, tap_ns, end)),
            "intervals_ms": sf_sampler.interval_stats(sf_sampler.presents_in(presents, tap_ns, end))}


def one_switch(serial: str, layer: dict, clock: adb_device.ClockMap, src: str, dst: str) -> dict:
    adb_device.select_system(serial, src)
    time.sleep(SETTLE_S)
    anr_check.mark(serial)
    sampler = sf_sampler.Sampler(serial, layer, clock).start()
    time.sleep(PRE_TAP_S)
    tapped = adb_device.select_system(serial, dst)
    if tapped is None:
        sampler.stop()
        raise adb_device.DeviceError(f"{dst} was already current; nothing switched")
    tap_ns = clock.device_ns(tapped)
    time.sleep(WINDOW_S + 0.5)
    sampler.stop()
    sf = sampler.result()
    covered = sf["first_poll_ns"] is not None and sf["first_poll_ns"] <= tap_ns and \
        sf["last_poll_ns"] >= tap_ns + int(WINDOW_S * 1e9) and \
        not sf_sampler.holes_overlapping(sf["holes"], tap_ns, tap_ns + int(WINDOW_S * 1e9))
    score = score_switch(sf["presents"], tap_ns) if covered else {"outcome": "truncated", "max_gap_ms": None}
    anr = anr_check.report(serial, None)
    return {"from": src, "to": dst, "tap_ns": tap_ns, "clock_uncertainty_ms": clock.uncertainty_ms, **score,
            "anr": {k: anr[k] for k in ("am_anr_app", "am_anr_total", "davey", "skipped_reports", "skipped_frames_max")}}


def open_selector(serial: str, times: int) -> dict:
    anr_check.mark(serial)
    opened = []
    for _ in range(times):
        nodes = adb_device.ui_dump(serial)
        adb_device.dismiss_logbox(serial, nodes)
        button = adb_device.find(nodes, desc_prefix=adb_device.SELECTOR_PREFIX)
        if not button:
            raise adb_device.DeviceError("System selector button not found")
        t0 = time.monotonic()
        adb_device.tap(serial, button, touchscreen=True)
        time.sleep(2.0)
        nodes = adb_device.ui_dump(serial)
        shown = adb_device.find(nodes, desc="Choose System") is not None
        opened.append({"sheet_shown": shown, "dump_s": round(time.monotonic() - t0, 2)})
        close = adb_device.find(nodes, desc="Close System selector")
        if close:
            adb_device.tap(serial, close, touchscreen=True)
        time.sleep(2.0)
    anr = anr_check.report(serial, None)
    return {"opens": opened, "anr": {k: anr[k] for k in
                                     ("am_anr_app", "am_anr_total", "davey", "skipped_reports", "skipped_frames_max",
                                      "am_anr_lines")}}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    adb_device.add_model_arg(parser)
    parser.add_argument("--from", dest="src")
    parser.add_argument("--to", dest="dst")
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--open-selector", type=int, metavar="TIMES")
    parser.add_argument("--out")
    args = parser.parse_args()
    serial = adb_device.resolve_serial(args.model)
    if args.open_selector:
        result = open_selector(serial, args.open_selector)
        adb_device.write_json(args.out, {"model": args.model, **result})
        return 1 if result["anr"]["am_anr_app"] else 0
    if not (args.src and args.dst):
        parser.error("--from and --to are required (or --open-selector)")
    layer = sf_sampler.resolve_layer(serial)
    clock = adb_device.ClockMap.anchor(serial)
    runs = []
    for k in range(args.runs):
        src, dst = (args.src, args.dst) if k % 2 == 0 else (args.dst, args.src)
        runs.append(one_switch(serial, layer, clock, src, dst))
    gaps = [r["max_gap_ms"] for r in runs if r["max_gap_ms"] is not None]
    adb_device.write_json(args.out, {"model": args.model, "layer": layer, "window_s": WINDOW_S, "runs": runs,
                                     "valid_runs": len(gaps), "max_gap_ms_worst": max(gaps) if gaps else None})
    return 0


if __name__ == "__main__":
    sys.exit(main())
