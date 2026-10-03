#!/usr/bin/env python3
"""5-minute idle soak at Home with the Orrery visible (38.7 D-40 / G6).

What it measures, with nothing touching the screen:
  - skin temperature (the thermal HAL's TYPE_SKIN sensor: VIRTUAL-SKIN on the
    Pixel 6 Pro, mb-therm-monitor on the Pixel 3a) and battery temperature,
    every 30 s (`dumpsys thermalservice`, `dumpsys battery`), plus thermal status;
  - per-thread CPU of the Orbit process (thread_cpu.py: UI thread, RenderThread,
    JS thread, GC) over four consecutive 75 s windows;
  - SurfaceFlinger presents of the canvas layer over the whole soak (context
    only: main's TextureView presents through the window layer and V2 may be a
    SurfaceView, so presents are not comparable across surface types; G6 is
    judged on temperature and CPU).

Phone prep it does itself: records stay-awake (`stay_on_while_plugged_in`) and
the screen-off timeout, sets stay-awake (`svc power stayon usb`) and a 30 min
timeout, and restores both at the end. It refuses to start when the battery is
below 50 % or the skin is more than 1.0 C above --reference-start-temp (the
cool-down rule: pass the baseline's start skin temperature).

Usage: idle_soak.py --model "Pixel 6 Pro" [--seconds 300] [--reference-start-temp 31.2] --out soak.json
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adb_device  # noqa: E402
import sf_sampler  # noqa: E402
import thread_cpu  # noqa: E402

THERMAL_EVERY_S = 30.0
CPU_WINDOWS = 4
MIN_BATTERY = 50
COOL_DOWN_C = 1.0
TYPE_SKIN = 3
TYPE_BATTERY = 2
SOAK_TIMEOUT_MS = 1_800_000

TEMP_RE = re.compile(r"Temperature\{mValue=([-\d.]+), mType=(-?\d+), mName=([^,]+), mStatus=(\d+)\}")


def parse_thermal(text: str) -> dict:
    """Skin and battery sensors from `dumpsys thermalservice` ("Current
    temperatures from HAL" preferred, else the cached block) + thermal status."""
    status = re.search(r"Thermal Status: (\d+)", text)
    current = text.split("Current temperatures from HAL:", 1)
    sources = [current[1]] if len(current) > 1 else []
    sources.append(text)
    skin = battery = None
    for block in sources:
        for value, kind, name, _ in TEMP_RE.findall(block):
            if int(kind) == TYPE_SKIN and skin is None:
                skin = {"name": name, "c": round(float(value), 2)}
            elif int(kind) == TYPE_BATTERY and battery is None:
                battery = {"name": name, "c": round(float(value), 2)}
        if skin and battery:
            break
    return {"thermal_status": int(status.group(1)) if status else None, "skin": skin, "battery_sensor": battery}


def parse_battery(text: str) -> dict:
    level = re.search(r"^\s*level: (\d+)", text, re.M)
    temp = re.search(r"^\s*temperature: (\d+)", text, re.M)
    usb = re.search(r"USB powered: (\w+)", text)
    return {"level": int(level.group(1)) if level else None,
            "temperature_c": int(temp.group(1)) / 10 if temp else None,
            "usb_powered": usb.group(1) == "true" if usb else None}


def reading(serial: str) -> dict:
    return {"host_s": time.monotonic(),
            **parse_thermal(adb_device.shell(serial, "dumpsys thermalservice")),
            **parse_battery(adb_device.shell(serial, "dumpsys battery"))}


def setting(serial: str, namespace: str, key: str) -> str:
    return adb_device.shell(serial, f"settings get {namespace} {key}").strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    adb_device.add_model_arg(parser)
    parser.add_argument("--seconds", type=float, default=300)
    parser.add_argument("--reference-start-temp", type=float, help="baseline start skin temperature (C)")
    parser.add_argument("--out")
    args = parser.parse_args()
    serial = adb_device.resolve_serial(args.model)

    start = reading(serial)
    if (start["level"] or 0) < MIN_BATTERY:
        raise adb_device.DeviceError(f"battery {start['level']} % < {MIN_BATTERY} %: charge first")
    skin0 = start["skin"]["c"] if start["skin"] else None
    if args.reference_start_temp is not None and skin0 is not None and skin0 > args.reference_start_temp + COOL_DOWN_C:
        raise adb_device.DeviceError(
            f"skin {skin0} C is more than {COOL_DOWN_C} C above the reference {args.reference_start_temp} C: cool down first")

    saved = {"stay_on_while_plugged_in": setting(serial, "global", "stay_on_while_plugged_in"),
             "screen_off_timeout": setting(serial, "system", "screen_off_timeout")}
    adb_device.shell(serial, "svc power stayon usb")
    adb_device.shell(serial, f"settings put system screen_off_timeout {SOAK_TIMEOUT_MS}")
    try:
        pid = adb_device.app_pid(serial)
        if not pid:
            raise adb_device.DeviceError("Orbit is not running: open the Orrery at Home first")
        layer = sf_sampler.resolve_layer(serial)
        sampler = sf_sampler.Sampler(serial, layer, adb_device.ClockMap.anchor(serial)).start()
        clk = int(adb_device.shell(serial, "getconf CLK_TCK").strip() or 100)
        readings = [start]
        stop = threading.Event()

        def thermal_loop() -> None:
            while not stop.wait(THERMAL_EVERY_S):
                readings.append(reading(serial))

        thermal = threading.Thread(target=thermal_loop, daemon=True)
        thermal.start()
        window = args.seconds / CPU_WINDOWS
        snaps = [thread_cpu.snapshot(serial, pid)]
        t0 = time.monotonic()
        for k in range(1, CPU_WINDOWS + 1):
            time.sleep(max(0.0, t0 + k * window - time.monotonic()))
            snaps.append(thread_cpu.snapshot(serial, pid))
        stop.set()
        thermal.join()
        readings.append(reading(serial))
        sampler.stop()
    finally:
        adb_device.shell(serial, f"settings put global stay_on_while_plugged_in {saved['stay_on_while_plugged_in']}")
        adb_device.shell(serial, f"settings put system screen_off_timeout {saved['screen_off_timeout']}")

    cpu = [thread_cpu.compute(a, b, clk, pid) for a, b in zip(snaps, snaps[1:])]
    skins = [r["skin"]["c"] for r in readings if r.get("skin")]
    batteries = [r["temperature_c"] for r in readings if r.get("temperature_c") is not None]
    sf = sampler.result()
    t0 = start["host_s"]  # `start` is readings[0]; read it before the loop pops host_s
    for r in readings:
        r["t_s"] = round(r.pop("host_s") - t0, 1) if "host_s" in r else None
    adb_device.write_json(args.out, {
        "model": args.model,
        "seconds": args.seconds,
        "settings_restored": saved,
        "skin_c": {"start": skins[0] if skins else None, "end": skins[-1] if skins else None,
                   "max": max(skins) if skins else None},
        "battery_c": {"start": batteries[0] if batteries else None, "end": batteries[-1] if batteries else None,
                      "max": max(batteries) if batteries else None},
        "thermal_status_max": max((r["thermal_status"] or 0) for r in readings),
        "cpu_windows": [{k: v for k, v in w.items() if k != "threads"} | {"top": w["threads"][:6]} for w in cpu],
        "presents_context": {"layer": sf["layer"], **sf["summary"],
                             "note": "context only; not comparable across TextureView and SurfaceView"},
        "readings": readings,
    })
    return 0


if __name__ == "__main__":
    sys.exit(main())
