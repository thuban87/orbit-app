#!/usr/bin/env python3
"""Recenter and adb-pan presents (38.7 D-56; runbook §6 rows 3 and 4), scripted.

What it measures: SurfaceFlinger presents of the Orrery canvas layer (sf_sampler.py;
compositor side, not any app thread).

  --recenter: pan away with `input swipe`, wait, start the sampler, 1 s later tap the
      "Recenter Orrery" control (`input touchscreen tap` on its bounds); judged value =
      median presents/s over [tap, tap + 2 s] (1-s bins).
  --adb-pan: the sampler runs while 5 `input swipe` pans run; value = median presents/s
      over [first swipe, last swipe end]. Injection-bound: a SECONDARY number, never a
      pan gate (adb cannot inject a pinch, and on main an `input swipe` shows no live
      frames until after the gesture; see 38.7-BASELINE.md "Tracer").
3 runs each; the median of the runs is reported. Control bounds come from one UI dump
taken before the runs (no dump near a scene load: adb_device.A11Y_QUIET_S).

  recenter_pan.py --model "Pixel 6 Pro" --recenter --runs 3 --out recenter.json
  recenter_pan.py --model "Pixel_3a" --adb-pan --runs 3 --out adb-pan.json
"""
from __future__ import annotations

import argparse
import os
import statistics
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adb_device  # noqa: E402
import sf_sampler  # noqa: E402

PRE_TAP_S = 1.0
RECENTER_WINDOW_S = 2.0
PAN_SWIPES = 5
SWIPE_MS = 600
BETWEEN_S = 0.6


def swipe(serial: str, screen: tuple[int, int], k: int) -> None:
    w, h = screen
    a = (w * 30 // 100, h * 55 // 100)
    b = (w * 70 // 100, h * 45 // 100)
    x0, y0, x1, y1 = (*a, *b) if k % 2 == 0 else (*b, *a)
    adb_device.shell(serial, f"input swipe {x0} {y0} {x1} {y1} {SWIPE_MS}")


def window_value(sf: dict, start_ns: int, end_ns: int) -> dict:
    covered = sf["first_poll_ns"] is not None and sf["first_poll_ns"] <= start_ns and \
        sf["last_poll_ns"] >= end_ns and not sf_sampler.holes_overlapping(sf["holes"], start_ns, end_ns)
    if not covered:
        return {"outcome": "truncated", "presents_per_second": None}
    ts = sf["presents"]
    return {"outcome": "valid", "presents": len(sf_sampler.presents_in(ts, start_ns, end_ns)),
            "presents_per_second": sf_sampler.median_presents_per_second(ts, start_ns, end_ns),
            "intervals_ms": sf_sampler.interval_stats(sf_sampler.presents_in(ts, start_ns, end_ns))}


def recenter_run(serial: str, layer: dict, clock: adb_device.ClockMap, screen, recenter) -> dict:
    for k in range(3):
        swipe(serial, screen, 0)  # same direction: move away from Home
        time.sleep(BETWEEN_S)
    time.sleep(2.0)
    sampler = sf_sampler.Sampler(serial, layer, clock).start()
    time.sleep(PRE_TAP_S)
    host = time.monotonic()
    adb_device.tap(serial, recenter, touchscreen=True)
    time.sleep(RECENTER_WINDOW_S + 1.0)
    sampler.stop()
    tap_ns = clock.device_ns(host)
    return {"tap_ns": tap_ns, **window_value(sampler.result(), tap_ns, tap_ns + int(RECENTER_WINDOW_S * 1e9))}


def pan_run(serial: str, layer: dict, clock: adb_device.ClockMap, screen) -> dict:
    sampler = sf_sampler.Sampler(serial, layer, clock).start()
    time.sleep(1.0)
    start = time.monotonic()
    for k in range(PAN_SWIPES):
        swipe(serial, screen, k)
        time.sleep(BETWEEN_S)
    end = time.monotonic()
    time.sleep(1.0)
    sampler.stop()
    return {"swipes": PAN_SWIPES, **window_value(sampler.result(), clock.device_ns(start), clock.device_ns(end))}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    adb_device.add_model_arg(parser)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--recenter", action="store_true")
    mode.add_argument("--adb-pan", action="store_true")
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--out")
    args = parser.parse_args()
    serial = adb_device.resolve_serial(args.model)
    nodes = adb_device.ui_dump(serial)
    system = adb_device.current_system(nodes)
    recenter = adb_device.find(nodes, desc="Recenter Orrery")
    if args.recenter and not recenter:
        raise adb_device.DeviceError("Recenter Orrery control not found (is the Orrery open?)")
    import tab_return
    screen = tab_return.screen_size(serial)
    layer = sf_sampler.resolve_layer(serial)
    clock = adb_device.ClockMap.anchor(serial)
    adb_device.a11y_quiet()
    runs = []
    for _ in range(args.runs):
        runs.append(recenter_run(serial, layer, clock, screen, recenter) if args.recenter
                    else pan_run(serial, layer, clock, screen))
        time.sleep(2.0)
    values = [r["presents_per_second"] for r in runs if r["outcome"] == "valid"]
    adb_device.write_json(args.out, {
        "model": args.model, "scenario": "recenter" if args.recenter else "adb-pan (secondary, injection-bound)",
        "system_label": system, "layer": layer, "runs": runs, "valid_runs": len(values),
        "median_presents_per_second": statistics.median(values) if len(values) == args.runs else "insufficient"})
    return 0


if __name__ == "__main__":
    sys.exit(main())
