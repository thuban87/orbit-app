#!/usr/bin/env python3
"""Owner pan/pinch windows, attributed from the touchscreen, scored by SurfaceFlinger.

38.7 Plan 01 (D-56, H7). What it measures: median presents per second of the
Orrery canvas layer (sf_sampler.py: compositor side, not any app thread) while
the OWNER's finger(s) are on the screen. `adb input swipe` is injection-rate
bound and adb cannot inject a pinch, so pan/pinch gates come from real touches.

Touch attribution: `getevent -lt <touchscreen>` slot/tracking-id events give the
number of fingers down over time. A GESTURE runs from the first finger down to
the last finger up. A gesture whose fingers never exceed one is a PAN window
(the whole gesture); one that reaches two is a PINCH window (its longest
two-finger span). Windows shorter than 1 s, or with 3+ fingers, are STRAY
touches. Script taps go through `input` injection, which never appears on the
touchscreen device, so a System switch the script makes can never be counted.

Labelled session mode (the ONLY mode used for gate numbers):
  touch_windows.py --model "Pixel 6 Pro" --calibration cal.json \
      --session "Size 120,All Contacts" --reps 3 --timeout-per-segment 240 --out s.json
For each System the script selects it through adb, waits 3 s after the switch
tap (no window may start inside that guard), then records one segment while
the owner does: pan, pause, pinch, pause — three times — then lifts and waits.
A segment closes after 3 pan + 3 pinch windows plus 5 s without a touch, or at
the timeout. Windows are labelled {System}/{pan|pinch}/r{1-3} by order; any
other sequence, or a stray touch, makes the segment `unlabelled` (re-record it,
never guess). A label is reported as a number only from 3 valid repetitions,
otherwise `insufficient`.

Window outcomes: `valid`; `truncated` (starts before the first sampler poll,
ends after the last, or overlaps a sampler coverage hole) — excluded;
`no-present` (valid coverage, zero presents) — 0 presents/s only if the sampled
layer still existed at segment end, otherwise the whole segment is `invalid`.

Clock alignment (H7): getevent timestamps must be on SurfaceFlinger's clock
(CLOCK_MONOTONIC). `--calibrate` proves it with three physical taps:
  1. dispatcher method — if `dumpsys input` RecentQueue prints the touch-down's
     `eventTime=` (debuggable builds of InputDispatcher do), offset_ms =
     getevent_ts − eventTime; |offset| ≤ 2 ms → aligned; three offsets within
     2 ms of each other → corrected by their median; else unaligned.
  2. clock-identity method (fallback; production builds print only
     "MotionEvent, age=…ms", seen on the Pixel 6 Pro and Pixel 3a 2026-10-03) —
     right after each touch-down, read CLOCK_MONOTONIC (a `logcat -v monotonic`
     mark) and CLOCK_BOOTTIME (/proc/uptime). On a phone that has ever slept the
     two differ by hours, so the getevent timestamp's magnitude says which clock
     it is on: monotonic on all three taps → aligned (same clock as
     SurfaceFlinger, offset 0); anything else → unaligned.
An `unaligned` calibration makes session mode refuse to label any window.
"""
from __future__ import annotations

import argparse
import os
import re
import statistics
import sys
import threading
import time
from dataclasses import dataclass, field

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adb_device  # noqa: E402
import sf_sampler  # noqa: E402

MIN_WINDOW_S = 1.0
SWITCH_GUARD_S = 3.0
QUIET_END_S = 5.0
ALIGN_MS = 2.0
CLOCK_SEPARATION_S = 10.0
MAX_MARK_DELAY_S = 10.0

GETEVENT_RE = re.compile(
    r"^\[\s*(\d+)\.(\d+)\]\s+(?:/dev/input/event\d+:\s+)?(\w+)\s+(\w+)\s+(\w+)"
)


# --- getevent parse -----------------------------------------------------------
@dataclass
class TouchEvent:
    ts_ns: int
    etype: str
    code: str
    value: int


def _value(raw: str) -> int:
    if raw in ("DOWN", "UP"):
        return 1 if raw == "DOWN" else 0
    try:
        number = int(raw, 16)
    except ValueError:
        return 0
    return -1 if number == 0xFFFFFFFF else number


def parse_getevent(text: str) -> list[TouchEvent]:
    events = []
    for line in text.splitlines():
        match = GETEVENT_RE.match(line.strip())
        if not match:
            continue
        sec, frac, etype, code, raw = match.groups()
        frac_ns = int(frac.ljust(9, "0")[:9])
        events.append(TouchEvent(int(sec) * 1_000_000_000 + frac_ns, etype, code, _value(raw)))
    return events


def find_touch_device(getevent_pl: str) -> str | None:
    """The input device whose capabilities report ABS_MT_POSITION_X."""
    current = None
    for line in getevent_pl.splitlines():
        match = re.match(r"add device \d+: (\S+)", line)
        if match:
            current = match.group(1)
        elif "ABS_MT_POSITION_X" in line and current:
            return current
    return None


def touch_changes(events: list[TouchEvent]) -> list[tuple[int, int]]:
    """(timestamp, fingers down) at every SYN_REPORT where the count changes."""
    slot, ids, count, out = 0, {}, 0, []
    for event in events:
        if event.code == "ABS_MT_SLOT":
            slot = event.value
        elif event.code == "ABS_MT_TRACKING_ID":
            if event.value == -1:
                ids.pop(slot, None)
            else:
                ids[slot] = event.value
        elif event.etype == "EV_SYN" and event.code == "SYN_REPORT":
            if len(ids) != count:
                count = len(ids)
                out.append((event.ts_ns, count))
    return out


@dataclass
class Gesture:
    start: int
    end: int
    spans: list[tuple[int, int, int]] = field(default_factory=list)
    open: bool = False

    @property
    def max_count(self) -> int:
        return max((c for _, _, c in self.spans), default=0)


def gestures(changes: list[tuple[int, int]], end_ns: int | None = None) -> list[Gesture]:
    """Group finger-count changes into first-down → last-up gestures."""
    out: list[Gesture] = []
    current: Gesture | None = None
    for i, (ts, count) in enumerate(changes):
        nxt = changes[i + 1][0] if i + 1 < len(changes) else None
        if count > 0:
            if current is None:
                current = Gesture(start=ts, end=ts)
            stop = nxt if nxt is not None else (end_ns if end_ns is not None else ts)
            current.spans.append((ts, stop, count))
            current.end = stop
            if nxt is None:
                current.open = True
                out.append(current)
                current = None
        elif current is not None:
            current.end = ts
            out.append(current)
            current = None
    return out


def classify(gesture: Gesture, min_s: float = MIN_WINDOW_S) -> dict:
    """{kind: pan|pinch|stray, start, end, open} for one gesture."""
    min_ns = int(min_s * 1e9)
    if gesture.max_count == 1 and gesture.end - gesture.start >= min_ns:
        return {"kind": "pan", "start": gesture.start, "end": gesture.end, "open": gesture.open}
    if gesture.max_count == 2:
        two = [(s, e) for s, e, c in gesture.spans if c == 2]
        s, e = max(two, key=lambda span: span[1] - span[0])
        if e - s >= min_ns:
            return {"kind": "pinch", "start": s, "end": e, "open": gesture.open}
    return {"kind": "stray", "start": gesture.start, "end": gesture.end, "open": gesture.open,
            "fingers": gesture.max_count}


# --- Scoring ------------------------------------------------------------------
def evaluate_window(window: dict, sf: dict, offset_ns: int, layer_present: bool) -> dict:
    """Outcome + median presents/s for one window, in SurfaceFlinger time."""
    start, end = window["start"] - offset_ns, window["end"] - offset_ns
    out = {**window, "sf_start": start, "sf_end": end}
    first, last = sf.get("first_poll_ns"), sf.get("last_poll_ns")
    if window.get("open") or first is None or start < first or end > last:
        return {**out, "outcome": "truncated", "presents_per_second": None}
    if sf_sampler.holes_overlapping(sf.get("holes", []), start, end):
        return {**out, "outcome": "truncated", "presents_per_second": None}
    ts = sf.get("presents", [])
    if not sf_sampler.presents_in(ts, start, end):
        value = 0.0 if layer_present else None
        return {**out, "outcome": "no-present", "presents_per_second": value}
    return {**out, "outcome": "valid",
            "presents_per_second": sf_sampler.median_presents_per_second(ts, start, end)}


def expected_order(reps: int) -> list[str]:
    return ["pan", "pinch"] * reps


def analyse_segment(segment: dict, events: list[TouchEvent], sf: dict, offset_ns: int, reps: int) -> dict:
    """Classify and label one System segment."""
    start, end = segment["start_ns"], segment["end_ns"]
    inside = [g for g in gestures(touch_changes(events), end) if start <= g.start < end]
    before = [g for g in gestures(touch_changes(events), end)
              if segment.get("boundary_ns", start) <= g.start < start]
    classified = [classify(g) for g in inside]
    windows = [c for c in classified if c["kind"] != "stray"]
    strays = [c for c in classified if c["kind"] == "stray"]
    scored = [evaluate_window(w, sf, offset_ns, segment.get("layer_present", True)) for w in windows]
    result = {**segment, "windows": scored, "strays": strays, "guard_touches": len(before)}
    kinds = [w["kind"] for w in windows]
    if any(w["outcome"] == "no-present" for w in scored) and not segment.get("layer_present", True):
        return {**result, "status": "invalid", "reason": "no-present window and the sampled layer changed"}
    if strays or kinds != expected_order(reps):
        reason = f"window order {kinds} != {expected_order(reps)}" + (f"; {len(strays)} stray touch(es)" if strays else "")
        return {**result, "status": "unlabelled", "reason": reason}
    seen: dict[str, int] = {}
    for window in scored:
        seen[window["kind"]] = seen.get(window["kind"], 0) + 1
        window["label"] = f"{segment['system']}/{window['kind']}/r{seen[window['kind']]}"
    return {**result, "status": "labelled"}


def aggregate(segments: list[dict], reps: int) -> dict:
    """Per {System}/{pan|pinch}: each repetition's value and the median of 3."""
    labels: dict[str, dict] = {}
    for segment in segments:
        for kind in ("pan", "pinch"):
            key = f"{segment['system']}/{kind}"
            entry = labels.setdefault(key, {"reps": {}, "median": "insufficient"})
            if segment["status"] != "labelled":
                continue
            for window in segment["windows"]:
                if window["kind"] != kind:
                    continue
                ok = window["outcome"] == "valid" or (
                    window["outcome"] == "no-present" and window["presents_per_second"] is not None
                )
                entry["reps"][window["label"].rsplit("/", 1)[1]] = (
                    window["presents_per_second"] if ok else window["outcome"]
                )
    for entry in labels.values():
        values = [v for v in entry["reps"].values() if isinstance(v, (int, float))]
        if len(values) == reps and len(entry["reps"]) == reps:
            entry["median"] = statistics.median(values)
    return labels


def analyse(events: list[TouchEvent], sf: dict, segments: list[dict], calibration: dict | None, reps: int = 3) -> dict:
    """Offline analysis of a recorded session; refuses unless calibrated."""
    if not calibration or calibration.get("status") not in ("aligned", "corrected"):
        return {"refused": "calibration missing or unaligned; windows are not labelled",
                "calibration": calibration}
    offset_ns = int(round(calibration.get("offset_ms", 0.0) * 1e6))
    analysed = [analyse_segment(s, events, sf, offset_ns, reps) for s in segments]
    counts: dict[str, int] = {}
    for segment in analysed:
        counts[f"segment:{segment['status']}"] = counts.get(f"segment:{segment['status']}", 0) + 1
        for window in segment["windows"]:
            counts[window["outcome"]] = counts.get(window["outcome"], 0) + 1
        counts["stray"] = counts.get("stray", 0) + len(segment["strays"])
    return {"calibration": calibration, "segments": analysed,
            "labels": aggregate(analysed, reps), "outcome_counts": counts}


# --- Calibration --------------------------------------------------------------
def parse_dispatcher_down_time(dumpsys_input: str) -> int | None:
    """Latest touch-down `eventTime=` in the dispatcher RecentQueue, if printed."""
    block = dumpsys_input.split("RecentQueue:", 1)
    if len(block) < 2:
        return None
    times = []
    for line in block[1].splitlines()[1:]:
        if not line.startswith("    "):
            break
        if "MotionEvent" in line and re.search(r"action=(?:ACTION_)?DOWN\b", line):
            match = re.search(r"eventTime=(\d+)", line)
            if match:
                times.append(int(match.group(1)))
    return max(times) if times else None


def classify_tap_clock(getevent_s: float, monotonic_s: float | None, boottime_s: float | None) -> str:
    if getevent_s > 1e9:
        return "realtime"
    if monotonic_s is None or boottime_s is None:
        return "unknown"
    gap = boottime_s - monotonic_s
    if abs(gap) <= ALIGN_MS / 1000:
        return "monotonic"  # the two candidate clocks agree within 2 ms
    if abs(gap) < CLOCK_SEPARATION_S:
        return "ambiguous"
    if 0 <= monotonic_s - getevent_s <= MAX_MARK_DELAY_S:
        return "monotonic"
    if 0 <= boottime_s - getevent_s <= MAX_MARK_DELAY_S:
        return "boottime"
    return "unknown"


def decide_calibration(taps: list[dict]) -> dict:
    """taps: [{getevent_ns, dispatcher_ns|None, monotonic_s, boottime_s}]."""
    if taps and all(t.get("dispatcher_ns") is not None for t in taps):
        offsets = [(t["getevent_ns"] - t["dispatcher_ns"]) / 1e6 for t in taps]
        spread = max(offsets) - min(offsets)
        if all(abs(o) <= ALIGN_MS for o in offsets):
            status, offset = "aligned", 0.0
        elif spread <= ALIGN_MS:
            status, offset = "corrected", statistics.median(offsets)
        else:
            status, offset = "unaligned", None
        return {"method": "dispatcher-eventtime", "status": status, "offset_ms": offset,
                "tap_offsets_ms": offsets, "taps": taps}
    clocks = [classify_tap_clock(t["getevent_ns"] / 1e9, t.get("monotonic_s"), t.get("boottime_s")) for t in taps]
    status = "aligned" if taps and all(c == "monotonic" for c in clocks) else "unaligned"
    return {"method": "clock-identity", "status": status, "offset_ms": 0.0 if status == "aligned" else None,
            "tap_clocks": clocks, "taps": taps,
            "boottime_minus_monotonic_s": [round(t["boottime_s"] - t["monotonic_s"], 3)
                                           for t in taps if t.get("boottime_s") and t.get("monotonic_s")]}


# --- Live capture -------------------------------------------------------------
class GeteventReader:
    def __init__(self, serial: str, device: str):
        self.proc = adb_device.popen_shell(serial, f"getevent -lt {device}")
        self.lines: list[str] = []
        self.lock = threading.Lock()
        self.thread = threading.Thread(target=self._read, daemon=True)
        self.thread.start()

    def _read(self) -> None:
        for line in self.proc.stdout:
            with self.lock:
                self.lines.append(line.rstrip("\n"))

    def events(self) -> list[TouchEvent]:
        with self.lock:
            return parse_getevent("\n".join(self.lines))

    def stop(self) -> None:
        self.proc.terminate()


def wait_for_touch_down(reader: GeteventReader, after_ns: int, timeout_s: float = 60) -> int | None:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        for ts, count in touch_changes(reader.events()):
            if ts > after_ns and count >= 1:
                return ts
        time.sleep(0.02)
    return None


def run_calibration(serial: str, device: str, taps: int = 3) -> dict:
    reader = GeteventReader(serial, device)
    time.sleep(0.5)
    records, last = [], 0
    try:
        for n in range(taps):
            print(f"[calibrate] tap {n + 1}/{taps}: tap ONCE on the Orrery title bar, then lift.", flush=True)
            down = wait_for_touch_down(reader, last)
            if down is None:
                raise adb_device.DeviceError("no touch-down seen within 60 s")
            clocks = adb_device.device_clocks(serial, extra="dumpsys input")
            records.append({"getevent_ns": down, "dispatcher_ns": parse_dispatcher_down_time(clocks["extra"]),
                            "monotonic_s": clocks["monotonic_s"], "boottime_s": clocks["boottime_s"]})
            last = down
            time.sleep(1.5)
    finally:
        reader.stop()
    return decide_calibration(records)


def run_session(serial: str, device: str, systems: list[str], reps: int, timeout_s: float,
                calibration: dict) -> dict:
    if calibration.get("status") not in ("aligned", "corrected"):
        raise adb_device.DeviceError("calibration is unaligned: refusing to record labelled windows")
    layer = sf_sampler.resolve_layer(serial)
    clock = adb_device.ClockMap.anchor(serial)
    sampler = sf_sampler.Sampler(serial, layer, clock).start()
    reader = GeteventReader(serial, device)
    segments = []
    try:
        for system in systems:
            tapped = adb_device.select_system(serial, system)
            boundary = clock.device_ns(tapped if tapped is not None else time.monotonic())
            time.sleep(SWITCH_GUARD_S + 0.5)
            start = boundary + int(SWITCH_GUARD_S * 1e9)
            print(f"[session] {system}: pan, pause, pinch, pause - {reps} times - then lift and wait.", flush=True)
            deadline = time.monotonic() + timeout_s
            while time.monotonic() < deadline:
                now_ns = clock.device_ns(time.monotonic())
                found = [classify(g) for g in gestures(touch_changes(reader.events()), now_ns)
                         if g.start >= start]
                done = [w for w in found if w["kind"] != "stray" and not w["open"]]
                quiet = not found or (not found[-1]["open"] and now_ns - found[-1]["end"] >= QUIET_END_S * 1e9)
                if len(done) >= 2 * reps and quiet:
                    break
                time.sleep(0.5)
            end = clock.device_ns(time.monotonic())
            listing = adb_device.shell(serial, "dumpsys SurfaceFlinger --list")
            segments.append({"system": system, "boundary_ns": boundary, "start_ns": start, "end_ns": end,
                             "layer_present": sf_sampler.layer_present(listing, layer["name"]),
                             "timed_out": time.monotonic() >= deadline})
    finally:
        sampler.stop()
        reader.stop()
    sf = sampler.result()
    return {"layer": layer, "sf": {k: v for k, v in sf.items() if k != "presents"},
            **analyse(reader.events(), sf, segments, calibration, reps)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    adb_device.add_model_arg(parser)
    parser.add_argument("--calibrate", action="store_true")
    parser.add_argument("--calibration", help="calibration JSON from --calibrate (required for --session)")
    parser.add_argument("--session", help='comma-separated Systems, e.g. "Size 120,All Contacts"')
    parser.add_argument("--reps", type=int, default=3)
    parser.add_argument("--timeout-per-segment", type=float, default=240)
    parser.add_argument("--seconds", type=float, help="unlabelled exploration mode")
    parser.add_argument("--out")
    args = parser.parse_args()
    serial = adb_device.resolve_serial(args.model)
    device = find_touch_device(adb_device.shell(serial, "getevent -pl"))
    if not device:
        raise adb_device.DeviceError("no touchscreen (ABS_MT_POSITION_X) in getevent -pl")
    if args.calibrate:
        result = run_calibration(serial, device)
        adb_device.write_json(args.out, {"model": args.model, "device": device, **result})
        return 0 if result["status"] != "unaligned" else 2
    if args.session:
        if not args.calibration:
            parser.error("--session needs --calibration (run --calibrate first)")
        import json
        with open(args.calibration, encoding="utf-8") as handle:
            calibration = json.load(handle)
        systems = [s.strip() for s in args.session.split(",") if s.strip()]
        result = run_session(serial, device, systems, args.reps, args.timeout_per_segment, calibration)
        adb_device.write_json(args.out, {"model": args.model, "device": device, **result})
        return 0
    if args.seconds:
        layer = sf_sampler.resolve_layer(serial)
        clock = adb_device.ClockMap.anchor(serial)
        sampler = sf_sampler.Sampler(serial, layer, clock).start()
        reader = GeteventReader(serial, device)
        time.sleep(args.seconds)
        sampler.stop()
        reader.stop()
        sf = sampler.result()
        windows = [evaluate_window(classify(g), sf, 0, True)
                   for g in gestures(touch_changes(reader.events()), sf["last_poll_ns"])]
        adb_device.write_json(args.out, {"model": args.model, "layer": layer, "labelled": False,
                                         "note": "exploration only; gate numbers come from --session",
                                         "windows": windows})
        return 0
    parser.error("one of --calibrate, --session or --seconds is required")
    return 2


if __name__ == "__main__":
    sys.exit(main())
