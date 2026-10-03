#!/usr/bin/env python3
"""SurfaceFlinger present sampler for the Orrery canvas layer (38.7 D-56/D-40/D-44).

What it measures: actual-present timestamps (CLOCK_MONOTONIC ns) of ONE
SurfaceFlinger layer, the compositor's view of how often the Orrery canvas put
a new frame on screen. This is the GPU/compositor side. It says nothing about
which app thread (UI, JS, RenderThread) caused a missed frame; thread_cpu.py
covers that.

Which layer:
  - V2 with an opaque Skia canvas is a SurfaceView: "SurfaceView[<pkg>/…](BLAST)#id"
    (Android 13+) or "SurfaceView - <pkg>/…#n" (Android 12). The highest #id wins,
    because a dead layer from an earlier mount can linger in the list.
  - main today draws the canvas into a TextureView, so its frames present
    through the app WINDOW layer: "VRI-<pkg>/<activity>#id" on Android 13+, and
    the un-prefixed "<pkg>/<activity>#n" buffer layer on Android 12 (the Pixel 3a;
    its hash-prefixed "<hash> <pkg>/<activity>#0" container never presents).
`dumpsys gfxinfo` is not used for presents: it cannot see a SurfaceView, and the
two builds being compared may use different surface types.

`dumpsys SurfaceFlinger --latency '<layer>'` keeps only the last ~128 presents,
so the sampler clears once and then polls every 0.5 s, unioning the column-2
(actual present) timestamps; 0 and INT64_MAX rows (pending fences) are ignored.
When a poll's oldest present is newer than everything seen before and its
history is full, presents may have been lost: that span is recorded as a
coverage HOLE and touch_windows.py marks overlapping windows truncated.

Usage:
  sf_sampler.py --model "Pixel 6 Pro" --seconds 30 --out run.json [--expect window|surfaceview]
  sf_sampler.py --model "Pixel_3a" --stop-file /tmp/stop --out run.json
  sf_sampler.py --model "Pixel_3a" --probe-layers 5    # which candidate layer actually presents
"""
from __future__ import annotations

import argparse
import os
import re
import statistics
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adb_device  # noqa: E402

POLL_S = 0.5
INT64_MAX = 2**63 - 1
LATENCY_HISTORY = 127  # rows SurfaceFlinger keeps per layer (128 slots, one header)


# --- Layer detection ----------------------------------------------------------
def _clean(line: str) -> str:
    """Strip the Android 14+ `RequestedLayerState{… parentId=…}` wrapper."""
    name = line.strip()
    if name.startswith("RequestedLayerState{"):
        name = name[len("RequestedLayerState{"):]
        name = re.split(r" parentId=| !handle| z=", name)[0]
        name = name.rstrip("}")
    return name


def _layer_id(name: str) -> int:
    match = re.search(r"#(\d+)$", name)
    return int(match.group(1)) if match else -1


def layer_candidates(list_text: str, package: str = adb_device.PACKAGE) -> list[dict]:
    """Every layer of `package` that could carry the canvas, best first."""
    names = [_clean(line) for line in list_text.splitlines() if package in line]
    out = []
    surface = [n for n in names if "SurfaceView" in n]
    blast = [n for n in surface if "(BLAST)" in n]
    for n in sorted(blast or surface, key=_layer_id, reverse=True):
        out.append({"kind": "surfaceview", "name": n})
    for n in sorted((n for n in names if n.startswith(f"VRI-{package}/")), key=_layer_id, reverse=True):
        out.append({"kind": "window", "name": n})
    legacy = re.compile(rf"^{re.escape(package)}/\S+#\d+$")
    for n in sorted((n for n in names if legacy.match(n)), key=_layer_id, reverse=True):
        out.append({"kind": "window", "name": n})
    return out


def detect_layer(list_text: str, package: str = adb_device.PACKAGE) -> dict | None:
    candidates = layer_candidates(list_text, package)
    return candidates[0] if candidates else None


def layer_present(list_text: str, name: str) -> bool:
    return any(_clean(line) == name for line in list_text.splitlines())


# --- --latency parse ----------------------------------------------------------
def parse_latency(text: str) -> tuple[int | None, list[int], int]:
    """(vsync period ns, actual-present timestamps, number of FILLED rows).

    Android 12 prints every history slot (empty ones as `0 0 0`); newer
    versions print only filled ones. A filled row is any non-zero row, valid or
    still pending, so "history full" means the same thing on both."""
    lines = [l for l in text.splitlines() if l.strip()]
    if not lines:
        return None, [], 0
    period = int(lines[0]) if lines[0].strip().isdigit() else None
    presents, rows = [], 0
    for line in lines[1:]:
        parts = line.split()
        if len(parts) != 3:
            continue
        if any(int(p) != 0 for p in parts):
            rows += 1
        value = int(parts[1])
        if 0 < value < INT64_MAX:
            presents.append(value)
    return period, presents, rows


# --- Statistics (library helpers; times in device ns) --------------------------
def presents_in(ts: list[int], start_ns: int, end_ns: int) -> list[int]:
    return [t for t in ts if start_ns <= t < end_ns]


def presents_per_second(ts: list[int], start_ns: int, end_ns: int) -> float:
    span = (end_ns - start_ns) / 1e9
    return len(presents_in(ts, start_ns, end_ns)) / span if span > 0 else 0.0


def median_presents_per_second(ts: list[int], start_ns: int, end_ns: int, bin_s: float = 1.0) -> float | None:
    """Median presents per whole `bin_s` bin inside the window (a trailing
    partial bin is dropped). None when the window is shorter than one bin."""
    bin_ns = int(bin_s * 1e9)
    bins = int((end_ns - start_ns) // bin_ns)
    if bins < 1:
        return None
    counts = [0] * bins
    for t in ts:
        if start_ns <= t < start_ns + bins * bin_ns:
            counts[(t - start_ns) // bin_ns] += 1
    return statistics.median(c / bin_s for c in counts)


def _rank(sorted_values: list[float], q: float) -> float:
    return sorted_values[min(len(sorted_values) - 1, int(len(sorted_values) * q))]


def interval_stats(ts: list[int]) -> dict | None:
    """Inter-present intervals (ms): p50/p90/p99/max, nearest rank."""
    ordered = sorted(ts)
    if len(ordered) < 2:
        return None
    gaps = sorted((b - a) / 1e6 for a, b in zip(ordered, ordered[1:]))
    return {
        "count": len(gaps),
        "p50": round(_rank(gaps, 0.5), 3),
        "p90": round(_rank(gaps, 0.9), 3),
        "p99": round(_rank(gaps, 0.99), 3),
        "max": round(gaps[-1], 3),
    }


def max_gap_ms(ts: list[int], start_ns: int, end_ns: int) -> float | None:
    """Longest wait between consecutive presents that overlaps [start, end):
    pairs straddling either edge count, so a stall that begins just before the
    window or ends just after it is still seen. None when no present falls
    inside the window (that is a no-present outcome, not a number)."""
    ordered = sorted(ts)
    if not presents_in(ordered, start_ns, end_ns):
        return None
    worst = 0.0
    for a, b in zip(ordered, ordered[1:]):
        if b > start_ns and a < end_ns:
            worst = max(worst, (b - a) / 1e6)
    return round(worst, 3)


def holes_overlapping(holes: list[list[int]], start_ns: int, end_ns: int) -> bool:
    return any(h0 < end_ns and h1 > start_ns for h0, h1 in holes)


# --- Sampler ------------------------------------------------------------------
class Sampler:
    """Polls one layer's --latency on a background thread and unions presents."""

    def __init__(self, serial: str, layer: dict, clock: adb_device.ClockMap, poll_s: float = POLL_S):
        self.serial, self.layer, self.clock, self.poll_s = serial, layer, clock, poll_s
        self.presents: set[int] = set()
        self.polls: list[int] = []
        self.holes: list[list[int]] = []
        self.period_ns: int | None = None
        self.errors: list[str] = []
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, daemon=True)

    def start(self) -> "Sampler":
        adb_device.shell(self.serial, "dumpsys SurfaceFlinger --latency-clear")
        self._thread.start()
        return self

    def stop(self) -> None:
        self._stop.set()
        self._thread.join()

    def poll_once(self, text: str, host_s: float) -> None:
        period, presents, rows = parse_latency(text)
        self.period_ns = period or self.period_ns
        newest_before = max(self.presents) if self.presents else None
        if presents and newest_before is not None and rows >= LATENCY_HISTORY:
            oldest = min(presents)
            if oldest > newest_before:
                self.holes.append([newest_before, oldest])
        self.presents.update(presents)
        self.polls.append(self.clock.device_ns(host_s))

    def _loop(self) -> None:
        name = self.layer["name"].replace("'", "'\\''")
        while not self._stop.is_set():
            host = time.monotonic()
            try:
                text = adb_device.shell(self.serial, f"dumpsys SurfaceFlinger --latency '{name}'", timeout=10)
                self.poll_once(text, host)
            except Exception as error:  # a failed poll is a coverage gap, not a crash
                self.errors.append(f"{host:.3f}: {error}")
            self._stop.wait(max(0.0, self.poll_s - (time.monotonic() - host)))

    def result(self) -> dict:
        ts = sorted(self.presents)
        first, last = (self.polls[0], self.polls[-1]) if self.polls else (None, None)
        return {
            "layer": self.layer,
            "vsync_period_ns": self.period_ns,
            "poll_s": self.poll_s,
            "first_poll_ns": first,
            "last_poll_ns": last,
            "polls": self.polls,
            "holes": self.holes,
            "poll_errors": self.errors,
            "clock_uncertainty_ms": self.clock.uncertainty_ms,
            "presents": ts,
            "summary": summary(ts, first, last),
        }


def summary(ts: list[int], start_ns: int | None, end_ns: int | None) -> dict:
    if not ts or start_ns is None or end_ns is None:
        return {"presents": len(ts)}
    return {
        "presents": len(ts),
        "presents_per_second": round(presents_per_second(ts, start_ns, end_ns), 2),
        "median_presents_per_second": median_presents_per_second(ts, start_ns, end_ns),
        "intervals_ms": interval_stats(ts),
    }


def resolve_layer(serial: str, expect: str | None = None) -> dict:
    listing = adb_device.shell(serial, "dumpsys SurfaceFlinger --list")
    layer = detect_layer(listing)
    if not layer:
        raise adb_device.DeviceError("no Orbit canvas layer in SurfaceFlinger --list (is the Orrery open?)")
    if expect and layer["kind"] != expect:
        raise adb_device.DeviceError(f"expected a {expect} layer, found {layer['kind']}: {layer['name']}")
    return layer


def probe_layers(serial: str, seconds: float) -> list[dict]:
    """Poll every candidate layer and count its presents: proves on a real
    phone which layer carries the canvas (runbook first-recording check)."""
    listing = adb_device.shell(serial, "dumpsys SurfaceFlinger --list")
    out = []
    adb_device.shell(serial, "dumpsys SurfaceFlinger --latency-clear")
    deadline = time.monotonic() + seconds
    seen = {c["name"]: set() for c in layer_candidates(listing)}
    while time.monotonic() < deadline:
        for name in seen:
            text = adb_device.shell(serial, f"dumpsys SurfaceFlinger --latency '{name}'", timeout=10)
            seen[name].update(parse_latency(text)[1])
        time.sleep(POLL_S)
    for candidate in layer_candidates(listing):
        out.append({**candidate, "presents": len(seen[candidate["name"]])})
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    adb_device.add_model_arg(parser)
    parser.add_argument("--seconds", type=float)
    parser.add_argument("--stop-file")
    parser.add_argument("--out")
    parser.add_argument("--expect", choices=["window", "surfaceview"])
    parser.add_argument("--probe-layers", type=float, metavar="SECONDS")
    args = parser.parse_args()
    serial = adb_device.resolve_serial(args.model)
    if args.probe_layers:
        adb_device.write_json(args.out, {"model": args.model, "layers": probe_layers(serial, args.probe_layers)})
        return 0
    if not args.seconds and not args.stop_file:
        parser.error("--seconds or --stop-file is required")
    layer = resolve_layer(serial, args.expect)
    sampler = Sampler(serial, layer, adb_device.ClockMap.anchor(serial)).start()
    deadline = time.monotonic() + (args.seconds or 1e9)
    while time.monotonic() < deadline and not (args.stop_file and os.path.exists(args.stop_file)):
        time.sleep(0.1)
    sampler.stop()
    adb_device.write_json(
        args.out,
        {"model": args.model, "android": adb_device.android_release(serial), **sampler.result()},
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
