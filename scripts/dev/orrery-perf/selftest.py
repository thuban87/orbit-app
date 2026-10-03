#!/usr/bin/env python3
"""Canned-output self-test for every Orrery perf parser (38.7 Plan 01). No phone.

Each check prints one PASS line (or FAIL with the reason) and the script exits
non-zero on any failure. Fixtures live in ./fixtures: real-format dumps where
the format matters and no contact data is involved (meminfo, getevent -pl,
dumpsys input), synthetic ones otherwise. The session, scenario and manifest
fixtures are generated deterministically by `selftest.py --regenerate` and
committed, so the test reads canned files like every other parser check.
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import tempfile
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures")
sys.path.insert(0, HERE)

import adb_device  # noqa: E402
import anr_check  # noqa: E402
import fixture_manifest  # noqa: E402
import meminfo_d11  # noqa: E402
import sf_sampler  # noqa: E402
import thread_cpu  # noqa: E402
import touch_windows  # noqa: E402

S = 1_000_000_000
CHECKS: list[tuple[str, object]] = []


def check(name: str):
    def wrap(fn):
        CHECKS.append((name, fn))
        return fn

    return wrap


def read(name: str) -> str:
    with open(os.path.join(FIX, name), encoding="utf-8") as handle:
        return handle.read()


def load(name: str) -> dict:
    return json.loads(read(name))


def eq(actual, expected, what: str = "") -> None:
    if actual != expected:
        raise AssertionError(f"{what} expected {expected!r}, got {actual!r}")


# --- Fixture generation (deterministic; run with --regenerate) ----------------
def _ge(ts: float, etype: str, code: str, value: str) -> str:
    return f"[{ts:14.6f}] {etype:<12} {code:<20} {value}"


def _down(ts: float, slot: int, tid: int) -> list[str]:
    return [_ge(ts, "EV_ABS", "ABS_MT_SLOT", f"{slot:08x}"),
            _ge(ts, "EV_ABS", "ABS_MT_TRACKING_ID", f"{tid:08x}"),
            _ge(ts, "EV_ABS", "ABS_MT_POSITION_X", f"{300 + 200 * slot:08x}"),
            _ge(ts, "EV_ABS", "ABS_MT_POSITION_Y", f"{900:08x}")]


def _up(ts: float, slot: int) -> list[str]:
    return [_ge(ts, "EV_ABS", "ABS_MT_SLOT", f"{slot:08x}"),
            _ge(ts, "EV_ABS", "ABS_MT_TRACKING_ID", "ffffffff")]


def _syn(ts: float) -> str:
    return _ge(ts, "EV_SYN", "SYN_REPORT", "00000000")


def _gesture(start: float, end: float, fingers: int, tid: int) -> list[tuple[float, list[str]]]:
    """Frames of (ts, lines-before-SYN). A pinch's second finger lands 0.2 s
    after the first and lifts 0.2 s before it, as real pinches do."""
    frames = []
    if fingers == 1:
        frames.append((start, _down(start, 0, tid) + [_ge(start, "EV_KEY", "BTN_TOUCH", "DOWN")]))
        t = start + 0.1
        while t < end - 1e-9:
            frames.append((t, [_ge(t, "EV_ABS", "ABS_MT_POSITION_X", f"{int(300 + 50 * (t - start)):08x}")]))
            t += 0.1
        frames.append((end, _up(end, 0) + [_ge(end, "EV_KEY", "BTN_TOUCH", "UP")]))
    else:
        lead = start - 0.2
        frames.append((lead, _down(lead, 0, tid) + [_ge(lead, "EV_KEY", "BTN_TOUCH", "DOWN")]))
        frames.append((start, _down(start, 1, tid + 1)))
        t = start + 0.1
        while t < end - 1e-9:
            frames.append((t, [_ge(t, "EV_ABS", "ABS_MT_SLOT", "00000001"),
                               _ge(t, "EV_ABS", "ABS_MT_POSITION_X", f"{int(500 + 40 * (t - start)):08x}")]))
            t += 0.1
        frames.append((end, _up(end, 1)))
        frames.append((end + 0.2, _up(end + 0.2, 0) + [_ge(end + 0.2, "EV_KEY", "BTN_TOUCH", "UP")]))
    return frames


PATTERN = [("pan", 1.0, 4.0), ("pinch", 5.5, 8.5), ("pan", 10.0, 13.0),
           ("pinch", 14.5, 17.5), ("pan", 19.0, 22.0), ("pinch", 23.5, 26.5)]


def _segment_frames(seg_start: float, drop_last: bool = False, tid0: int = 100) -> list:
    frames = []
    pattern = PATTERN[:-1] if drop_last else PATTERN
    for i, (kind, a, b) in enumerate(pattern):
        frames += _gesture(seg_start + a, seg_start + b, 1 if kind == "pan" else 2, tid0 + 2 * i)
    return frames


def _write_session(name: str, segments: list[dict], frames: list, sf: dict, description: str) -> None:
    lines = []
    for ts, body in sorted(frames, key=lambda f: f[0]):
        lines += body + [_syn(ts)]
    with open(os.path.join(FIX, f"{name}.getevent.txt"), "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")
    payload = {"description": description, "getevent": f"{name}.getevent.txt", "reps": 3,
               "calibration": {"method": "clock-identity", "status": "aligned", "offset_ms": 0.0},
               "segments": segments, "sf": sf}
    with open(os.path.join(FIX, f"{name}.json"), "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def _seg(system: str, boundary: float, end: float, layer_present: bool = True) -> dict:
    return {"system": system, "boundary_ns": int(boundary * S), "start_ns": int((boundary + 3) * S),
            "end_ns": int(end * S), "layer_present": layer_present}


def _sf(runs: list[list[float]], holes: list[list[float]] | None = None) -> dict:
    return {"first_poll_ns": int(1000.5 * S), "last_poll_ns": int(1079.5 * S),
            "holes": [[int(a * S), int(b * S)] for a, b in (holes or [])],
            "present_runs": [[int(a * S), int(b * S), int(p * S)] for a, b, p in runs]}


def regenerate() -> None:
    two = [_seg("Size 120", 1001, 1037), _seg("All Contacts", 1040, 1076)]
    _write_session("session-labelled", two, _segment_frames(1004) + _segment_frames(1043, tid0=300),
                   _sf([[1000, 1040, 0.020], [1040, 1080, 0.025]]),
                   "Two Systems, 3 pan + 3 pinch each; Size 120 presents at 50/s, All Contacts at 40/s.")
    _write_session("session-missing-rep", [_seg("Size 120", 1001, 1037)], _segment_frames(1004, drop_last=True),
                   _sf([[1000, 1080, 0.020]]), "Third pinch missing: the segment is unlabelled.")
    _write_session("session-poll-hole", [_seg("Size 120", 1001, 1037)], _segment_frames(1004),
                   _sf([[1000, 1080, 0.020]], holes=[[1015.5, 1016.5]]),
                   "A sampler coverage hole overlaps pan r2 (1014-1017 s): that window is truncated.")
    _write_session("session-no-present", [_seg("Size 120", 1001, 1037)], _segment_frames(1004),
                   _sf([[1000, 1027.4, 0.020], [1030.8, 1080, 0.020]]),
                   "No presents during pinch r3 (1027.5-1030.5 s); the layer flag decides 0 vs invalid.")

    # Scenario drivers: a 170 ms present gap 0.38 s after a switch tap (integer ns, no float drift).
    switch = {"tap_ns": 1010 * S, "window_s": 2.6,
              "present_runs": [[1009 * S, 1010_400_000_000, 20_000_000],
                               [1010_550_000_000, 1013 * S, 20_000_000]],
              "expect_max_gap_ms": 170.0}
    with open(os.path.join(FIX, "switch-gap.json"), "w", encoding="utf-8") as handle:
        json.dump(switch, handle, indent=2)
        handle.write("\n")


# --- Checks -------------------------------------------------------------------
def expand(sf: dict) -> dict:
    presents = []
    for a, b, period in sf["present_runs"]:
        t = a
        while t < b:
            presents.append(t)
            t += period
    return {**sf, "presents": presents}


def session(name: str) -> dict:
    meta = load(f"{name}.json")
    return {**meta, "events": touch_windows.parse_getevent(read(meta["getevent"])), "sf": expand(meta["sf"])}


@check("adb_device: resolve_serial picks one phone by model, refuses zero or several")
def _():
    text = ("List of devices attached\n"
            "1AAA device usb:2-1 product:raven model:Pixel_6_Pro device:raven transport_id:31\n"
            "9BBB device usb:1-1 product:sargo model:Pixel_3a device:sargo transport_id:32\n"
            "7CCC unauthorized usb:1-2 transport_id:33\n")
    eq(adb_device.resolve_serial("Pixel 6 Pro", text), "1AAA")
    eq(adb_device.resolve_serial("Pixel_3a", text), "9BBB")
    for bad, doc in (("Pixel 8", text), ("Pixel_3a", text + "9DDD device model:Pixel_3a\n")):
        try:
            adb_device.resolve_serial(bad, doc)
        except adb_device.DeviceError:
            continue
        raise AssertionError(f"resolve_serial({bad!r}) should refuse")


@check("adb_device: monotonic mark parse from logcat -v monotonic")
def _():
    text = "--------- beginning of main\n 54268.518 13638 13638 I orbperf : mark-abc123\n"
    eq(adb_device.parse_monotonic_mark(text, "mark-abc123"), 54268.518)


@check("sf_sampler: layer choice picks the highest live SurfaceView, else the window layer")
def _():
    eq(sf_sampler.detect_layer(read("sf-list-android16.txt")),
       {"kind": "surfaceview", "name": "af4204d SurfaceView[com.bwales.orbit/com.bwales.orbit.MainActivity](BLAST)#45128"})
    eq(sf_sampler.detect_layer(read("sf-list-android16-textureview.txt")),
       {"kind": "window", "name": "VRI-com.bwales.orbit/com.bwales.orbit.MainActivity#45004"})
    eq(sf_sampler.detect_layer(read("sf-list-android12.txt")),
       {"kind": "window", "name": "com.bwales.orbit/com.bwales.orbit.MainActivity#0"})
    eq(sf_sampler.layer_present(read("sf-list-android16.txt"),
                                "af4204d SurfaceView[com.bwales.orbit/com.bwales.orbit.MainActivity](BLAST)#45128"), True)


@check("sf_sampler: --latency parse keeps actual presents, drops 0 and INT64_MAX rows")
def _():
    period, presents, rows = sf_sampler.parse_latency(read("sf-latency.txt"))
    eq(period, 16666667, "period")
    eq(presents, [1000010000000, 1000026666667, 1000043333334, 1000093333335], "presents")
    eq(rows, 5, "filled rows")


@check("sf_sampler: hole detection when a full history no longer overlaps")
def _():
    sampler = sf_sampler.Sampler.__new__(sf_sampler.Sampler)
    sampler.presents, sampler.polls, sampler.holes, sampler.period_ns = set(), [], [], None
    sampler.clock = adb_device.ClockMap(0.0, 1.0)
    first = "8333333\n" + "\n".join(f"{t} {t + 5} {t}" for t in range(1000, 1000 + 127 * 10, 10))
    sampler.poll_once(first, 1.0)
    overlap = "8333333\n" + "\n".join(f"{t} {t + 5} {t}" for t in range(1500, 1500 + 127 * 10, 10))
    sampler.poll_once(overlap, 1.5)
    eq(sampler.holes, [], "overlapping polls")
    gap = "8333333\n" + "\n".join(f"{t} {t + 5} {t}" for t in range(9000, 9000 + 127 * 10, 10))
    sampler.poll_once(gap, 2.0)
    eq(sampler.holes, [[2765, 9005]], "hole")


@check("sf_sampler: presents/s, median per 1 s bin, interval stats, max gap")
def _():
    ts = [int(1000 * S + k * 0.02 * S) for k in range(200)]  # 50/s for 4 s
    eq(round(sf_sampler.presents_per_second(ts, 1000 * S, 1002 * S), 3), 50.0)
    eq(sf_sampler.median_presents_per_second(ts, 1000 * S, 1003 * S), 50.0)
    eq(sf_sampler.median_presents_per_second(ts, 1000 * S, int(1000.5 * S)), None, "short window")
    stats = sf_sampler.interval_stats(ts)
    eq((stats["p50"], stats["max"]), (20.0, 20.0))
    gapped = [t for t in ts if not (1001.1 * S < t < 1001.5 * S)]
    eq(sf_sampler.max_gap_ms(gapped, 1001 * S, 1002 * S), 400.0)  # presents at 1001.1 and 1001.5 s remain
    eq(sf_sampler.max_gap_ms(gapped, 2000 * S, 2001 * S), None, "no presents")


@check("touch_windows: touchscreen found from getevent -pl on both phones")
def _():
    eq(touch_windows.find_touch_device(read("getevent-pl-pixel6pro.txt")), "/dev/input/event3")
    eq(touch_windows.find_touch_device(read("getevent-pl-pixel3a.txt")), "/dev/input/event2")


@check("touch_windows: one-slot pan and two-slot pinch windows from a getevent trace")
def _():
    run = session("session-labelled")
    found = [touch_windows.classify(g) for g in
             touch_windows.gestures(touch_windows.touch_changes(run["events"]))]
    kinds = [w["kind"] for w in found]
    eq(kinds, ["pan", "pinch"] * 6, "kinds")
    eq((found[0]["start"], found[0]["end"]), (1005 * S, 1008 * S), "pan span")
    eq((found[1]["start"], found[1]["end"]), (int(1009.5 * S), int(1012.5 * S)), "pinch two-finger span")


@check("touch_windows: labelled session gives {System}/{pan|pinch}/r{n} and label medians")
def _():
    run = session("session-labelled")
    out = touch_windows.analyse(run["events"], run["sf"], run["segments"], run["calibration"], run["reps"])
    labels = [w["label"] for seg in out["segments"] for w in seg["windows"]]
    eq(labels[:6], ["Size 120/pan/r1", "Size 120/pinch/r1", "Size 120/pan/r2",
                    "Size 120/pinch/r2", "Size 120/pan/r3", "Size 120/pinch/r3"])
    eq(labels[6], "All Contacts/pan/r1")
    eq(out["labels"]["Size 120/pan"]["median"], 50.0)
    eq(out["labels"]["Size 120/pinch"]["median"], 50.0)
    eq(out["labels"]["All Contacts/pan"]["median"], 40.0)
    eq(out["labels"]["All Contacts/pinch"]["reps"], {"r1": 40.0, "r2": 40.0, "r3": 40.0})


@check("touch_windows: a missing repetition makes the segment unlabelled and labels insufficient")
def _():
    run = session("session-missing-rep")
    out = touch_windows.analyse(run["events"], run["sf"], run["segments"], run["calibration"], run["reps"])
    eq(out["segments"][0]["status"], "unlabelled")
    eq(out["labels"]["Size 120/pan"]["median"], "insufficient")
    eq(out["labels"]["Size 120/pinch"]["median"], "insufficient")


@check("touch_windows: a window over a sampler coverage hole is truncated, never a number")
def _():
    run = session("session-poll-hole")
    out = touch_windows.analyse(run["events"], run["sf"], run["segments"], run["calibration"], run["reps"])
    eq(out["labels"]["Size 120/pan"]["reps"]["r2"], "truncated")
    eq(out["labels"]["Size 120/pan"]["median"], "insufficient")
    eq(out["labels"]["Size 120/pinch"]["median"], 50.0)
    eq(out["outcome_counts"]["truncated"], 1)


@check("touch_windows: zero-present window counts 0 only while the layer persisted, else invalid")
def _():
    run = session("session-no-present")
    kept = touch_windows.analyse(run["events"], run["sf"], run["segments"], run["calibration"], run["reps"])
    eq(kept["labels"]["Size 120/pinch"]["reps"]["r3"], 0.0)
    eq(kept["labels"]["Size 120/pinch"]["median"], 50.0)
    eq(kept["outcome_counts"]["no-present"], 1)
    gone = [{**s, "layer_present": False} for s in run["segments"]]
    lost = touch_windows.analyse(run["events"], run["sf"], gone, run["calibration"], run["reps"])
    eq(lost["segments"][0]["status"], "invalid")
    eq(lost["labels"]["Size 120/pinch"]["median"], "insufficient")


@check("touch_windows: an unaligned calibration refuses to label any window")
def _():
    run = session("session-labelled")
    out = touch_windows.analyse(run["events"], run["sf"], run["segments"],
                                {"status": "unaligned", "method": "clock-identity"}, run["reps"])
    eq("refused" in out and "labels" not in out, True)
    eq("refused" in touch_windows.analyse(run["events"], run["sf"], run["segments"], None), True)


@check("touch_windows: calibration parse — dispatcher eventTime and the production age-only format")
def _():
    eq(touch_windows.parse_dispatcher_down_time(read("dumpsys-input-eventtime.txt")), 1001250400000)
    eq(touch_windows.parse_dispatcher_down_time(read("dumpsys-input-production.txt")), None)
    aligned = touch_windows.decide_calibration([{"getevent_ns": 1001251000000, "dispatcher_ns": 1001250400000}] * 3)
    eq((aligned["method"], aligned["status"], aligned["offset_ms"]), ("dispatcher-eventtime", "aligned", 0.0))
    shifted = [{"getevent_ns": 1001250400000 + int(o * 1e6), "dispatcher_ns": 1001250400000} for o in (7.1, 7.9, 8.0)]
    eq(touch_windows.decide_calibration(shifted)["status"], "corrected")
    eq(touch_windows.decide_calibration(shifted)["offset_ms"], 7.9)
    eq(touch_windows.decide_calibration(shifted[:1])["status"], "unaligned", "one tap cannot prove a correction")
    noisy = [{"getevent_ns": 1001250400000 + int(o * 1e6), "dispatcher_ns": 1001250400000} for o in (3, 9, 15)]
    eq(touch_windows.decide_calibration(noisy)["status"], "unaligned")
    # Clock identity (6 Pro values seen 2026-10-03: boottime ~279,000 s ahead of monotonic).
    mono = [{"getevent_ns": int(474663.0 * S), "dispatcher_ns": None, "monotonic_s": 474663.4, "boottime_s": 753513.9}] * 3
    eq(touch_windows.decide_calibration(mono)["status"], "aligned")
    boot = [{"getevent_ns": int(753513.5 * S), "dispatcher_ns": None, "monotonic_s": 474663.4, "boottime_s": 753513.9}] * 3
    eq(touch_windows.decide_calibration(boot)["status"], "unaligned")
    real = [{"getevent_ns": int(1.79e9 * S), "dispatcher_ns": None, "monotonic_s": 474663.4, "boottime_s": 753513.9}]
    eq(touch_windows.decide_calibration(real)["tap_clocks"], ["realtime"])


@check("thread_cpu: per-thread % of one core from two /proc snapshots")
def _():
    a = thread_cpu.parse_snapshot(read("proc-stat-1.txt"))
    b = thread_cpu.parse_snapshot(read("proc-stat-2.txt"))
    out = thread_cpu.compute(a, b, 100, 4321)
    eq(out["window_s"], 10.0)
    eq(out["main_ui"], 30.0, "main")
    eq(out["render_thread"], 10.0, "RenderThread")
    eq(out["js"], 12.0, "JS")
    eq(out["gc"], 2.0, "GC")
    eq(out["total"], 55.0, "total")
    eq(any(r["comm"] == "OkHttp Dispatch" and r["cpu_pct"] == 1.0 for r in out["threads"]), True, "comm with space")


@check("meminfo_d11: rows from a real dumpsys meminfo (38.6 D-11 parse)")
def _():
    eq(meminfo_d11.parse_meminfo(read("meminfo.txt")),
       {"pid": 18623, "gl_mtrack": 301644, "egl_mtrack": 132748, "graphics": 434392,
        "native_heap": 611492, "total_pss": 1291716})


@check("meminfo_d11: D-11 summary medians and the <= 5 % judgement")
def _():
    def run(g, gl, nh):
        return {"samples": {s: {"graphics": g, "gl_mtrack": gl, "native_heap": nh, "total_pss": 1_000_000,
                                "egl_mtrack": 132748} for s in ("peak", "settled", "late")}}
    ref = meminfo_d11.summarise([run(100, 200, 500), run(110, 210, 520), run(90, 190, 480)])
    eq(ref["medians"]["settled"]["graphics"], 100)
    good = meminfo_d11.summarise([run(104, 209, 600), run(103, 200, 600), run(105, 220, 600)], ref)
    eq(good["pass"], True)
    settled_gl = next(e for e in good["judged"] if e["metric"] == "gl_mtrack" and e["sample"] == "settled")
    eq(settled_gl["change_pct"], 4.5)
    eq(any(e["metric"] == "native_heap" and "pass" not in e for e in good["reported"]), True, "native reported only")
    bad = meminfo_d11.summarise([run(120, 200, 500)] * 3, ref)
    eq(bad["pass"], False)


@check("anr_check: am_anr count for the app and Davey/Skipped lines for its pid")
def _():
    events = anr_check.parse_events(read("logcat-events.txt"))
    eq((events["am_anr_total"], events["am_anr_app"]), (1, 1))
    main = anr_check.parse_main(read("logcat-main.txt"), 4321)
    eq((main["davey"], main["skipped_reports"], main["skipped_frames_total"], main["skipped_frames_max"]),
       (1, 2, 49, 42))


def _jpeg(width: int, height: int, payload: str) -> bytes:
    comment = payload.encode()
    sof = bytes([8]) + height.to_bytes(2, "big") + width.to_bytes(2, "big") + bytes([3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1])
    return (b"\xff\xd8" + b"\xff\xfe" + (len(comment) + 2).to_bytes(2, "big") + comment
            + b"\xff\xc0" + (len(sof) + 2).to_bytes(2, "big") + sof + b"\xff\xd9")


def _manifest_db(tmp: str, variant: str) -> tuple[str, str]:
    db_path = os.path.join(tmp, variant, "orbit.db")
    os.makedirs(os.path.join(tmp, variant, "avatars"), exist_ok=True)
    db = sqlite3.connect(db_path)
    db.executescript(read("manifest-schema.sql"))
    db.executescript(read(f"manifest-{variant}.sql"))
    db.commit()
    db.close()
    for path, spec in load("manifest-photos.json")[variant].items():
        with open(os.path.join(tmp, variant, path), "wb") as handle:
            handle.write(_jpeg(spec["width"], spec["height"], spec["payload"]))
    return db_path, os.path.join(tmp, variant)


@check("fixture_manifest: image header sizes (JPEG/PNG/WebP)")
def _():
    eq(fixture_manifest.image_size(_jpeg(256, 192, "x")), (256, 192))
    png = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\x0dIHDR" + (512).to_bytes(4, "big") + (384).to_bytes(4, "big")
    eq(fixture_manifest.image_size(png), (512, 384))
    vp8x = b"RIFF\x00\x00\x00\x00WEBPVP8X" + b"\x0a\x00\x00\x00" + b"\x00\x00\x00\x00" + (1023).to_bytes(3, "little") + (767).to_bytes(3, "little")
    eq(fixture_manifest.image_size(vp8x), (1024, 768))


@check("fixture_manifest: compare reports exactly membership, photo hash, satellites and ring order")
def _():
    plan = load("manifest-spec.json")
    with tempfile.TemporaryDirectory() as tmp:
        a = fixture_manifest.build_manifest(*_manifest_db(tmp, "a"), plan, "2026-10-04", "abcdef123456")
        b = fixture_manifest.build_manifest(*_manifest_db(tmp, "b"), plan, "2026-10-04", "abcdef123456")
    eq(a["problems"], [], "baseline problems")
    eq(a["offset_days"], 0)
    eq(a["settings"]["orrery_last_system"], "Size 120")
    eq(a["photos"]["Bianca Bellamy"]["width"], 256)
    eq(fixture_manifest.compare(a, a), [], "self compare")
    diffs = fixture_manifest.compare(a, b)
    eq(len(diffs), 4, f"differences {diffs}")
    eq([d.split(":")[0] for d in diffs],
       ["System Size 5", "photo Adele Abbott", "setting orrery_satellites_enabled", "ring_order_sha256"])


@check("scenario: switch stall gap extraction over [tap, tap + 2.6 s]")
def _():
    import switch_stall

    fx = load("switch-gap.json")
    presents = expand({"present_runs": fx["present_runs"]})["presents"]
    out = switch_stall.score_switch(presents, fx["tap_ns"], fx["window_s"])
    eq(out["max_gap_ms"], fx["expect_max_gap_ms"])
    eq(out["outcome"], "valid")
    eq(switch_stall.score_switch([], fx["tap_ns"], fx["window_s"])["outcome"], "no-present")


W, H = 20, 40
REGIONS = {"tab": (0, 36, 20, 40), "header": (0, 0, 20, 4), "canvas": (0, 6, 20, 34), "full": (0, 0, 20, 40)}
BODY = {(x, y) for y in range(6, 34) for x in range(20) if (x * 7 + y * 3) % 5 < 2}  # 40 % of the canvas
SPARKS = [(x, y) for y in range(6, 34) for x in range(20) if (x, y) not in BODY][:24]


def _frame(t: float) -> bytes:
    """Digest until 1.0 s (tab), title at 1.3 s, blank canvas until 1.8 s, bodies
    fill 30 % / 60 % / 100 % by 2.5 s, then ambient twinkle that keeps moving."""
    px = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            if y >= 36:
                px[y * W + x] = 30 if t < 1.0 else 200
            elif y < 4:
                px[y * W + x] = 30 if t < 1.3 else 200
            elif 6 <= y < 34:
                px[y * W + x] = 80 if t < 1.3 else 50
    if t >= 1.8:
        share = 0.3 if t < 2.1 else 0.6 if t < 2.5 else 1.0
        for i, (x, y) in enumerate(sorted(BODY)):
            if i < share * len(BODY):
                px[y * W + x] = 200
    if t >= 2.5:
        step = int(round(t * 10))
        for i, (x, y) in enumerate(SPARKS):
            if (i + step) % 3 == 0:
                px[y * W + x] = 140
    return bytes(px)


@check("scenario: tab return finds t_tap/t_screen/t_canvas and the first FULL frame despite ongoing ambient change")
def _():
    import tab_return

    frames = [(k / 10, _frame(k / 10)) for k in range(60)]
    out = tab_return.analyse_frames(frames, W, REGIONS, 6.0)
    eq(out["outcome"], "valid")
    eq((out["t_tap"], out["t_screen"], out["t_canvas"], out["t_full"]), (1.0, 1.3, 1.8, 2.5))
    eq((out["screen_s"], out["mount_s"], out["fill_s"], out["total_s"]), (0.3, 0.5, 0.7, 1.5))
    eq(frames[-1][1] != frames[25][1], True, "the final frame differs from the t_full frame (ambient)")


def _frame_backdrop_first(t: float) -> bytes:
    """As _frame, but a smooth sky backdrop (a gentle gradient) fills the canvas at
    1.8 s and the bodies only arrive at 3.0 s (main on the 6 Pro, 2026-10-03)."""
    px = bytearray(_frame(min(t, 1.7)))
    if t >= 1.8:
        for y in range(6, 34):
            for x in range(W):
                px[y * W + x] = 50 + 40 * x // W + y // 4
    if t >= 3.0:
        for x, y in BODY:
            px[y * W + x] = 230
    return bytes(px)


@check("scenario: tab return ignores a smooth backdrop that precedes the scene (first full frame = bodies drawn)")
def _():
    import tab_return

    frames = [(k / 10, _frame_backdrop_first(k / 10)) for k in range(60)]
    out = tab_return.analyse_frames(frames, W, REGIONS, 6.0)
    eq(out["outcome"], "valid")
    eq(out["t_full"], 3.0, "t_full")
    eq(out["total_s"], 2.0, "total")


@check("scenario: tab return decode keeps each frame's pixels with its own timestamp on a variable-rate recording")
def _():
    import subprocess
    import tab_return

    levels, durations = [20, 90, 160, 230], [0.1, 1.5, 0.05, 2.0]
    with tempfile.TemporaryDirectory() as tmp:
        lines = ["ffconcat version 1.0"]
        for i, (level, duration) in enumerate(zip(levels, durations)):
            png = os.path.join(tmp, f"f{i}.png")
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                            f"color=c=0x{level:02x}{level:02x}{level:02x}:s=64x128", "-frames:v", "1", png], check=True)
            lines += [f"file f{i}.png", f"duration {duration}"]
        lines.append(f"file f{len(levels) - 1}.png")
        with open(os.path.join(tmp, "list.txt"), "w", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")
        mp4 = os.path.join(tmp, "vfr.mp4")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i",
                        os.path.join(tmp, "list.txt"), "-fps_mode", "vfr", "-pix_fmt", "yuv420p", mp4], check=True)
        frames, width, height, _ = tab_return.decode(mp4)
    means = [round(sum(f) / len(f)) for _, f in frames]
    times = [round(t, 2) for t, _ in frames]
    eq(len(frames) >= 4 and all(abs(a - b) <= 0.03 for a, b in zip(times, [0.0, 0.1, 1.6, 1.65])), True,
       f"frame timestamps {times} (container time base rounds by a few ms)")
    for level, mean in zip(levels, means):
        eq(abs(level - mean) <= 6, True, f"frame level {level} decoded as {mean}")


@check("scenario: tab return gives no number when the recording ends too soon or the canvas never changes")
def _():
    import tab_return

    short = [(k / 10, _frame(k / 10)) for k in range(30)]
    out = tab_return.analyse_frames(short, W, REGIONS, 3.0)
    eq(out["outcome"] in ("truncated", "no-full-frame"), True, out["outcome"])
    eq("total_s" in out, False)
    blank = [(k / 10, _frame(min(k / 10, 1.7))) for k in range(60)]
    eq(tab_return.analyse_frames(blank, W, REGIONS, 6.0)["outcome"], "no-canvas-change")


@check("scenario: idle soak reads the skin sensor (TYPE_SKIN) and battery temperature on both phones")
def _():
    import idle_soak

    six = idle_soak.parse_thermal(read("thermal-pixel6pro.txt"))
    eq((six["thermal_status"], six["skin"]["name"], six["skin"]["c"]), (0, "VIRTUAL-SKIN", 33.37))
    three = idle_soak.parse_thermal(read("thermal-pixel3a.txt"))
    eq((three["skin"]["name"], three["battery_sensor"]["c"]), ("mb-therm-monitor", 27.8))
    eq(idle_soak.parse_battery(read("battery-pixel6pro.txt")),
       {"level": 100, "temperature_c": 30.3, "usb_powered": True})


@check("adb_device: release-build UI tree - tabs by '<glyph>, <title>', never the header title; selector row and close button")
def _():
    import tab_return
    orrery = adb_device.parse_ui(read("ui-orrery-release-pixel6pro.xml"))
    eq(len(adb_device.tab_nodes(orrery)), 5, "tab count")
    tab = adb_device.find_tab(orrery, "Orrery")
    eq(tab.bounds, (864, 2866, 1152, 3036), "Orrery tab (not the header title)")
    eq(adb_device.current_system(orrery), "Size 120", "current System")
    regions = tab_return.regions_from_ui(orrery, (1440, 3120))
    eq(regions["tab"], (0, 2866, 1440, 3036), "tab region")
    eq(regions["canvas"][1] > regions["header"][3] and regions["canvas"][3] < 2866, True, "canvas between header and tabs")
    sheet = adb_device.parse_ui(read("ui-selector-release-pixel6pro.xml"))
    eq(adb_device.find(sheet, desc="Choose System") is not None, True, "sheet heading")
    eq(adb_device.find_system_row(sheet, "Size 120").cls.endswith("RadioButton"), True, "row is the radio")
    eq(adb_device.find_system_row(sheet, "Size 12"), None, "no prefix match on a different System")
    close = adb_device.close_selector_button(sheet)
    eq(close.bounds, (116, 2648, 1117, 2812), "sheet close button, not the full-screen backdrop")


def main() -> int:
    if "--regenerate" in sys.argv:
        regenerate()
        print("fixtures regenerated")
        return 0
    failed = 0
    for name, fn in CHECKS:
        try:
            fn()
            print(f"PASS {name}")
        except Exception as error:  # report every check, then fail overall
            failed += 1
            print(f"FAIL {name}: {type(error).__name__}: {error}")
            traceback.print_exc(limit=3)
    print(f"{len(CHECKS) - failed}/{len(CHECKS)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
