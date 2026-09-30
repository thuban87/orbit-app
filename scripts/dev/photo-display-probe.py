#!/usr/bin/env python3
"""Photo display probe (38.6-01 spike; reused by 38.6-07).

Samples the mean RGB inside a UI node's bounds on a device screenshot, so a
photo change can be checked from the outside without trusting the app:

  adb exec-out screencap -p > shot.png
  adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml ui.xml
  python3 scripts/dev/photo-display-probe.py --png shot.png --xml ui.xml \
      --desc "Photo of Spike Photo" --expect 220,30,30 --tol 40

Finds the FIRST node whose content-desc contains --desc, averages RGB over the
central 60% of its bounds (avoiding the circular crop's corners and any ring),
and prints JSON {found, bounds, rgb}. Exit codes: 0 ok, 1 when --expect is given
and any channel differs by more than --tol, 2 when the node is missing.
"""

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET

from PIL import Image

BOUNDS_RE = re.compile(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]")
CENTRAL_FRACTION = 0.6


def find_bounds(xml_path, desc):
    root = ET.parse(xml_path).getroot()
    for node in root.iter("node"):
        if desc in (node.get("content-desc") or ""):
            m = BOUNDS_RE.fullmatch(node.get("bounds") or "")
            if m:
                return tuple(int(v) for v in m.groups())
    return None


def mean_rgb(png_path, bounds):
    x1, y1, x2, y2 = bounds
    w, h = x2 - x1, y2 - y1
    inset_x = int(w * (1 - CENTRAL_FRACTION) / 2)
    inset_y = int(h * (1 - CENTRAL_FRACTION) / 2)
    box = (x1 + inset_x, y1 + inset_y, x2 - inset_x, y2 - inset_y)
    img = Image.open(png_path).convert("RGB").crop(box)
    pixels = list(img.getdata())
    n = max(len(pixels), 1)
    return [round(sum(p[i] for p in pixels) / n) for i in range(3)]


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--png", required=True, help="device screenshot (PNG)")
    parser.add_argument("--xml", required=True, help="uiautomator dump XML")
    parser.add_argument("--desc", required=True, help="content-desc substring")
    parser.add_argument("--expect", help="expected mean colour R,G,B")
    parser.add_argument("--tol", type=int, default=40, help="per-channel tolerance")
    args = parser.parse_args()

    bounds = find_bounds(args.xml, args.desc)
    if bounds is None:
        print(json.dumps({"found": False, "bounds": None, "rgb": None}))
        return 2
    rgb = mean_rgb(args.png, bounds)
    result = {"found": True, "bounds": list(bounds), "rgb": rgb}
    code = 0
    if args.expect:
        expect = [int(v) for v in args.expect.split(",")]
        result["expect"] = expect
        result["match"] = all(abs(a - b) <= args.tol for a, b in zip(rgb, expect))
        code = 0 if result["match"] else 1
    print(json.dumps(result))
    return code


if __name__ == "__main__":
    sys.exit(main())
