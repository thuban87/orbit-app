#!/usr/bin/env python3
"""M1: the Contacts List/Card memory curve (38.13 Plan 01, D-55 / D-13).

What it measures: process-wide `dumpsys meminfo com.bwales.orbit` figures at
fixed points of a scripted Contacts-tab session. Every figure is PROCESS-WIDE
(no thread, no allocation stack). Rows recorded per sample: TOTAL PSS, Native
Heap, Unknown, Dalvik Heap, Java Heap, Graphics, GL mtrack, EGL mtrack, the
"Other (malloced)" and "Bitmap (malloced)" native allocations, and the Views
object count.

Curves (the workpaper §4.0 M1 method):
  --curve list   card idle -> List (+0 / +10 / +30 s) -> Card -> List again ->
                 N sort pairs in List (Name A-Z, then Default; a sample after
                 each pair) -> `am send-trim-memory RUNNING_CRITICAL` -> sample
  --curve card   the control: card idle -> N sort pairs in Card -> trim -> sample
  --curve scroll card idle -> List (settled) -> N scroll cycles (fling to the
                 end of the list and back; a sample after each cycle) -> trim
                 -> sample. Checks whether rows mounting and unmounting while
                 scrolling (a windowed list) grows memory.

Taps go through `uiautomator dump` bounds of the dashboard test IDs
(`dashboard-view-toggle-list/-card`, `dashboard-sort-control`,
`dashboard-sort-option-*`), never fixed coordinates. After every tap the script
waits until the JS thread (`mqt_v_js`) is idle, read from /proc per-thread CPU
(no accessibility client attached while the app is busy); the settle time is
recorded per step and is a JS-THREAD figure.

The phone is resolved by model through adb_device.resolve_serial and every adb
call passes `-s <serial>`. Output: JSON (--out) plus a one-line-per-sample text
table on stdout. Data sets and raw dumps stay under untracked/ (local-first).

Python 3 standard library only.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "orrery-perf"))
import adb_device  # noqa: E402
import thread_cpu  # noqa: E402

PACKAGE = adb_device.PACKAGE

# --- Tunables -------------------------------------------------------------------
LAUNCH_WAIT_S = 18.0          # cold launch -> first UI dump
CARD_IDLE_S = 20.0            # card view idle before the first sample
LIST_SAMPLES_S = (0.0, 10.0, 30.0)  # after the first List tap
POST_SWITCH_DWELL_S = 10.0    # after a view switch has settled, before sampling
POST_TRIM_S = 10.0            # after send-trim-memory
IDLE_JS_PCT = 5.0             # JS thread below this % of one core ...
IDLE_WINDOWS = 3              # ... for this many consecutive windows = settled
IDLE_WINDOW_S = 0.5
IDLE_TIMEOUT_S = 120.0
DEFAULT_PAIRS = 5
FLINGS_PER_HALF_CYCLE = 30    # flings to travel from the top of ~1,000 rows to the end
FLING_MS = 120
FLING_GAP_S = 0.35
SORT_A = "name-asc"
SORT_B = "default"


# --- meminfo --------------------------------------------------------------------
def parse_meminfo(text: str) -> dict:
    """Process-wide figures (KB, Views = count) from `dumpsys meminfo <pkg>`."""

    def table(label: str) -> int | None:
        match = re.search(rf"^\s*{re.escape(label)}\s+(\d+)", text, re.M)
        return int(match.group(1)) if match else None

    def summary(label: str) -> int | None:
        match = re.search(rf"{re.escape(label)}:\s+(\d+)", text)
        return int(match.group(1)) if match else None

    def malloced(label: str) -> tuple[int | None, int | None]:
        match = re.search(rf"{re.escape(label)}:\s+(\d+)\s+(\d+)", text)
        return (int(match.group(1)), int(match.group(2))) if match else (None, None)

    pid = re.search(r"MEMINFO in pid (\d+)", text)
    other_count, other_kb = malloced("Other (malloced)")
    bitmap_count, bitmap_kb = malloced("Bitmap (malloced)")
    return {
        "pid": int(pid.group(1)) if pid else None,
        "total_pss": summary("TOTAL PSS"),
        "native_heap": summary("Native Heap"),
        "java_heap": summary("Java Heap"),
        "graphics": summary("Graphics"),
        "unknown": table("Unknown"),
        "dalvik_heap": table("Dalvik Heap"),
        "gl_mtrack": table("GL mtrack"),
        "egl_mtrack": table("EGL mtrack"),
        "other_malloced_count": other_count,
        "other_malloced_kb": other_kb,
        "bitmap_malloced_count": bitmap_count,
        "bitmap_malloced_kb": bitmap_kb,
        "views": summary("Views"),
    }


MARK_TAG = "contactsperf"


def mark(serial: str, text: str) -> None:
    """A logcat line (tag contactsperf) so app logs can be lined up with steps."""
    safe = re.sub(r"[^A-Za-z0-9_.+:=-]", "_", text)
    adb_device.shell(serial, f"log -t {MARK_TAG} {safe}", check=False)


def sample(serial: str, label: str, t0: float, raw_dir: str | None, results: list) -> dict:
    mark(serial, f"sample:{label}")
    started = time.monotonic() - t0
    text = adb_device.shell(serial, f"dumpsys meminfo {PACKAGE}")
    row = {"label": label, "t_s": round(started, 1), **parse_meminfo(text)}
    if row["pid"] is None:
        raise adb_device.DeviceError(f"{PACKAGE} is not running at sample {label!r} (crashed?)")
    if raw_dir:
        with open(os.path.join(raw_dir, f"meminfo-{len(results):02d}-{label}.txt"), "w", encoding="utf-8") as handle:
            handle.write(text)
    results.append(row)
    print(format_row(row), flush=True)
    return row


def mb(kb: int | None) -> str:
    return "-" if kb is None else f"{kb / 1024:.0f}"


TABLE_HEAD = (
    f"{'sample':<18}{'t_s':>7}{'TOTAL':>8}{'Native':>8}{'Unknown':>8}{'Dalvik':>8}"
    f"{'Graphics':>9}{'GLmtrk':>8}{'OthMal':>8}{'Views':>8}   (MB unless Views; process-wide)"
)


def format_row(row: dict) -> str:
    return (
        f"{row['label']:<18}{row['t_s']:>7}{mb(row['total_pss']):>8}{mb(row['native_heap']):>8}"
        f"{mb(row['unknown']):>8}{mb(row['dalvik_heap']):>8}{mb(row['graphics']):>9}"
        f"{mb(row['gl_mtrack']):>8}{mb(row['other_malloced_kb']):>8}{row['views'] or '-':>8}"
    )


# --- UI helpers -----------------------------------------------------------------
def ui_nodes(serial: str) -> list[dict]:
    """The UI tree (resource-id, desc, text, bounds) via adb_device.ui_dump, which
    retries until uiautomator returns XML. `selected` lives in ui_selected()."""
    nodes = adb_device.ui_dump(serial)
    return [
        {"rid": n.rid, "desc": n.desc, "text": n.text, "bounds": n.bounds, "center": n.center,
         "clickable": n.clickable}
        for n in nodes
    ]


def ui_selected(serial: str) -> dict[str, bool]:
    """resource-id -> selected, for the nodes that carry a dashboard test ID."""
    path = "/sdcard/contactsperf-ui.xml"
    deadline = time.monotonic() + adb_device.UI_DUMP_TIMEOUT_S
    while True:
        xml_text = adb_device.shell(serial, f"uiautomator dump {path} >/dev/null 2>&1 && cat {path}; rm -f {path}")
        start = xml_text.find("<?xml")
        if start >= 0:
            break
        if time.monotonic() >= deadline:
            raise adb_device.DeviceError("uiautomator dump returned no XML")
        time.sleep(adb_device.UI_DUMP_RETRY_S)
    out = {}
    for el in ET.fromstring(xml_text[start:]).iter("node"):
        rid = el.get("resource-id", "")
        if rid:
            out[rid] = el.get("selected") == "true"
    return out


def find_rid(nodes: list[dict], rid: str) -> dict | None:
    return next((n for n in nodes if n["rid"] == rid or n["rid"].endswith(f"/{rid}")), None)


def tap_xy(serial: str, xy: tuple[int, int], label: str = "") -> float:
    if label:
        mark(serial, f"tap:{label}")
    host = time.monotonic()
    adb_device.shell(serial, f"input touchscreen tap {xy[0]} {xy[1]}")
    return host


def require(nodes: list[dict], rid: str) -> tuple[int, int]:
    node = find_rid(nodes, rid)
    if not node:
        raise adb_device.DeviceError(f"{rid!r} not in the UI tree (is the Contacts tab open?)")
    return node["center"]


# --- JS idle --------------------------------------------------------------------
_js_tid_cache: dict[int, int] = {}


def js_tid(serial: str, pid: int) -> int:
    """The tid of the React Native JS thread (comm mqt_v_js / mqt_js)."""
    if pid not in _js_tid_cache:
        snap = thread_cpu.snapshot(serial, pid)
        tids = [tid for tid, t in snap["threads"].items() if t["comm"] in thread_cpu.JS_THREADS]
        if not tids:
            raise adb_device.DeviceError("no mqt_v_js thread in the Orbit process")
        _js_tid_cache[pid] = tids[0]
    return _js_tid_cache[pid]


def js_ticks(serial: str, pid: int, tid: int) -> tuple[float, int] | None:
    """(device uptime s, JS thread utime+stime ticks); None if the process is gone."""
    out = adb_device.shell(serial, f"cat /proc/uptime /proc/{pid}/task/{tid}/stat 2>/dev/null", check=False)
    lines = [line for line in out.splitlines() if line.strip()]
    if len(lines) < 2:
        return None
    parsed = thread_cpu.parse_stat(f"{tid} {lines[1]}")
    return (float(lines[0].split()[0]), parsed[2]) if parsed else None


def wait_js_idle(serial: str, timeout_s: float = IDLE_TIMEOUT_S) -> float:
    """Seconds from the call until the JS thread (mqt_v_js) went quiet: under
    IDLE_JS_PCT of one core for IDLE_WINDOWS consecutive IDLE_WINDOW_S windows.
    Returned value = start of the first quiet window (resolution ~one window).
    JS-THREAD figure."""
    pid = adb_device.app_pid(serial)
    if not pid:
        raise adb_device.DeviceError(f"{PACKAGE} is not running")
    tid = js_tid(serial, pid)
    clk = int(adb_device.shell(serial, "getconf CLK_TCK").strip() or 100)
    began = time.monotonic()
    prev = js_ticks(serial, pid, tid)
    prev_host = began
    quiet_since: float | None = None
    quiet = 0
    while True:
        time.sleep(IDLE_WINDOW_S)
        cur = js_ticks(serial, pid, tid)
        host = time.monotonic()
        if cur is None or prev is None:
            raise adb_device.DeviceError(f"{PACKAGE} exited while waiting for idle (crash?)")
        span = cur[0] - prev[0]
        pct = 100.0 * (cur[1] - prev[1]) / clk / span if span > 0 else 0.0
        if pct < IDLE_JS_PCT:
            if quiet == 0:
                quiet_since = prev_host
            quiet += 1
        else:
            quiet = 0
        prev, prev_host = cur, host
        if quiet >= IDLE_WINDOWS:
            return round(max(0.0, quiet_since - began), 1)
        if host - began > timeout_s:
            raise adb_device.DeviceError(f"JS thread not idle after {timeout_s:.0f} s")


# --- Session --------------------------------------------------------------------
def cold_start(serial: str) -> None:
    adb_device.shell(serial, f"am force-stop {PACKAGE}")
    time.sleep(2)
    adb_device.shell(serial, f"monkey -p {PACKAGE} -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1")
    time.sleep(LAUNCH_WAIT_S)
    adb_device.dismiss_logbox(serial)


def open_contacts(serial: str) -> list[dict]:
    nodes = ui_nodes(serial)
    if not find_rid(nodes, "dashboard-view-toggle-list"):
        adb_device.tap_tab(serial, "Contacts")
        time.sleep(1.0)
        wait_js_idle(serial)
        nodes = ui_nodes(serial)
    require(nodes, "dashboard-view-toggle-list")
    return nodes


def set_view(serial: str, controls: dict, mode: str) -> tuple[float, float]:
    """Tap the view toggle segment; returns (host tap time, JS settle s)."""
    host = tap_xy(serial, controls[f"view-{mode}"], f"view-{mode}")
    return host, wait_js_idle(serial)


def sort_pairs(serial: str, controls: dict, pairs: int, t0: float, raw_dir: str | None,
               results: list, steps: list, view: str) -> None:
    tap_xy(serial, controls["sort"])
    wait_js_idle(serial)
    nodes = ui_nodes(serial)
    option_a = require(nodes, f"dashboard-sort-option-{SORT_A}")
    option_b = require(nodes, f"dashboard-sort-option-{SORT_B}")
    for index in range(1, pairs + 1):
        for mode, xy in ((SORT_A, option_a), (SORT_B, option_b)):
            tap_xy(serial, xy, f"{view}-pair{index}-{mode}")
            settle = wait_js_idle(serial)
            steps.append({"step": f"{view}-pair{index}-{mode}", "js_settle_s": settle})
        selected = ui_selected(serial)
        if not selected.get(f"dashboard-sort-option-{SORT_B}", False):
            steps.append({"step": f"{view}-pair{index}", "warning": "Default not selected after the pair (tap dropped?)"})
        sample(serial, f"{view}-pair{index}", t0, raw_dir, results)
    tap_xy(serial, controls["sort"])  # close the panel
    wait_js_idle(serial)


def run(serial: str, curve: str, pairs: int, cold: bool, raw_dir: str | None) -> dict:
    if cold:
        cold_start(serial)
    nodes = open_contacts(serial)
    controls = {
        "view-list": require(nodes, "dashboard-view-toggle-list"),
        "view-card": require(nodes, "dashboard-view-toggle-card"),
        "sort": require(nodes, "dashboard-sort-control"),
    }
    header = find_rid(nodes, "dashboard-header-count")
    results: list = []
    steps: list = []
    print(TABLE_HEAD, flush=True)
    t0 = time.monotonic()
    _, settle = set_view(serial, controls, "card")
    steps.append({"step": "card", "js_settle_s": settle})
    time.sleep(CARD_IDLE_S)
    sample(serial, "card-idle", t0, raw_dir, results)
    if curve == "scroll":
        _, settle = set_view(serial, controls, "list")
        steps.append({"step": "list", "js_settle_s": settle})
        time.sleep(POST_SWITCH_DWELL_S)
        sample(serial, "list-top", t0, raw_dir, results)
        region = find_rid(nodes, "dashboard-card-results") or find_rid(nodes, "dashboard-root")
        left, top, right, bottom = region["bounds"]
        x = (left + right) // 2
        y_low, y_high = bottom - (bottom - top) // 6, top + (bottom - top) // 6
        for cycle in range(1, pairs + 1):
            for direction, (y0, y1) in (("down", (y_low, y_high)), ("up", (y_high, y_low))):
                mark(serial, f"scroll-cycle{cycle}-{direction}")
                for _ in range(FLINGS_PER_HALF_CYCLE):
                    adb_device.shell(serial, f"input touchscreen swipe {x} {y0} {x} {y1} {FLING_MS}")
                    time.sleep(FLING_GAP_S)
                steps.append({"step": f"scroll-cycle{cycle}-{direction}", "js_settle_s": wait_js_idle(serial)})
            sample(serial, f"scroll-cycle{cycle}", t0, raw_dir, results)
    elif curve == "list":
        tap = tap_xy(serial, controls["view-list"], "view-list-first")
        for at in LIST_SAMPLES_S:
            time.sleep(max(0.0, at - (time.monotonic() - tap)))
            sample(serial, f"list+{at:.0f}s", t0, raw_dir, results)
        steps.append({"step": "list-first", "js_settle_s": wait_js_idle(serial)})
        _, settle = set_view(serial, controls, "card")
        steps.append({"step": "back-to-card", "js_settle_s": settle})
        time.sleep(POST_SWITCH_DWELL_S)
        sample(serial, "card-after-list", t0, raw_dir, results)
        _, settle = set_view(serial, controls, "list")
        steps.append({"step": "list-again", "js_settle_s": settle})
        time.sleep(POST_SWITCH_DWELL_S)
        sample(serial, "list-again", t0, raw_dir, results)
        sort_pairs(serial, controls, pairs, t0, raw_dir, results, steps, "list")
    else:
        sort_pairs(serial, controls, pairs, t0, raw_dir, results, steps, "card")
    adb_device.shell(serial, f"am send-trim-memory {PACKAGE} RUNNING_CRITICAL")
    time.sleep(POST_TRIM_S)
    sample(serial, "after-trim", t0, raw_dir, results)
    # Leave the persisted view on Card so the next cold start opens in Card (not sampled).
    set_view(serial, controls, "card")
    return {
        "curve": curve,
        "pairs": pairs,
        "cold_start": cold,
        "header_count_at_start": header["text"] if header else None,
        "thread_label": "process-wide (dumpsys meminfo); js_settle_s = JS thread (mqt_v_js) idle",
        "samples": results,
        "steps": steps,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    adb_device.add_model_arg(parser)
    parser.add_argument("--curve", choices=["list", "card", "scroll"], required=True)
    parser.add_argument("--pairs", type=int, default=DEFAULT_PAIRS, help="sort pairs, or scroll cycles for --curve scroll")
    parser.add_argument("--cold", action="store_true", help="force-stop and relaunch first")
    parser.add_argument("--label", default="", help="free text recorded in the JSON (build, data set)")
    parser.add_argument("--raw-dir", help="also save each raw dumpsys here")
    parser.add_argument("--out", help="JSON output path")
    args = parser.parse_args()
    serial = adb_device.resolve_serial(args.model)
    if args.raw_dir:
        os.makedirs(args.raw_dir, exist_ok=True)
    result = run(serial, args.curve, args.pairs, args.cold, args.raw_dir)
    payload = {"model": args.model, "label": args.label, **result}
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    print(TABLE_HEAD)
    for row in result["samples"]:
        print(format_row(row))
    return 0


if __name__ == "__main__":
    sys.exit(main())
