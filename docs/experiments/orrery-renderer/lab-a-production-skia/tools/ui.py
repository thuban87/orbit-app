#!/usr/bin/env python3
"""
ORRERY LAB A (experiment-only) — uiautomator helper.

  python3 ui.py list                    # dump + print every text/content-desc + bounds
  python3 ui.py tap "Orrery"            # tap the first node whose text/desc == label
  python3 ui.py tap "Orrery" --contains # substring match
  python3 ui.py tap "Orrery" --nth 1    # pick the 2nd match
  python3 ui.py find "Lab Dense"        # print center of match (exit 1 if absent)

Taps use `input touchscreen tap` (works for RN Pressables, FAB, buttons and tab
items; plain `input tap` silently misses some small controls).
"""
import os
import re
import subprocess
import sys

ADB = os.path.expanduser("~/.local/bin/adb")


def serial():
    out = subprocess.run([ADB, "devices"], capture_output=True, text=True).stdout
    devs = [l.split()[0] for l in out.splitlines()[1:] if l.strip().endswith("device")]
    if len(devs) != 1:
        sys.exit(f"need exactly one device, got {devs}")
    return devs[0]


def dump(s):
    subprocess.run([ADB, "-s", s, "shell", "uiautomator", "dump", "/sdcard/ui.xml"],
                   capture_output=True)
    return subprocess.run([ADB, "-s", s, "exec-out", "cat", "/sdcard/ui.xml"],
                          capture_output=True, text=True).stdout


def nodes(xml):
    for node in re.findall(r"<node [^>]*>", xml):
        attrs = dict(re.findall(r'([\w-]+)="([^"]*)"', node))
        b = re.findall(r"\d+", attrs.get("bounds", ""))
        if len(b) != 4:
            continue
        x1, y1, x2, y2 = map(int, b)
        for k in ("text", "content-desc"):
            if attrs.get(k):
                yield attrs[k], (x1 + x2) // 2, (y1 + y2) // 2, attrs.get("bounds")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd = sys.argv[1]
    s = serial()
    xml = dump(s)
    if cmd == "list":
        for label, x, y, b in nodes(xml):
            print(f"{label[:70]!r} center=({x},{y}) {b}")
        return
    label = sys.argv[2]
    contains = "--contains" in sys.argv
    nth = int(sys.argv[sys.argv.index("--nth") + 1]) if "--nth" in sys.argv else 0
    hits = [(l, x, y) for l, x, y, _ in nodes(xml)
            if (label in l if contains else l.strip() == label)]
    if len(hits) <= nth:
        print(f"not found: {label!r}", file=sys.stderr)
        sys.exit(1)
    l, x, y = hits[nth]
    print(f"{l!r} -> ({x},{y})")
    if cmd == "tap":
        subprocess.run([ADB, "-s", s, "shell", "input", "touchscreen", "tap", str(x), str(y)])


if __name__ == "__main__":
    main()
