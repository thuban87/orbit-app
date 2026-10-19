#!/usr/bin/env python3
"""M7: end-to-end tap latency on the Contacts tab (38.13 Plan 01, D-55 / D-13).

What it measures: the time from a tap reaching the screen to the first frame
that shows the app's response, read from an on-device `screenrecord` video.
Every latency figure is END TO END (touch -> composited frame); it carries NO
thread attribution. With --thread-cpu the same window also gets per-thread CPU
(JS = mqt_v_js, UI = the process main thread, RenderThread), which IS per
thread but says how busy a thread was, not where the latency went.

The audit's method (workpaper §4.0 M7), made scriptable:
  * `screenrecord` runs while an `input touchscreen tap` is injected; the
    device clock is stamped (`date +%s.%N`) right before the tap, as the audit
    did.
  * The tap frame is found in the video itself: Developer options > Pointer
    location is switched on for the run, and its top bar (system_server, not
    the app) redraws when the injected touch arrives, within one frame of touch
    down. latency = PTS(response frame) - PTS(bar frame): one time base, no
    clock mapping. (A real-touch dot via `sendevent` is not possible: SELinux
    denies the shell write to /dev/input on the Pixel 6 Pro, 2026-10-19.)
    `--anchor stamp` falls back to the device stamp vs the recording start
    (+-~0.2 s; flagged in the output). The prior Pointer location value is
    restored afterwards.
  * ffmpeg (/usr/bin/ffmpeg) decodes small grayscale crops; frames are compared
    in Python (standard library only).

Cases:
  --case trigger  tap the Population trigger; response = the panel region
                  changes (panel visible). The panel is closed again after.
  --case option   with the panel open, tap a Population option (--option,
                  default all-contacts) and tap it again (two measurements:
                  tap1, tap2); response = first change anywhere off the touch point,
                  and the list region below the panel (first change, settled,
                  and "intermediate" time when it matches neither the old nor
                  the new list: the A-01 blank).

Taps use `uiautomator dump` bounds of the dashboard test IDs; the phone is
resolved by model through adb_device.resolve_serial and every adb call passes
`-s <serial>`. Videos can contain contact names: keep them under untracked/.
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

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "orrery-perf"))
import adb_device  # noqa: E402
import list_memory  # noqa: E402
import thread_cpu  # noqa: E402

PACKAGE = adb_device.PACKAGE
FFMPEG = os.environ.get("FFMPEG", "/usr/bin/ffmpeg")
FFPROBE = os.environ.get("FFPROBE", "/usr/bin/ffprobe")

# --- Tunables -------------------------------------------------------------------
RECORD_LEAD_S = 1.5        # recording runs this long before the tap
DEFAULT_WINDOW_S = 6.0     # recording runs this long after the tap
VIDEO_SCALE = 2            # screenrecord --size = screen / VIDEO_SCALE
VIDEO_BITRATE = 8_000_000
POINTER_BAR = (140, 192)   # screen rows of the Pointer location bar (Pixel 6 Pro, 2026-10-19)
TAP_MASK_PX = 40           # margin around the tapped control that is ignored (pressed state, pointer trail)
HOLD_MS = 100              # the injected tap is a 100 ms press: down and up both show in the bar
MAX_HOLD_S = 0.6           # the up must follow the down within this
TOP_MASK_PX = 200          # screen px at the top ignored (status bar + Pointer location bar)
PIX_DELTA = 24             # a pixel "changed" if its gray level moves by more than this
BAR_FRACTION = 0.01        # the Pointer location bar changed if this share of its pixels moved
REGION_FRACTION = 0.01     # a region changed if this share of its pixels moved
INTERMEDIATE_FRACTION = 0.05
FULL_W = 120               # width of the whole-screen crop used for "any change"
ROI_W = 96                 # width of a region-of-interest crop


def screen_size(serial: str) -> tuple[int, int]:
    out = adb_device.shell(serial, "wm size")
    match = re.findall(r"(\d+)x(\d+)", out)
    width, height = match[-1]
    return int(width), int(height)


# --- Recording --------------------------------------------------------------------
class Recording:
    def __init__(self, serial: str, screen: tuple[int, int], seconds: float, remote: str):
        self.serial, self.remote = serial, remote
        size = f"{screen[0] // VIDEO_SCALE}x{screen[1] // VIDEO_SCALE}"
        limit = int(seconds) + 8  # pkill stops it earlier; the margin covers the pre-tap CPU snapshot
        adb_device.shell(serial, f"rm -f {remote}")
        stamp = adb_device.shell(serial, "date +%s.%N").strip()
        self.start_stamp = float(stamp)
        self.proc = subprocess.Popen(
            [adb_device.ADB, "-s", serial, "shell",
             f"screenrecord --size {size} --bit-rate {VIDEO_BITRATE} --time-limit {limit} {remote}"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

    def stop(self, local: str) -> None:
        adb_device.shell(self.serial, "pkill -INT screenrecord", check=False)
        try:
            self.proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        time.sleep(1.0)  # let the muxer finish the file
        os.makedirs(os.path.dirname(os.path.abspath(local)), exist_ok=True)
        adb_device.adb(self.serial, "pull", self.remote, local)
        adb_device.shell(self.serial, f"rm -f {self.remote}", check=False)


# --- Video analysis ---------------------------------------------------------------
def frame_times(video: str) -> list[float]:
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries",
         "frame=best_effort_timestamp_time", "-of", "csv=p=0", video],
        capture_output=True, text=True, check=True,
    ).stdout
    return [float(line.strip().strip(",")) for line in out.splitlines() if line.strip().strip(",")]


def crop_frames(video: str, box: tuple[int, int, int, int], out_w: int) -> tuple[list[bytes], tuple[int, int]]:
    """Gray frames of a crop. `box` = (x, y, w, h) in VIDEO pixels."""
    x, y, w, h = box
    out_h = max(1, round(h * out_w / w))
    raw = subprocess.run(
        [FFMPEG, "-v", "error", "-i", video, "-fps_mode", "passthrough", "-vf",
         f"crop={w}:{h}:{x}:{y},scale={out_w}:{out_h}:flags=area,format=gray",
         "-f", "rawvideo", "-"],
        capture_output=True, check=True,
    ).stdout
    size = out_w * out_h
    return [raw[i:i + size] for i in range(0, len(raw) - size + 1, size)], (out_w, out_h)


def changed_fraction(a: bytes, b: bytes, mask: list[bool] | None = None) -> float:
    if mask is None:
        moved = sum(1 for p, q in zip(a, b) if abs(p - q) > PIX_DELTA)
        return moved / len(a)
    total = moved = 0
    for keep, p, q in zip(mask, a, b):
        if keep:
            total += 1
            if abs(p - q) > PIX_DELTA:
                moved += 1
    return moved / total if total else 0.0


def to_video_box(screen_box: tuple[int, int, int, int], video_wh: tuple[int, int],
                 screen: tuple[int, int]) -> tuple[int, int, int, int]:
    sx, sy = video_wh[0] / screen[0], video_wh[1] / screen[1]
    left, top, right, bottom = screen_box
    x, y = max(0, int(left * sx)), max(0, int(top * sy))
    w = max(2, min(video_wh[0] - x, int((right - left) * sx)))
    h = max(2, min(video_wh[1] - y, int((bottom - top) * sy)))
    return x, y, w, h


def video_dims(video: str) -> tuple[int, int]:
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
         "-of", "csv=p=0", video], capture_output=True, text=True, check=True,
    ).stdout.strip().split(",")
    return int(out[0]), int(out[1])


def analyse(video: str, screen: tuple[int, int], tap_box: tuple[int, int, int, int],
            roi: tuple[int, int, int, int] | None, tap_offset_s: float | None) -> dict:
    """Latencies (ms) from touch UP (when a Pressable's onPress fires).

    `tap_box` = SCREEN bounds (l, t, r, b) of the tapped control; it is masked
    (with TAP_MASK_PX margin) so the control's own pressed state and the pointer
    trail never count as the response. `roi` = SCREEN box of the expected
    response. `tap_offset_s` = estimated touch-up time from the start of the
    video (stamp anchor); None = read the Pointer location bar: it changes at
    touch down ("P: 1/1 X: … Y: …") and again at touch up.
    """
    times = frame_times(video)
    vw, vh = video_dims(video)
    result: dict = {"frames": len(times)}
    bar_screen = (0, POINTER_BAR[0], screen[0], POINTER_BAR[1])
    bar_frames, _ = crop_frames(video, to_video_box(bar_screen, (vw, vh), screen), 360)
    n = min(len(times), len(bar_frames))
    down_idx = up_idx = None
    if tap_offset_s is None:
        down_idx = next((i for i in range(1, n)
                         if changed_fraction(bar_frames[i], bar_frames[0]) > BAR_FRACTION), None)
        if down_idx is not None:
            up_idx = next((j for j in range(down_idx + 1, n)
                           if times[j] - times[down_idx] <= MAX_HOLD_S
                           and changed_fraction(bar_frames[j], bar_frames[down_idx]) > BAR_FRACTION), None)
        if up_idx is not None:
            result["tap_anchor"] = "pointer-location bar: touch-up frame"
            result["hold_ms"] = round((times[up_idx] - times[down_idx]) * 1000)
        else:
            result["tap_anchor"] = "pointer-location bar: touch down/up not found"
    else:
        up_t = times[0] + tap_offset_s
        up_idx = next((i for i in range(n) if times[i] >= up_t), None)
        down_idx = up_idx
        result["tap_anchor"] = "device stamp vs recording start (+-~0.2 s)"
    if up_idx is None or not down_idx:
        result["error"] = "tap frame not found"
        return result
    up_t = times[up_idx]
    pre = down_idx - 1  # the last frame before the touch
    left, top, right, bottom = tap_box

    def masked(frame_w: int, frame_h: int, box: tuple[int, int, int, int]) -> list[bool]:
        bx0, by0, bx1, by1 = box
        sx_scale, sy_scale = (bx1 - bx0) / frame_w, (by1 - by0) / frame_h
        out = []
        for row in range(frame_h):
            sy = by0 + (row + 0.5) * sy_scale
            for col in range(frame_w):
                sx = bx0 + (col + 0.5) * sx_scale
                near_tap = (left - TAP_MASK_PX <= sx <= right + TAP_MASK_PX
                            and top - TAP_MASK_PX <= sy <= bottom + TAP_MASK_PX)
                out.append(sy >= TOP_MASK_PX and not near_tap)
        return out

    # Any change off the tapped control (top bars masked), searched from touch down.
    full, (fw, fh) = crop_frames(video, (0, 0, vw, vh), FULL_W)
    full_mask = masked(fw, fh, (0, 0, screen[0], screen[1]))
    first_any = next((i for i in range(down_idx, min(n, len(full)))
                      if changed_fraction(full[i], full[pre], full_mask) > REGION_FRACTION), None)
    result["first_change_any_ms"] = round((times[first_any] - up_t) * 1000) if first_any else None
    # Region of interest: first change, last change (settled), and "intermediate"
    # time when it matches neither the frame before the touch nor the final frame.
    if roi:
        frames, (rw, rh) = crop_frames(video, to_video_box(roi, (vw, vh), screen), ROI_W)
        roi_mask = masked(rw, rh, roi)
        m = min(n, len(frames))
        first = next((i for i in range(down_idx, m)
                      if changed_fraction(frames[i], frames[pre], roi_mask) > REGION_FRACTION), None)
        last = None
        for i in range(down_idx + 1, m):
            if changed_fraction(frames[i], frames[i - 1], roi_mask) > REGION_FRACTION:
                last = i
        final = frames[m - 1]
        inter_s = 0.0
        for i in range(up_idx, m - 1):
            if (changed_fraction(frames[i], frames[pre], roi_mask) > INTERMEDIATE_FRACTION
                    and changed_fraction(frames[i], final, roi_mask) > INTERMEDIATE_FRACTION):
                inter_s += times[i + 1] - times[i]
        result.update({
            "roi_first_change_ms": round((times[first] - up_t) * 1000) if first else None,
            "roi_settled_ms": round((times[last] - up_t) * 1000) if last else None,
            "roi_intermediate_ms": round(inter_s * 1000),
            "roi_changed_at_all": first is not None,
            "roi_still_changing_at_end": last is not None and last >= m - 2,
        })
    return result


# --- Session ----------------------------------------------------------------------
def bounds_of(serial: str, rids: list[str]) -> dict[str, tuple[int, int, int, int]]:
    nodes = adb_device.ui_dump(serial)
    out = {}
    for rid in rids:
        node = next((n for n in nodes if n.rid == rid or n.rid.endswith(f"/{rid}")), None)
        if node:
            out[rid] = node.bounds
    return out


def center(box: tuple[int, int, int, int]) -> tuple[int, int]:
    return (box[0] + box[2]) // 2, (box[1] + box[3]) // 2


def measure_tap(serial: str, ctx: dict, box: tuple[int, int, int, int], xy: tuple[int, int], roi_fn, label: str,
                window_s: float, video_dir: str, rep: int, want_cpu: bool) -> dict:
    remote = "/sdcard/contactsperf-lat.mp4"
    rec = Recording(serial, ctx["screen"], RECORD_LEAD_S + window_s, remote)
    time.sleep(RECORD_LEAD_S)
    pid = adb_device.app_pid(serial)
    cpu_first = thread_cpu.snapshot(serial, pid) if want_cpu else None
    list_memory.mark(serial, f"tap:{label}:rep{rep}")
    command = f"date +%s.%N; input touchscreen swipe {xy[0]} {xy[1]} {xy[0]} {xy[1]} {HOLD_MS}"
    tap_stamp = float(adb_device.shell(serial, command).split()[0])
    time.sleep(window_s)
    cpu = None
    if want_cpu:
        clk = int(adb_device.shell(serial, "getconf CLK_TCK").strip() or 100)
        computed = thread_cpu.compute(cpu_first, thread_cpu.snapshot(serial, pid), clk, pid)
        cpu = {k: computed[k] for k in ("window_s", "js", "main_ui", "render_thread", "gc", "total")}
    local = os.path.join(video_dir, f"{label}-rep{rep}.mp4")
    rec.stop(local)
    if not adb_device.app_pid(serial):
        raise adb_device.DeviceError(f"{PACKAGE} exited during {label} (crash?)")
    roi = roi_fn()
    offset = None if ctx["anchor"] == "pointer-location" else tap_stamp + HOLD_MS / 1000 - rec.start_stamp
    row = {"case": label, "rep": rep, "device_tap_stamp": tap_stamp, "video": os.path.basename(local),
           "tap_box": list(box), "roi": list(roi) if roi else None,
           **analyse(local, ctx["screen"], box, roi, offset)}
    if cpu:
        row["thread_cpu_pct_of_one_core"] = cpu
    return row


def run(serial: str, args) -> dict:
    ctx = {"screen": screen_size(serial), "anchor": args.anchor}
    prior_pointer = adb_device.shell(serial, "settings get system pointer_location").strip()
    if args.anchor == "pointer-location":
        adb_device.shell(serial, "settings put system pointer_location 1")
        time.sleep(1.0)
    rows: list = []
    try:
        if args.cold:
            list_memory.cold_start(serial)
        nodes = list_memory.open_contacts(serial)
        view_xy = list_memory.require(nodes, f"dashboard-view-toggle-{args.view}")
        list_memory.tap_xy(serial, view_xy)
        list_memory.wait_js_idle(serial)
        b = bounds_of(serial, ["dashboard-population-control", "dashboard-root", "dashboard-header-count"])
        trigger = b["dashboard-population-control"]
        root = b["dashboard-root"]
        os.makedirs(args.video_dir, exist_ok=True)
        for rep in range(1, args.reps + 1):
            if args.case == "trigger":
                panel_box: dict = {}

                def roi_trigger() -> tuple[int, int, int, int]:
                    found = bounds_of(serial, ["dashboard-population-panel"])
                    panel_box.update(found)
                    box = found.get("dashboard-population-panel")
                    # Fallback: the band under the trigger where the panel opens.
                    return box or (root[0], trigger[3] + 10, root[2], trigger[3] + 700)

                row = measure_tap(serial, ctx, trigger, center(trigger), roi_trigger, f"{args.view}-trigger",
                                  args.window, args.video_dir, rep, args.thread_cpu)
                row["panel_opened"] = "dashboard-population-panel" in panel_box
                rows.append(row)
                list_memory.tap_xy(serial, center(trigger))  # close
                list_memory.wait_js_idle(serial)
                if bounds_of(serial, ["dashboard-population-panel"]):
                    raise adb_device.DeviceError("the Population panel did not close")
            else:
                if not bounds_of(serial, ["dashboard-population-panel"]):
                    list_memory.tap_xy(serial, center(trigger))
                    list_memory.wait_js_idle(serial)
                ob = bounds_of(serial, ["dashboard-population-panel", f"dashboard-population-option-{args.option}"])
                panel = ob["dashboard-population-panel"]
                option = ob[f"dashboard-population-option-{args.option}"]
                list_roi = (root[0], panel[3] + 10, root[2], root[3] - 10)
                if list_roi[3] - list_roi[1] < 200:
                    list_roi = None
                # Tap the option's left quarter (the pressed state stays near the tap).
                xy = (option[0] + (option[2] - option[0]) // 4, (option[1] + option[3]) // 2)
                for direction in ("tap1", "tap2"):
                    row = measure_tap(serial, ctx, option, xy, lambda: list_roi, f"{args.view}-option-{args.option}-{direction}",
                                      args.window, args.video_dir, rep, args.thread_cpu)
                    row["settle_js_s"] = list_memory.wait_js_idle(serial)
                    rows.append(row)
                list_memory.tap_xy(serial, center(trigger))  # close the panel
                list_memory.wait_js_idle(serial)
        # Leave the persisted view on Card so the next cold start opens in Card.
        list_memory.tap_xy(serial, list_memory.require(list_memory.ui_nodes(serial), "dashboard-view-toggle-card"))
        list_memory.wait_js_idle(serial)
    finally:
        if prior_pointer in ("", "null"):
            adb_device.shell(serial, "settings delete system pointer_location", check=False)
        else:
            adb_device.shell(serial, f"settings put system pointer_location {prior_pointer}", check=False)
    summary = {}
    for key in ("first_change_any_ms", "roi_first_change_ms", "roi_settled_ms", "roi_intermediate_ms"):
        by_case: dict[str, list] = {}
        for row in rows:
            if row.get(key) is not None:
                by_case.setdefault(row["case"], []).append(row[key])
        summary[key] = {case: {"median": statistics.median(v), "values": v} for case, v in by_case.items()}
    return {
        "case": args.case, "view": args.view, "anchor": args.anchor, "reps": args.reps,
        "window_s": args.window, "screen": ctx["screen"],
        "thread_label": "latency = end to end (touch -> composited frame), no thread attribution; "
                        "thread_cpu_pct_of_one_core = per-thread CPU over the window (JS = mqt_v_js, UI = main)",
        "rows": rows, "summary": summary,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    adb_device.add_model_arg(parser)
    parser.add_argument("--case", choices=["trigger", "option"], required=True)
    parser.add_argument("--view", choices=["list", "card"], required=True)
    parser.add_argument("--option", default="all-contacts", help="Population option key for --case option")
    parser.add_argument("--reps", type=int, default=3)
    parser.add_argument("--window", type=float, default=DEFAULT_WINDOW_S, help="seconds recorded after the tap")
    parser.add_argument("--anchor", choices=["pointer-location", "stamp"], default="pointer-location")
    parser.add_argument("--thread-cpu", action="store_true", help="per-thread CPU over each window")
    parser.add_argument("--video-dir", required=True, help="where the recordings go (keep under untracked/)")
    parser.add_argument("--label", default="")
    parser.add_argument("--cold", action="store_true", help="force-stop and relaunch first")
    parser.add_argument("--out")
    parser.add_argument("--reanalyse", metavar="RUN_JSON",
                        help="re-run the video analysis of a saved run in place (no phone needed)")
    parser.add_argument("--box", help="JSON [l,t,r,b] tapped-control box for rows that lack one")
    parser.add_argument("--roi", help="JSON [l,t,r,b] response region for rows that lack one")
    parser.add_argument("--analyse", nargs=3, metavar=("VIDEO", "TAP_X", "TAP_Y"),
                        help="re-analyse a saved recording (screen size read from the phone)")
    args = parser.parse_args()
    serial = adb_device.resolve_serial(args.model)
    if args.reanalyse:
        data = json.load(open(args.reanalyse, encoding="utf-8"))
        base = os.path.dirname(os.path.abspath(args.reanalyse))
        screen = tuple(data["screen"])
        for row in data["rows"]:
            video = os.path.join(args.video_dir or base, row["video"])
            box = tuple(row.get("tap_box") or json.loads(args.box))
            roi = row.get("roi") or (json.loads(args.roi) if args.roi else None)
            row.update(analyse(video, screen, box, tuple(roi) if roi else None, None))
            row["tap_box"], row["roi"] = list(box), list(roi) if roi else None
        data["reanalysed"] = True
        with open(args.reanalyse, "w", encoding="utf-8") as handle:
            handle.write(json.dumps(data, indent=2, sort_keys=True) + "\n")
        for row in data["rows"]:
            print(row["case"], row["rep"], row.get("first_change_any_ms"), row.get("roi_first_change_ms"),
                  row.get("roi_settled_ms"), row.get("roi_intermediate_ms"))
        return 0
    if args.analyse:
        video, x, y = args.analyse
        x, y = int(x), int(y)
        print(json.dumps(analyse(video, screen_size(serial), (x, y, x, y), None, None), indent=2))
        return 0
    result = {"model": args.model, "label": args.label, **run(serial, args)}
    text = json.dumps(result, indent=2, sort_keys=True)
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as handle:
            handle.write(text + "\n")
    for row in result["rows"]:
        print(f"{row['case']:<34} rep{row['rep']}  any={row.get('first_change_any_ms')} ms  "
              f"roi_first={row.get('roi_first_change_ms')} ms  roi_settled={row.get('roi_settled_ms')} ms  "
              f"intermediate={row.get('roi_intermediate_ms')} ms  [{row.get('tap_anchor')}; end to end]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
