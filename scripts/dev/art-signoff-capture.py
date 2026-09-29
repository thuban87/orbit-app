#!/usr/bin/env python3
"""Re-sign-off capture driver (38.5-07; owner rulings D-08, D-13, D-27).

DEV tooling, not app code. Drives a DEBUG build of com.bwales.orbit on the
attached test phone through the DEV-only override file
`src/theme/__dev__/art-treatment-dev-overrides.json` (schema in the header of
`src/theme/use-art-treatment.ts`), and saves labelled screenshots.

Per shot it:
  - writes the override JSON (`enabled`, `combo`, `cells`, `opacity`);
  - waits for Metro's refresh and the settle;
  - dismisses the RN LogBox toast when present (it overlays the tab bar);
  - navigates with `uiautomator dump` bounds (Contacts tab -> List / Card via the
    view toggle; Digest tab);
  - saves `adb exec-out screencap -p` as `<combo>__<view>__<variant>.png`.

On exit (including errors and Ctrl-C) it restores the override file to
`{ "enabled": false }`. It never edits anything else under `src/`, never
touches the phone's Contacts, never triggers an AI call and never changes the
clock.

The mapped v2 table (corrections (a)/(b), Mesh dropped, Galaxy art rows carried
to quiet/Aurora/Starfield) and the ladders come from `candidates.json`, written
by `scripts/dev/art-signoff-candidates.ts`, so the mapping lives in one place.

Usage:
  python3 scripts/dev/art-signoff-capture.py <mode> [--out DIR] [--candidates FILE]
modes: tracer | base | active | ladders | cardblend | overflow | gallery-one COMBO |
       restore | font-check
"""
from __future__ import annotations

import argparse
import json
import os
import re
import signal
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OVERRIDE = REPO / "src/theme/__dev__/art-treatment-dev-overrides.json"
DISABLED = '{\n  "enabled": false\n}\n'
ADB = os.path.expanduser("~/.local/bin/adb")
PKG_ID = "com.bwales.orbit"
DEFAULT_OUT = Path.home() / "orbit-art/38.5/signoff-v3"
FONT_SCALE = "1.15"

# Seconds to wait after writing the override for Metro's refresh and the settle
# (theme switch + background decode) before navigating.
REFRESH_WAIT = float(os.environ.get("ART_REFRESH_WAIT", "7"))
NAV_WAIT = float(os.environ.get("ART_NAV_WAIT", "2.5"))

COMPONENTS = [
    "contactsListEntries", "contactsCardEntries", "contactsTopButtons",
    "contactsSearchAndToggle", "contactsCountLabel", "contactsHeader",
    "digestHeader", "digestSectionHeadings", "digestUpNextItems",
    "digestHorizonItems", "digestYourWeek",
]
TO_BACKING = {"full": "full", "transparent": "seeThrough", "none": "none"}


# ---------------------------------------------------------------------------
# adb
# ---------------------------------------------------------------------------

def serial() -> str:
    out = subprocess.run([ADB, "devices", "-l"], capture_output=True, text=True, check=True).stdout
    devs = [l.split()[0] for l in out.splitlines()[1:] if len(l.split()) > 1 and l.split()[1] == "device"]
    if len(devs) != 1:
        raise SystemExit(f"expected exactly one device in state 'device', got {devs}")
    return devs[0]


SERIAL: str | None = None


def adb(*args: str, binary: bool = False, check: bool = True):
    r = subprocess.run([ADB, "-s", SERIAL, *args], capture_output=True, check=check)
    return r.stdout if binary else r.stdout.decode(errors="replace")


def tap(x: int, y: int, touchscreen: bool = False) -> None:
    if touchscreen:
        adb("shell", "input", "touchscreen", "tap", str(x), str(y))
    else:
        adb("shell", "input", "tap", str(x), str(y))


NODE_RE = re.compile(r"<node [^>]*>")


def dump() -> list[dict]:
    for _ in range(3):
        adb("shell", "uiautomator", "dump", "/sdcard/ui.xml", check=False)
        xml = adb("exec-out", "cat", "/sdcard/ui.xml", check=False)
        if "<hierarchy" in xml:
            break
        time.sleep(1)
    nodes = []
    for m in NODE_RE.finditer(xml):
        n = m.group(0)
        g = lambda k: (re.search(rf'{k}="([^"]*)"', n) or [None, ""])[1]
        b = [int(v) for v in re.findall(r"\d+", g("bounds"))]
        nodes.append({"text": g("text"), "id": g("resource-id"), "desc": g("content-desc"),
                      "selected": g("selected") == "true", "b": b})
    return nodes


def find(nodes, *, id=None, desc_end=None, desc=None, text=None):
    for n in nodes:
        if id is not None and n["id"] != id:
            continue
        if desc_end is not None and not n["desc"].endswith(desc_end):
            continue
        if desc is not None and n["desc"] != desc:
            continue
        if text is not None and n["text"] != text:
            continue
        return n
    return None


def center(n) -> tuple[int, int]:
    x1, y1, x2, y2 = n["b"]
    return (x1 + x2) // 2, (y1 + y2) // 2


def screencap(path: Path | None = None) -> bytes:
    png = adb("exec-out", "screencap", "-p", binary=True)
    if path is not None:
        path.write_bytes(png)
    return png


def toast_present(png: bytes) -> tuple[int, int] | None:
    """The LogBox toast (dark grey bar over the tab bar). Returns its close point."""
    from io import BytesIO
    from PIL import Image
    im = Image.open(BytesIO(png)).convert("RGB")
    w, h = im.size
    # The toast is a (51,51,51) bar spanning ~y 1975-2105 on the 1080x2220 Pixel 3a.
    ys = [int(h * f) for f in (0.895, 0.93)]
    hits = 0
    for y in ys:
        for x in (int(w * 0.28), int(w * 0.6)):
            r, g, b = im.getpixel((x, y))
            if abs(r - 51) <= 4 and abs(g - 51) <= 4 and abs(b - 51) <= 4:
                hits += 1
    if hits >= 3:
        return int(w * 0.917), int(h * 0.92)
    return None


def dismiss_toast() -> None:
    for _ in range(3):
        pt = toast_present(screencap())
        if pt is None:
            return
        tap(*pt)
        time.sleep(1.2)


# ---------------------------------------------------------------------------
# navigation
# ---------------------------------------------------------------------------

def go_tab(name: str) -> None:
    dismiss_toast()
    for attempt in range(3):
        nodes = dump()
        n = find(nodes, desc_end=f", {name}")
        if n is None:
            adb("shell", "input", "keyevent", "4")  # one back to leave a pushed route
            time.sleep(1.5)
            continue
        x, y = center(n)
        tap(x, y - 20)
        time.sleep(NAV_WAIT)
        nodes = dump()
        want = "dashboard-root" if name == "Contacts" else "digest-root" if name == "Digest" else None
        if want is None or find(nodes, id=want):
            return
    raise RuntimeError(f"could not reach tab {name}")


def set_view(view: str) -> None:
    rid = f"dashboard-view-toggle-{view}"
    for _ in range(3):
        n = find(dump(), id=rid)
        if n is None:
            raise RuntimeError("view toggle not found (not on Contacts?)")
        if n["selected"]:
            return
        tap(*center(n))
        time.sleep(NAV_WAIT)
    raise RuntimeError(f"could not select {view} view")


def scroll_top() -> None:
    # Two gentle downward drags in the content area bring a list back to the top.
    for _ in range(2):
        adb("shell", "input", "swipe", "540", "900", "540", "1900", "150")
        time.sleep(0.4)
    time.sleep(0.8)


# ---------------------------------------------------------------------------
# overrides
# ---------------------------------------------------------------------------

def write_override(obj: dict) -> None:
    OVERRIDE.write_text(json.dumps(obj, indent=2) + "\n")


def restore_override() -> None:
    OVERRIDE.write_text(DISABLED)


def combo_parts(key: str) -> tuple[str, str, str]:
    pkg, mode, bg = key.split("-", 2)
    return pkg, mode, bg


def base_cells(row: dict) -> dict:
    return {c: {"backing": TO_BACKING[row["cells"][c]]} for c in COMPONENTS}


def base_opacity(cands: dict) -> dict:
    out: dict[str, dict] = {}
    for l in cands["ladders"]:
        if l["baseValue"] is not None:
            out.setdefault(l["pkgMode"], {})[l["group"]] = l["baseValue"]
    return out


def override_for(key: str, cands: dict, *, cells_patch: dict | None = None,
                 opacity_patch: dict | None = None) -> dict:
    pkg, mode, bg = combo_parts(key)
    row = cands["mappedV2"][key]
    cells = base_cells(row)
    for comp, patch in (cells_patch or {}).items():
        cells[comp] = {**cells[comp], **patch}
    opacity = base_opacity(cands)
    pm = f"{pkg}-{mode}"
    if opacity_patch:
        opacity[pm] = {**opacity.get(pm, {}), **opacity_patch}
    return {
        "enabled": True,
        "combo": {"package": pkg, "mode": mode, "background": bg},
        "cells": {key: cells},
        "opacity": opacity,
    }


LAST_OVERRIDE: str | None = None


def apply(obj: dict) -> None:
    global LAST_OVERRIDE
    text = json.dumps(obj, sort_keys=True)
    if text == LAST_OVERRIDE:
        return
    write_override(obj)
    LAST_OVERRIDE = text
    time.sleep(REFRESH_WAIT)
    dismiss_toast()


# ---------------------------------------------------------------------------
# shots
# ---------------------------------------------------------------------------

def shoot(out: Path, key: str, view: str, variant: str) -> Path:
    if view in ("list", "card"):
        go_tab("Contacts")
        set_view(view)
    elif view == "digest":
        go_tab("Digest")
    dismiss_toast()
    time.sleep(0.8)
    p = out / f"{key}__{view}__{variant}.png"
    screencap(p)
    print(f"  shot {p.name}", flush=True)
    return p


def capture_views(out: Path, key: str, views: list[str], variant: str, obj: dict,
                  skip_existing: bool = True) -> None:
    todo = [v for v in views if not (skip_existing and (out / f"{key}__{v}__{variant}.png").exists())]
    if not todo:
        return
    apply(obj)
    for v in todo:
        shoot(out, key, v, variant)


def rung_values(l: dict) -> list[tuple[str, float]]:
    """Distinct ladder rungs in ascending order: (rung code, value)."""
    seen: dict[float, str] = {}
    for name in ("minSafe", "precedent", "midpoint"):
        v = l[name]["value"]
        if v is not None and v not in seen:
            seen[v] = name
    return [(f"R{i + 1}", v) for i, v in enumerate(sorted(seen))]


def views_for_group(group: str) -> list[str]:
    return {"listEntry": ["list"], "cardEntry": ["card"], "artChrome": ["list", "digest"]}[group]


def run(mode: str, out: Path, cands: dict, extra: list[str]) -> None:
    keys = list(cands["mappedV2"].keys())
    if mode == "tracer":
        key = "galaxy-light-quiet"
        capture_views(out, key, ["list", "card", "digest"], "v2", override_for(key, cands), skip_existing=False)
    elif mode == "base":
        for key in keys:
            capture_views(out, key, ["list", "card", "digest"], "v2", override_for(key, cands))
    elif mode == "active":
        # Population/Filters/Sort must already be set active on the device (the
        # caller sets them through their menus and resets them afterwards).
        for key in keys:
            capture_views(out, key, ["list"], "active-top-buttons", override_for(key, cands))
    elif mode == "ladders":
        for l in cands["ladders"]:
            if not l["needsOwnerValue"]:
                continue
            pkg, mode_ = l["pkgMode"].split("-")
            for bg in l["transparentOn"]:
                if bg == "none":
                    continue  # ladders are shown on each art background
                key = f"{pkg}-{mode_}-{bg}"
                for code, v in rung_values(l):
                    variant = f"{l['group']}-{code}-{v:.2f}"
                    capture_views(out, key, views_for_group(l["group"]), variant,
                                  override_for(key, cands, opacity_patch={l["group"]: v}))
    elif mode == "cardblend":
        for l in cands["ladders"]:
            cb = l.get("cardBlend")
            if not cb or cb["value"] is None:
                continue
            pkg, mode_ = l["pkgMode"].split("-")
            for bg in l["transparentOn"]:
                if bg == "none":
                    continue
                key = f"{pkg}-{mode_}-{bg}"
                capture_views(out, key, ["card"], f"cardblend-{cb['value']:.2f}",
                              override_for(key, cands, opacity_patch={l["group"]: cb["value"]}))
    elif mode == "overflow":
        for key in keys:
            if cands["mappedV2"][key]["cells"]["contactsHeader"] != "none":
                continue
            capture_views(out, key, ["list"], "overflow-local-backing",
                          override_for(key, cands, cells_patch={"contactsHeader": {"overflowLocalBacking": True}}))
    elif mode == "combo":
        # Apply one combination at the mapped v2 values and leave it (gallery driving).
        apply(override_for(extra[0], cands))
    else:
        raise SystemExit(f"unknown mode {mode}")


def main() -> None:
    global SERIAL
    ap = argparse.ArgumentParser()
    ap.add_argument("mode")
    ap.add_argument("extra", nargs="*")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--candidates", type=Path, default=DEFAULT_OUT / "candidates.json")
    ap.add_argument("--keep", action="store_true",
                    help="leave the override applied on exit (combo mode only)")
    args = ap.parse_args()
    if args.mode == "restore":
        restore_override()
        print("override restored to enabled:false")
        return
    SERIAL = serial()
    if args.mode == "font-check":
        print(adb("shell", "settings", "get", "system", "font_scale").strip())
        return
    scale = adb("shell", "settings", "get", "system", "font_scale").strip()
    if scale != FONT_SCALE:
        raise SystemExit(f"font scale is {scale}, expected {FONT_SCALE}; set it first (every shot at 1.15)")
    args.out.mkdir(parents=True, exist_ok=True)
    cands = json.loads(args.candidates.read_text())

    def _sig(_s, _f):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, _sig)
    try:
        run(args.mode, args.out, cands, args.extra)
    finally:
        if not (args.keep and args.mode == "combo"):
            restore_override()
            print("override restored to enabled:false", flush=True)
        final = adb("shell", "settings", "get", "system", "font_scale").strip()
        if final != FONT_SCALE:
            print(f"WARNING: font scale changed during the run ({final}); re-shoot", flush=True)


if __name__ == "__main__":
    main()
