#!/usr/bin/env python3
"""Tab return (and background return) to the Orrery's FIRST FULL FRAME (38.7 D-56 G3 / D-58).

What it measures: on-screen time, from a `screenrecord` of the phone (what the
user sees, after composition), not any thread's work. Frames are decoded with
ffmpeg to down-scaled grayscale with their presentation timestamps; three
regions are read from the UI tree before the run (the tab bar = the tab
buttons' bounds; the header = the "Orrery" title's bounds; the canvas = the
band between the header and the tab bar — RN does not export a plain View's
testID to uiautomator, so `orrery-canvas-container` is located by its
neighbours) and scaled to the decoded frame.

Times (seconds from the recording start; reported as differences):
  t_tap     the tab bar first departs from the pre-tap frame (Orrery tab selected)
  t_screen  the header first departs from the pre-tap frame (Orrery title shown);
            the blank pre-mount frame is the first frame whose header change has
            completed (cross-fade done)
  t_canvas  the canvas band first departs from that blank pre-mount frame
  t_full    the FIRST FULL FRAME: every canvas frame is scored by its content —
            the fraction of pixels whose fine structure (pixel minus its 3x3 mean)
            departs from the blank pre-mount frame's by more than a noise
            threshold, so a smooth sky backdrop painted before the scene does not
            count as content. The settled content level is the
            median score over the last 2 s; t_full is the first frame scoring
            >= 95 % of it that never falls below 90 % of it afterwards. The final
            frame is never used as a similarity target: ambient motion (drift,
            twinkle, pulses) keeps it changing.
Reported: screen = t_screen - t_tap, mount = t_canvas - t_screen (today: the
scene reload + canvas mount), fill = t_full - t_canvas, total = t_full - t_tap
(the G3 value). Outcomes that are never numbers: `truncated` (fewer than 2 s of
recording after t_full), `no-full-frame` (the level is never held),
`no-canvas-change` (the canvas never departs from the first Orrery frame:
complete instantly or never drawn — decide from the saved strip by eye).
t_photos (context only, not G3): when the brightest-detail probe blocks of the
run's own settled frame stop changing.

Each run saves the frame before, at and after t_full as PNGs for a hand check.

  tab_return.py --model "Pixel 6 Pro" --runs 3 --out-dir ~/orbit-art/38.7/baseline/tab-6pro
  tab_return.py --model "Pixel_3a" --background --runs 3 --out-dir …
"""
from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adb_device  # noqa: E402

DECODE_WIDTH = 180
NOISE = 12
CHANGE_FRAC = 0.02
CONTENT_MIN = 0.02
REACH = 0.95
HOLD = 0.90
SETTLE_WINDOW_S = 2.0
FADE_DONE = 0.9
RECORD_LIMIT_S = 60  # main's tab return: ~8 s on the 6 Pro, > 15 s on the 3a (2026-10-03)
DIGEST_DWELL_S = 3.0
PRE_TAP_S = 1.5
BACKGROUND_DWELL_S = 5.0
PROBES = 12
REMOTE_MP4 = "/sdcard/orbperf-tab.mp4"


# --- Pure frame analysis (unit-tested by selftest.py) -------------------------
def _region_pixels(frame: bytes, width: int, region: tuple[int, int, int, int]):
    x0, y0, x1, y1 = region
    for y in range(y0, y1):
        row = y * width
        yield from frame[row + x0:row + x1]


def departure(frame: bytes, ref: bytes, width: int, region: tuple[int, int, int, int]) -> float:
    """Fraction of region pixels differing from `ref` by more than NOISE gray levels."""
    a = list(_region_pixels(frame, width, region))
    b = list(_region_pixels(ref, width, region))
    if not a:
        return 0.0
    return sum(1 for p, q in zip(a, b) if abs(p - q) > NOISE) / len(a)


def highpass(frame: bytes, width: int, region: tuple[int, int, int, int]) -> list[list[int]]:
    """Each region pixel minus the mean of its 3x3 neighbourhood (rows of ints; the
    region's border pixels are dropped). Smooth fills (a sky backdrop, a nebula
    gradient, a cross-fade) score near zero; edges (rings, bodies, labels) score high."""
    x0, y0, x1, y1 = region
    rows = [frame[y * width + x0:y * width + x1] for y in range(y0, y1)]
    hsum = [[a + b + c for a, b, c in zip(r, r[1:], r[2:])] for r in rows]
    out = []
    for k in range(1, len(rows) - 1):
        centre = rows[k][1:-1]
        out.append([9 * p - (a + b + c) for p, a, b, c in zip(centre, hsum[k - 1], hsum[k], hsum[k + 1])])
    return out


def structure_departure(hp: list[list[int]], ref: list[list[int]]) -> float:
    """Fraction of pixels whose fine structure (highpass, in 1/9 gray levels) differs
    from the reference's by more than NOISE gray levels."""
    limit = 9 * NOISE
    total = changed = 0
    for row, ref_row in zip(hp, ref):
        total += len(row)
        changed += sum(1 for p, q in zip(row, ref_row) if abs(p - q) > limit)
    return changed / total if total else 0.0


def _first(indices, predicate):
    for k in indices:
        if predicate(k):
            return k
    return None


def analyse_frames(frames: list[tuple[float, bytes]], width: int, regions: dict, duration_s: float,
                   tap_region: str = "tab") -> dict:
    """Detect t_tap/t_screen/t_canvas/t_full over decoded frames (see module doc)."""
    if not frames:
        return {"outcome": "no-frames"}
    times = [t for t, _ in frames]
    ref = frames[0][1]
    n = len(frames)
    k_tap = _first(range(n), lambda k: departure(frames[k][1], ref, width, regions[tap_region]) > CHANGE_FRAC)
    if k_tap is None:
        return {"outcome": "no-tap"}
    header_dep = [departure(frames[k][1], ref, width, regions["header"]) for k in range(n)]
    k_screen = _first(range(k_tap, n), lambda k: header_dep[k] > CHANGE_FRAC)
    if k_screen is None:
        return {"outcome": "no-screen", "t_tap": times[k_tap]}
    header_final = header_dep[-1]
    k_blank = _first(range(k_screen, n), lambda k: header_dep[k] >= FADE_DONE * header_final) or k_screen
    blank = frames[k_blank][1]
    # Canvas content is scored on fine STRUCTURE, not raw brightness: main paints a
    # smooth sky backdrop seconds before the scene, and a brightness score took that
    # backdrop for the full frame (6 Pro, 2026-10-03 hand check).
    blank_hp = highpass(blank, width, regions["canvas"])
    content = [structure_departure(highpass(frames[k][1], width, regions["canvas"]), blank_hp)
               if k >= k_blank else 0.0 for k in range(n)]
    tail = [content[k] for k in range(k_blank, n) if times[k] >= duration_s - SETTLE_WINDOW_S]
    settled = statistics.median(tail) if tail else content[-1]
    base = {"t_tap": times[k_tap], "t_screen": times[k_screen], "t_blank": times[k_blank],
            "settled_level": round(settled, 4), "duration_s": duration_s,
            "content": [round(c, 4) for c in content]}
    if settled < CONTENT_MIN:
        return {**base, "outcome": "no-canvas-change"}
    k_canvas = _first(range(k_blank, n), lambda k: content[k] > CONTENT_MIN)
    k_full = _first(range(k_canvas, n), lambda k: content[k] >= REACH * settled
                    and all(c >= HOLD * settled for c in content[k:]))
    if k_full is None:
        return {**base, "outcome": "no-full-frame", "t_canvas": times[k_canvas]}
    t_full = times[k_full]
    if duration_s - t_full < SETTLE_WINDOW_S:
        return {**base, "outcome": "truncated", "t_canvas": times[k_canvas], "t_full_candidate": t_full}
    return {**base, "outcome": "valid", "t_canvas": times[k_canvas], "t_full": t_full, "k_full": k_full,
            "screen_s": round(times[k_screen] - times[k_tap], 3),
            "mount_s": round(times[k_canvas] - times[k_screen], 3),
            "fill_s": round(t_full - times[k_canvas], 3),
            "total_s": round(t_full - times[k_tap], 3)}


def photo_probe_time(frames: list[tuple[float, bytes]], width: int, canvas: tuple[int, int, int, int],
                     after_s: float) -> float | None:
    """Context only: the brightest-detail blocks of the settled frame; the first
    time after which each block's mean stays within NOISE of its settled mean."""
    x0, y0, x1, y1 = canvas
    bw, bh = max(1, (x1 - x0) // 8), max(1, (y1 - y0) // 16)
    blocks = [(x, y, x + bw, y + bh) for y in range(y0, y1 - bh + 1, bh) for x in range(x0, x1 - bw + 1, bw)]
    last = frames[-1][1]

    def mean(frame: bytes, block) -> float:
        values = list(_region_pixels(frame, width, block))
        return sum(values) / len(values)

    def spread(block) -> float:
        values = list(_region_pixels(last, width, block))
        avg = sum(values) / len(values)
        return sum((v - avg) ** 2 for v in values)

    probes = sorted(blocks, key=spread, reverse=True)[:PROBES]
    target = {b: mean(last, b) for b in probes}
    stable_from = None
    for t, frame in frames:
        if t < after_s:
            continue
        ok = all(abs(mean(frame, b) - target[b]) <= NOISE for b in probes)
        if ok and stable_from is None:
            stable_from = t
        elif not ok:
            stable_from = None
    return stable_from


# --- Device run ---------------------------------------------------------------
def screen_size(serial: str) -> tuple[int, int]:
    text = adb_device.shell(serial, "wm size")
    match = re.findall(r"(\d+)x(\d+)", text)
    width, height = match[-1]
    return int(width), int(height)


def regions_from_ui(nodes, screen: tuple[int, int]) -> dict:
    tabs = adb_device.tab_nodes(nodes)
    title = [n for n in nodes if n.text == "Orrery" and n.bounds[1] < screen[1] * 0.25]
    if not tabs or not title:
        raise adb_device.DeviceError("Orrery title or tab bar not found: open the Orrery tab first")
    tab = (min(n.bounds[0] for n in tabs), min(n.bounds[1] for n in tabs),
           max(n.bounds[2] for n in tabs), max(n.bounds[3] for n in tabs))
    header = title[0].bounds
    canvas = (0, header[3] + 8, screen[0], tab[1] - 8)
    return {"tab": tab, "header": header, "canvas": canvas, "full": (0, 0, screen[0], screen[1])}


def decode(mp4: str) -> tuple[list[tuple[float, bytes]], int, int, float]:
    proc = subprocess.run(
        # -fps_mode passthrough: one output frame per decoded frame. Without it the
        # rawvideo muxer resamples to a constant rate (dup/drop), so pixel data no
        # longer lines up with showinfo's timestamps (found 2026-10-03: dup=16 drop=16).
        ["ffmpeg", "-hide_banner", "-i", mp4, "-vf", f"scale={DECODE_WIDTH}:-2,format=gray,showinfo",
         "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
        capture_output=True, check=True)
    log = proc.stderr.decode(errors="replace")
    infos = re.findall(r"n:\s*\d+.*?pts_time:([\d.]+).*?s:(\d+)x(\d+)", log)
    duration = re.search(r"Duration: (\d+):(\d+):([\d.]+)", log)
    total = int(duration.group(1)) * 3600 + int(duration.group(2)) * 60 + float(duration.group(3)) if duration else 0.0
    width, height = int(infos[0][1]), int(infos[0][2])
    size = width * height
    if len(proc.stdout) != size * len(infos):
        raise RuntimeError(f"decode misaligned: {len(proc.stdout) // size} raw frames vs {len(infos)} timestamps")
    frames = [(float(t), proc.stdout[i * size:(i + 1) * size]) for i, (t, _, _) in enumerate(infos)]
    return frames, width, height, max(total, frames[-1][0] if frames else 0.0)


def scale(region: tuple[int, int, int, int], factor: float, width: int, height: int) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = (int(round(v * factor)) for v in region)
    return max(0, x0), max(0, y0), min(width, max(x1, x0 + 1)), min(height, max(y1, y0 + 1))


def save_strip(mp4: str, indices: list[int], out_dir: str, stem: str) -> list[str]:
    """The decoded frames at these indices as PNGs. Selected by frame index, not by
    `-ss` time: a seek to a frame's own timestamp can land on the next frame."""
    paths = []
    for label, k in zip(("before", "at", "after"), indices):
        path = os.path.join(out_dir, f"{stem}-tfull-{label}.png")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", mp4,
                        "-vf", f"select=eq(n\\,{k})", "-fps_mode", "passthrough", "-frames:v", "1", path],
                       check=True)
        paths.append(path)
    return paths


def record_run(serial: str, regions: dict, tabs: dict, background: bool, out_dir: str, stem: str) -> dict:
    orrery_tab, digest_tab = tabs["Orrery"], tabs["Digest"]
    if background:
        adb_device.shell(serial, "input keyevent KEYCODE_HOME")
        time.sleep(BACKGROUND_DWELL_S)
    else:
        adb_device.tap(serial, digest_tab, touchscreen=True)
        time.sleep(DIGEST_DWELL_S)
    # No UI dump near the scene reload (adb_device.A11Y_QUIET_S); tabs were located
    # once, before the runs.
    adb_device.a11y_quiet()
    adb_device.shell(serial, f"rm -f {REMOTE_MP4}")
    rec_start = time.monotonic()
    rec = subprocess.Popen([adb_device.ADB, "-s", serial, "shell",
                            f"screenrecord --bit-rate 8000000 --time-limit {RECORD_LIMIT_S} {REMOTE_MP4}"])
    time.sleep(PRE_TAP_S)
    if background:
        adb_device.shell(serial, f"monkey -p {adb_device.PACKAGE} -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1")
    else:
        adb_device.tap(serial, orrery_tab, touchscreen=True)
    rec.wait(timeout=RECORD_LIMIT_S + 20)
    ran_full = rec.returncode == 0 and time.monotonic() - rec_start >= RECORD_LIMIT_S
    time.sleep(1.0)
    mp4 = os.path.join(out_dir, f"{stem}.mp4")
    with open(mp4, "wb") as handle:
        handle.write(adb_device.adb_bytes(serial, "exec-out", f"cat {REMOTE_MP4}"))
    adb_device.shell(serial, f"rm -f {REMOTE_MP4}")
    frames, width, height, duration = decode(mp4)
    # screenrecord writes frames only when the screen changes and leaves the
    # container duration unset (seen on the Pixel 6 Pro), so a static tail is
    # invisible in the frames. When the recorder ran its full time limit, the
    # recording (pts 0 = first captured frame) lasted the limit.
    if ran_full:
        duration = max(duration, float(RECORD_LIMIT_S))
    factor = width / regions["full"][2]
    scaled = {k: scale(v, factor, width, height) for k, v in regions.items()}
    result = analyse_frames(frames, width, scaled, duration, tap_region="full" if background else "tab")
    if result.get("outcome") == "valid":
        k = result["k_full"]
        strip = [max(0, k - 1), k, min(len(frames) - 1, k + 1)]
        result["strip"] = save_strip(mp4, strip, out_dir, stem)
        result["t_photos_context"] = photo_probe_time(frames, width, scaled["canvas"], result["t_canvas"])
    elif result.get("t_screen") is not None:
        k_screen = next(i for i, (t, _) in enumerate(frames) if t >= result["t_screen"])
        result["strip"] = save_strip(mp4, [k_screen, len(frames) // 2, len(frames) - 1], out_dir, stem + "-screen")
    result.pop("content", None)
    return {"mp4": mp4, "frames": len(frames), "decoded": [width, height], **result}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    adb_device.add_model_arg(parser)
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--background", action="store_true")
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args()
    serial = adb_device.resolve_serial(args.model)
    os.makedirs(args.out_dir, exist_ok=True)
    nodes = adb_device.ui_dump(serial)
    adb_device.dismiss_logbox(serial, nodes)
    regions = regions_from_ui(nodes, screen_size(serial))
    tabs = {t: adb_device.find_tab(nodes, t) for t in ("Orrery", "Digest")}
    runs = []
    for k in range(args.runs):
        runs.append(record_run(serial, regions, tabs, args.background, args.out_dir,
                               f"{'background' if args.background else 'tab'}-run{k + 1}"))
        adb_device.wait_screen_still(serial)
        time.sleep(3.0)
    totals = [r["total_s"] for r in runs if r.get("outcome") == "valid"]
    payload = {"model": args.model, "mode": "background" if args.background else "tab", "regions": regions,
               "runs": runs, "valid_runs": len(totals),
               "median_total_s": statistics.median(totals) if len(totals) == args.runs else "insufficient"}
    with open(os.path.join(args.out_dir, "tab-return.json"), "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    print(json.dumps({k: v for k, v in payload.items() if k != "runs"}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
