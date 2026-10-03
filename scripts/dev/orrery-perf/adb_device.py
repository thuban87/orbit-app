#!/usr/bin/env python3
"""Phone resolution, adb plumbing and UI-tree helpers for the Orrery perf scripts.

38.7 Plan 01 (D-56). Measures nothing itself. Every device script in this folder
binds to ONE physical phone resolved by model from `adb devices -l` (never a
hard-coded serial, never "the first device") and passes `-s <serial>` on every
adb command, so a second attached phone can never be measured by mistake.

Taps go through `uiautomator dump` bounds and accessibility labels, never fixed
coordinates (the two phones differ in resolution). `input` injection does not
appear on the touchscreen's getevent stream, so script-driven taps can never be
counted as owner touch windows (touch_windows.py).

Python 3 standard library only. The adb binary is `~/.local/bin/adb` (the SDK's
37.x; never the Debian package, see CLAUDE.md), overridable with env `ADB`.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass

ADB = os.environ.get("ADB", os.path.expanduser("~/.local/bin/adb"))
PACKAGE = "com.bwales.orbit"
LOG_TAG = "orbperf"


class DeviceError(RuntimeError):
    """A phone could not be resolved or an adb command failed."""


# --- Phone resolution ---------------------------------------------------------
def parse_devices(text: str) -> list[dict]:
    """Rows of `adb devices -l`: {serial, state, model, product, device, ...}."""
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("List of devices") or line.startswith("*"):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        row = {"serial": parts[0], "state": parts[1]}
        for field in parts[2:]:
            if ":" in field:
                key, value = field.split(":", 1)
                row[key] = value
        rows.append(row)
    return rows


def resolve_serial(model: str, devices_text: str | None = None) -> str:
    """The serial of the ONE attached, authorised phone whose model matches.

    `model` is the marketing name with spaces or underscores ("Pixel 6 Pro",
    "Pixel_3a"). Zero or several matches raise DeviceError; nothing is guessed.
    """
    want = model.strip().replace(" ", "_")
    if devices_text is None:
        devices_text = run([ADB, "devices", "-l"])
    rows = parse_devices(devices_text)
    matches = [r for r in rows if r.get("model") == want and r["state"] == "device"]
    if len(matches) == 1:
        return matches[0]["serial"]
    seen = ", ".join(f"{r.get('model', '?')}({r['state']})" for r in rows) or "none"
    if not matches:
        raise DeviceError(
            f"no authorised phone with model {want!r} in `adb devices -l` (seen: {seen}). "
            "Run emu-connect; an 'unauthorized' phone needs the owner to accept USB debugging."
        )
    raise DeviceError(
        f"{len(matches)} phones match model {want!r}; refusing to guess. Unplug all but one."
    )


def add_model_arg(parser) -> None:
    parser.add_argument(
        "--model",
        required=True,
        help='phone model as in `adb devices -l` ("Pixel 6 Pro" or "Pixel_3a"); no default phone',
    )


# --- adb ----------------------------------------------------------------------
def run(argv: list[str], timeout: float | None = 120, check: bool = True) -> str:
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=timeout)
    if check and proc.returncode != 0:
        raise DeviceError(f"{' '.join(argv)} failed ({proc.returncode}): {proc.stderr.strip()}")
    return proc.stdout


def adb(serial: str, *args: str, timeout: float | None = 120, check: bool = True) -> str:
    return run([ADB, "-s", serial, *args], timeout=timeout, check=check)


def adb_bytes(serial: str, *args: str, timeout: float | None = 300) -> bytes:
    proc = subprocess.run([ADB, "-s", serial, *args], capture_output=True, timeout=timeout)
    if proc.returncode != 0:
        raise DeviceError(f"adb {' '.join(args)} failed: {proc.stderr.decode(errors='replace')}")
    return proc.stdout


def shell(serial: str, command: str, timeout: float | None = 120, check: bool = True) -> str:
    return adb(serial, "shell", command, timeout=timeout, check=check)


def popen_shell(serial: str, command: str) -> subprocess.Popen:
    """A streaming `adb shell` (e.g. getevent); caller terminates it."""
    return subprocess.Popen(
        [ADB, "-s", serial, "shell", command],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        bufsize=1,
    )


def android_release(serial: str) -> str:
    return shell(serial, "getprop ro.build.version.release").strip()


def app_pid(serial: str, package: str = PACKAGE) -> int | None:
    out = shell(serial, f"pidof {package}", check=False).split()
    return int(out[0]) if out else None


# --- Device clocks ------------------------------------------------------------
def parse_monotonic_mark(logcat_text: str, nonce: str) -> float | None:
    """Seconds on CLOCK_MONOTONIC of our `log` mark in `logcat -v monotonic` output."""
    for line in logcat_text.splitlines():
        if nonce in line:
            match = re.match(r"\s*(\d+\.\d+)\s", line)
            if match:
                return float(match.group(1))
    return None


def device_clocks(serial: str, extra: str = "") -> dict:
    """CLOCK_MONOTONIC (logcat mark) and CLOCK_BOOTTIME (/proc/uptime) "now".

    `extra` runs in the SAME shell between the two reads (its output is
    returned under "extra"). The monotonic mark has ~1 ms resolution; uptime
    10 ms. Host time is bracketed around the call for host→device mapping.
    """
    nonce = f"mark-{uuid.uuid4().hex[:10]}"
    sep = f"--{uuid.uuid4().hex[:8]}--"
    host0 = time.monotonic()
    out = shell(
        serial,
        f"log -t {LOG_TAG} {nonce}; cat /proc/uptime; echo {sep}; {extra}"
        if extra
        else f"log -t {LOG_TAG} {nonce}; cat /proc/uptime",
    )
    host1 = time.monotonic()
    head, _, rest = out.partition(sep)
    boot = float(head.split()[0]) if head.split() else None
    logs = shell(serial, f"logcat -d -v monotonic -s {LOG_TAG}:I")
    return {
        "monotonic_s": parse_monotonic_mark(logs, nonce),
        "boottime_s": boot,
        "host_s": (host0 + host1) / 2,
        "host_bracket_ms": (host1 - host0) * 1000,
        "extra": rest,
    }


@dataclass
class ClockMap:
    """Maps host `time.monotonic()` to device CLOCK_MONOTONIC nanoseconds."""

    offset_s: float
    uncertainty_ms: float

    @classmethod
    def anchor(cls, serial: str) -> "ClockMap":
        clocks = device_clocks(serial)
        if clocks["monotonic_s"] is None:
            raise DeviceError("could not read a CLOCK_MONOTONIC mark from logcat")
        return cls(clocks["monotonic_s"] - clocks["host_s"], clocks["host_bracket_ms"] / 2)

    def device_ns(self, host_s: float) -> int:
        return int((host_s + self.offset_s) * 1e9)


# --- UI tree ------------------------------------------------------------------
@dataclass
class Node:
    text: str
    desc: str
    rid: str
    cls: str
    clickable: bool
    checked: bool
    bounds: tuple[int, int, int, int]

    @property
    def center(self) -> tuple[int, int]:
        left, top, right, bottom = self.bounds
        return (left + right) // 2, (top + bottom) // 2


def parse_ui(xml_text: str) -> list[Node]:
    root = ET.fromstring(xml_text)
    nodes = []
    for el in root.iter("node"):
        nums = [int(n) for n in re.findall(r"-?\d+", el.get("bounds", "[0,0][0,0]"))]
        nodes.append(
            Node(
                text=el.get("text", ""),
                desc=el.get("content-desc", ""),
                rid=el.get("resource-id", ""),
                cls=el.get("class", ""),
                clickable=el.get("clickable") == "true",
                checked=el.get("checked") == "true",
                bounds=tuple(nums[:4]) if len(nums) >= 4 else (0, 0, 0, 0),
            )
        )
    return nodes


def ui_dump(serial: str) -> list[Node]:
    path = "/sdcard/orbperf-ui.xml"
    xml_text = shell(serial, f"uiautomator dump {path} >/dev/null 2>&1 && cat {path}; rm -f {path}")
    start = xml_text.find("<?xml")
    if start < 0:
        raise DeviceError("uiautomator dump returned no XML (screen locked or app busy?)")
    return parse_ui(xml_text[start:])


def find(
    nodes: list[Node],
    *,
    desc: str | None = None,
    desc_prefix: str | None = None,
    text: str | None = None,
    rid: str | None = None,
) -> Node | None:
    for node in nodes:
        if desc is not None and node.desc != desc:
            continue
        if desc_prefix is not None and not node.desc.startswith(desc_prefix):
            continue
        if text is not None and node.text != text:
            continue
        if rid is not None and not node.rid.endswith(rid):
            continue
        return node
    return None


def tap(serial: str, node_or_xy, touchscreen: bool = False) -> None:
    """`input touchscreen tap` for buttons/FAB, plain `input tap` for rows/chips
    (the input-source taxonomy the Orbit controls need)."""
    x, y = node_or_xy.center if isinstance(node_or_xy, Node) else node_or_xy
    source = "touchscreen " if touchscreen else ""
    shell(serial, f"input {source}tap {x} {y}")


def dismiss_logbox(serial: str, nodes: list[Node] | None = None) -> bool:
    """Debug builds only: the LogBox toast eats tab-bar taps; close it first."""
    nodes = nodes if nodes is not None else ui_dump(serial)
    toast = find(nodes, text="Open debugger") or find(nodes, desc_prefix="Open debugger")
    if not toast:
        return False
    close = [n for n in nodes if n.clickable and n.bounds[1] >= toast.bounds[1] - 40
             and n.bounds[3] <= toast.bounds[3] + 40 and n.bounds[0] > toast.bounds[2]]
    tap(serial, close[-1] if close else toast)
    time.sleep(1.0)
    return True


def find_tab(nodes: list[Node], title: str) -> Node | None:
    """Bottom tab button: React Navigation labels it "<title>, tab, i of n"."""
    return find(nodes, desc_prefix=f"{title}, tab") or find(nodes, desc=title) or find(nodes, text=title)


def tap_tab(serial: str, title: str) -> float:
    """Tap a bottom tab by label; returns the host time of the tap."""
    nodes = ui_dump(serial)
    dismiss_logbox(serial, nodes)
    node = find_tab(nodes, title)
    if not node:
        raise DeviceError(f"tab {title!r} not found in the UI tree")
    host = time.monotonic()
    tap(serial, node, touchscreen=True)
    return host


SELECTOR_PREFIX = "Choose System. Current System: "


def current_system(nodes: list[Node]) -> str | None:
    node = find(nodes, desc_prefix=SELECTOR_PREFIX)
    return node.desc[len(SELECTOR_PREFIX):] if node else None


def collapsed_groups(nodes: list[Node]) -> list[Node]:
    """Selector group headers ("<label>, N Systems") with no radio row under them."""
    headers = sorted(
        (n for n in nodes if re.search(r", \d+ Systems?$", n.desc)), key=lambda n: n.bounds[1]
    )
    radios = [n for n in nodes if n.cls.endswith("RadioButton")]
    out = []
    for i, header in enumerate(headers):
        top = header.bounds[3]
        bottom = headers[i + 1].bounds[1] if i + 1 < len(headers) else 10**9
        if not any(top <= r.bounds[1] < bottom for r in radios):
            out.append(header)
    return out


def select_system(serial: str, name: str, max_scrolls: int = 4) -> float | None:
    """Open the System selector and pick `name` by its row label.

    Returns the host time of the row tap, or None if `name` was already the
    current System (nothing tapped). Collapsed groups are expanded and the sheet
    is scrolled as needed; rows are found by accessibility label, never by
    coordinates.
    """
    nodes = ui_dump(serial)
    dismiss_logbox(serial, nodes)
    if current_system(nodes) == name:
        return None
    button = find(nodes, desc_prefix=SELECTOR_PREFIX)
    if not button:
        raise DeviceError("System selector button not found (is the Orrery tab open?)")
    tap(serial, button, touchscreen=True)
    time.sleep(1.0)
    for attempt in range(max_scrolls + 1):
        nodes = ui_dump(serial)
        row = find(nodes, desc=name) or find(nodes, desc_prefix=f"{name}, ")
        if row:
            host = time.monotonic()
            tap(serial, row)
            return host
        collapsed = collapsed_groups(nodes)
        expanded_any = False
        for header in collapsed:
            tap(serial, header)
            expanded_any = True
            time.sleep(0.6)
        if expanded_any and attempt == 0:
            continue
        heading = find(nodes, desc="Choose System")
        if heading:
            x, y = heading.center
            shell(serial, f"input swipe {x} {y + 900} {x} {y + 200} 400")
            time.sleep(0.8)
    raise DeviceError(f"System row {name!r} not found in the selector")


# --- Output -------------------------------------------------------------------
def write_json(path: str | None, payload: dict) -> None:
    text = json.dumps(payload, indent=2, sort_keys=True)
    if path:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(text + "\n")
    print(text)
