#!/usr/bin/env python3
#
# Decoded-asset extrema for the bundled background art (RG-029 /
# ui-accessibility/AUD-UIA-001 / D-12 "real worst-case composite").
#
# `src/theme/backgrounds.ts` declares, per asset slot, one variant per resolved
# mode (`variants.light`, `variants.dark`; 38.5 D-23), and each variant a
# worst-case `darkestPixel` and `brightestPixel`. The node contrast proof
# (`src/theme/tokens/surface.test.ts`) composites each card/chrome tint over
# BOTH declared pixels instead of decoding the shipped bytes. This script is the
# reproducible bridge between the two: it decodes every bundled asset with
# Pillow (RGB, full resolution) and, for EVERY tint regime of the variant's OWN
# package AND OWN mode (`scripts/background-extrema-regimes.json`; a light
# variant is never rendered in dark mode, 38.5 P-2), composites every pixel
# exactly like `alphaComposite` in `src/theme/tokens/surface.ts` (sRGB-space
# blend, rounded per channel) and finds the pixel with the minimum and maximum
# COMPOSITE WCAG relative luminance.
#
# Why composite, not raw luminance: an sRGB tint blend reorders luminance across
# hues (a white tint @0.5 over pure blue composites DARKER than over the grey of
# equal raw luminance), so the raw extremum can miss the real worst-case
# composite. The reported bounds are channel-wise: darkest = channel-wise MIN of
# the raw-darkest pixel and every regime's composite-argmin pixel; brightest =
# channel-wise MAX of the raw-brightest pixel and every regime's composite-argmax
# pixel. The blend is monotone per channel, so a channel-wise bound is a valid
# bound under every regime and one declared field per variant suffices.
#
# Usage:
#   python3 scripts/measure-background-extrema.py            # report per slot/mode
#   python3 scripts/measure-background-extrema.py --check    # validate declared bounds
#   python3 scripts/measure-background-extrema.py --self-test
#
# Exit codes:
#   0  report printed / every declared bound encloses every regime's decoded
#      composite extrema / self-test passed
#   1  --check found a declared bound that does not enclose a regime's decoded
#      composite extremum (or a slot is missing a declaration), or the
#      self-test failed
#   2  usage error, unreadable asset, unparseable backgrounds.ts / regime table,
#      or a slot missing a light/dark variant block (or a variant missing its
#      require / brightestPixel / darkestPixel)
#
# Dev-time tool only (system Python 3 + Pillow); nothing is added to package.json.

import json
import math
import os
import re
import sys

# ---- Tunables -------------------------------------------------------------
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKGROUNDS_TS = os.path.join(REPO_ROOT, "src", "theme", "backgrounds.ts")
REGIMES_JSON = os.path.join(REPO_ROOT, "scripts", "background-extrema-regimes.json")
# WCAG 2.x sRGB linearisation knee (mirrors src/theme/contrast.ts).
WCAG_KNEE = 0.03928
# ----------------------------------------------------------------------------


def hex_to_rgb(value):
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", value or ""):
        raise ValueError(f"expected #RRGGBB, got {value!r}")
    n = int(value[1:], 16)
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255)


def rgb_to_hex(rgb):
    return "#" + "".join(f"{c:02X}" for c in rgb)


def _channel(c):
    s = c / 255.0
    return s / 12.92 if s <= WCAG_KNEE else ((s + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, g, b = rgb
    return 0.2126 * _channel(r) + 0.7152 * _channel(g) + 0.0722 * _channel(b)


def _js_round(x):
    # JavaScript Math.round (half rounds up), NOT Python's banker's rounding.
    return int(math.floor(x + 0.5))


def composite(tint, px, alpha):
    """Mirror of surface.ts alphaComposite(tint, px, alpha)."""
    a = max(0.0, min(1.0, alpha))
    return tuple(
        max(0, min(255, _js_round(t * a + p * (1 - a)))) for t, p in zip(tint, px)
    )


def load_regimes():
    try:
        with open(REGIMES_JSON, encoding="utf-8") as fh:
            data = json.load(fh)
        regimes = data["regimes"]
        for r in regimes:
            hex_to_rgb(r["tint"])
            float(r["opacity"])
            if r["package"] not in ("galaxy", "standard"):
                raise ValueError(f"unknown package {r['package']!r}")
            if r["mode"] not in ("dark", "light"):
                raise ValueError(f"unknown mode {r['mode']!r}")
            if r["treatment"] not in ("card", "chrome"):
                raise ValueError(f"unknown treatment {r['treatment']!r}")
    except (OSError, KeyError, ValueError, TypeError) as err:
        print(f"measure-background-extrema: bad regime table: {err}", file=sys.stderr)
        sys.exit(2)
    if not regimes:
        print("measure-background-extrema: regime table is empty", file=sys.stderr)
        sys.exit(2)
    return regimes


MODES = ("light", "dark")
# BACKGROUND_SLOTS layout (src/theme/backgrounds.ts, fixed for this parser):
#   slot key at 2 spaces; `package:` and `variants: {` at 4; `light: {` /
#   `dark: {` at 6; `source` / `brightestPixel` / `darkestPixel` at 8.
SLOT_RE = re.compile(r'^  "([a-z0-9-]+)": \{\n(.*?)\n  \},?$', re.M | re.S)
VARIANT_RE = re.compile(r"^      (light|dark): \{\n(.*?)\n      \},?$", re.M | re.S)


class ParseError(ValueError):
    pass


def parse_slot_source(source, base_dir):
    """Parse the nested BACKGROUND_SLOTS layout into one row per (slot, mode).

    Raises ParseError when a slot lacks either variant block, or a variant lacks
    its require / brightestPixel / darkestPixel.
    """
    rows = []
    for slot_id, body in SLOT_RE.findall(source):
        pkg = re.search(r'^    package: "(galaxy|standard)"', body, re.M)
        if not pkg:
            continue  # not a BACKGROUND_SLOTS entry (e.g. another object literal)
        if not re.search(r"^    variants: \{", body, re.M):
            raise ParseError(f"{slot_id}: no `variants: {{` block")
        variants = dict(VARIANT_RE.findall(body))
        for mode in MODES:
            vbody = variants.get(mode)
            if vbody is None:
                raise ParseError(f"{slot_id}: missing {mode} variant block")
            req = re.search(r'require\("([^"]+)"\)', vbody)
            bright = re.search(r'brightestPixel: "(#[0-9A-Fa-f]{6})"', vbody)
            dark = re.search(r'darkestPixel: "(#[0-9A-Fa-f]{6})"', vbody)
            missing = [
                name
                for name, found in (
                    ("require", req),
                    ("brightestPixel", bright),
                    ("darkestPixel", dark),
                )
                if not found
            ]
            if missing:
                raise ParseError(f"{slot_id}/{mode}: missing {', '.join(missing)}")
            rows.append(
                {
                    "slot": slot_id,
                    "mode": mode,
                    "package": pkg.group(1),
                    "asset": os.path.normpath(os.path.join(base_dir, req.group(1))),
                    "brightestPixel": bright.group(1),
                    "darkestPixel": dark.group(1),
                }
            )
    return rows


def parse_slots():
    """Parse BACKGROUND_SLOTS from backgrounds.ts: one row per (slot, mode) variant."""
    try:
        with open(BACKGROUNDS_TS, encoding="utf-8") as fh:
            source = fh.read()
    except OSError as err:
        print(f"measure-background-extrema: {err}", file=sys.stderr)
        sys.exit(2)
    try:
        rows = parse_slot_source(source, os.path.dirname(BACKGROUNDS_TS))
    except ParseError as err:
        print(f"measure-background-extrema: backgrounds.ts: {err}", file=sys.stderr)
        sys.exit(2)
    if not rows:
        print(
            "measure-background-extrema: no BACKGROUND_SLOTS entries parsed", file=sys.stderr
        )
        sys.exit(2)
    return rows


def decode_colors(path):
    from PIL import Image  # imported lazily so --help style errors need no Pillow

    try:
        with Image.open(path) as im:
            rgb = im.convert("RGB")
            w, h = rgb.size
            colors = rgb.getcolors(maxcolors=w * h)
    except OSError as err:
        print(f"measure-background-extrema: cannot decode {path}: {err}", file=sys.stderr)
        sys.exit(2)
    return [c for _, c in colors]


def measure(pixels, regimes):
    """Return (bounds, per-regime composite extrema) for one decoded pixel set."""
    raw_dark = min(pixels, key=luminance)
    raw_bright = max(pixels, key=luminance)
    per_regime = []
    dark_candidates = [raw_dark]
    bright_candidates = [raw_bright]
    for r in regimes:
        tint = hex_to_rgb(r["tint"])
        alpha = float(r["opacity"])
        lo_px, lo_l, hi_px, hi_l = None, math.inf, None, -math.inf
        for px in pixels:
            lum = luminance(composite(tint, px, alpha))
            if lum < lo_l:
                lo_px, lo_l = px, lum
            if lum > hi_l:
                hi_px, hi_l = px, lum
        per_regime.append(
            {"regime": r, "min_px": lo_px, "min_l": lo_l, "max_px": hi_px, "max_l": hi_l}
        )
        dark_candidates.append(lo_px)
        bright_candidates.append(hi_px)
    darkest = tuple(min(c[i] for c in dark_candidates) for i in range(3))
    brightest = tuple(max(c[i] for c in bright_candidates) for i in range(3))
    return {
        "raw_dark": raw_dark,
        "raw_bright": raw_bright,
        "darkest": darkest,
        "brightest": brightest,
        "per_regime": per_regime,
    }


def regime_label(r):
    return f"{r['package']}/{r['mode']}/{r['treatment']} {r['tint']}@{r['opacity']}"


def run(check):
    regimes = load_regimes()
    rows = parse_slots()
    failures = []
    decoded = {}
    for slot in rows:
        slot_id = f"{slot['slot']}/{slot['mode']}"
        # A variant renders only in its own package AND mode (38.5 P-2).
        own = [
            r
            for r in regimes
            if r["package"] == slot["package"] and r["mode"] == slot["mode"]
        ]
        if not own:
            failures.append(
                f"{slot_id}: no regime for package {slot['package']} mode {slot['mode']}"
            )
            continue
        if slot["asset"] not in decoded:
            decoded[slot["asset"]] = decode_colors(slot["asset"])
        m = measure(decoded[slot["asset"]], own)
        print(
            f"{slot_id} ({slot['package']}): raw darkest {rgb_to_hex(m['raw_dark'])}, "
            f"raw brightest {rgb_to_hex(m['raw_bright'])}; "
            f"bound darkestPixel {rgb_to_hex(m['darkest'])}, "
            f"brightestPixel {rgb_to_hex(m['brightest'])} "
            f"(declared {slot['darkestPixel']} / {slot['brightestPixel']})"
        )
        for pr in m["per_regime"]:
            print(
                f"    {regime_label(pr['regime'])}: composite min L={pr['min_l']:.5f} "
                f"at {rgb_to_hex(pr['min_px'])}, max L={pr['max_l']:.5f} "
                f"at {rgb_to_hex(pr['max_px'])}"
            )
        if not check:
            continue
        if slot["darkestPixel"] is None or slot["brightestPixel"] is None:
            failures.append(f"{slot_id}: missing darkestPixel/brightestPixel declaration")
            continue
        dark = hex_to_rgb(slot["darkestPixel"])
        bright = hex_to_rgb(slot["brightestPixel"])
        for pr in m["per_regime"]:
            r = pr["regime"]
            tint = hex_to_rgb(r["tint"])
            alpha = float(r["opacity"])
            dl = luminance(composite(tint, dark, alpha))
            bl = luminance(composite(tint, bright, alpha))
            if dl > pr["min_l"]:
                failures.append(
                    f"{slot_id} {regime_label(r)}: declared darkestPixel "
                    f"{slot['darkestPixel']} composites to L={dl:.5f} > decoded min "
                    f"L={pr['min_l']:.5f} (pixel {rgb_to_hex(pr['min_px'])}); "
                    f"use {rgb_to_hex(m['darkest'])}"
                )
            if bl < pr["max_l"]:
                failures.append(
                    f"{slot_id} {regime_label(r)}: declared brightestPixel "
                    f"{slot['brightestPixel']} composites to L={bl:.5f} < decoded max "
                    f"L={pr['max_l']:.5f} (pixel {rgb_to_hex(pr['max_px'])}); "
                    f"use {rgb_to_hex(m['brightest'])}"
                )
    if failures:
        print("\nmeasure-background-extrema: declared bounds do NOT enclose the decoded composites:",
              file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1
    if check:
        print("\nmeasure-background-extrema: every declared bound encloses every regime's "
              "decoded composite extrema.")
    return 0


def self_test():
    """Raw-vs-composite ordering fixture: pure blue vs the grey of equal raw luminance."""
    blue = (0, 0, 255)
    target = luminance(blue)
    grey = min(((v, v, v) for v in range(256)), key=lambda g: abs(luminance(g) - target))
    white = (255, 255, 255)
    ok = True
    comp_blue = luminance(composite(white, blue, 0.5))
    comp_grey = luminance(composite(white, grey, 0.5))
    print(
        f"self-test: blue L={target:.4f}, grey {rgb_to_hex(grey)} L={luminance(grey):.4f}; "
        f"white@0.5 composites blue L={comp_blue:.4f}, grey L={comp_grey:.4f}"
    )
    # The two raw luminances are (near-)equal, yet the composite argmin is blue.
    if abs(luminance(grey) - target) > 0.005:
        print("self-test FAILED: grey fixture does not match blue's raw luminance", file=sys.stderr)
        ok = False
    m = measure([grey, blue], [{"tint": "#FFFFFF", "opacity": 0.5}])
    if m["per_regime"][0]["min_px"] != blue:
        print("self-test FAILED: composite argmin under white@0.5 is not the blue pixel",
              file=sys.stderr)
        ok = False
    # alphaComposite parity spot-checks (surface.test.ts fixtures).
    if composite((0, 0, 0), (255, 255, 255), 0.5) != (128, 128, 128):
        print("self-test FAILED: composite(#000, #FFF, 0.5) != #808080", file=sys.stderr)
        ok = False
    if composite(hex_to_rgb("#123456"), hex_to_rgb("#ABCDEF"), 1) != hex_to_rgb("#123456"):
        print("self-test FAILED: alpha=1 must return the tint", file=sys.stderr)
        ok = False
    # Nested-variant parser fixture (38.5 D-23): one slot, two variants -> two rows.
    sample = (
        "  \"fixture-slot\": {\n"
        "    package: \"galaxy\",\n"
        "    variants: {\n"
        "      light: {\n"
        "        source: () => require(\"./light.webp\"),\n"
        "        brightestPixel: \"#EEEEEE\",\n"
        "        darkestPixel: \"#111111\",\n"
        "      },\n"
        "      dark: {\n"
        "        source: () => require(\"./dark.webp\"),\n"
        "        brightestPixel: \"#222222\",\n"
        "        darkestPixel: \"#000000\",\n"
        "      },\n"
        "    },\n"
        "  },\n"
    )
    rows = parse_slot_source(sample, "/fixture")
    got = [(r["slot"], r["mode"], os.path.basename(r["asset"]), r["brightestPixel"],
            r["darkestPixel"]) for r in rows]
    want = [
        ("fixture-slot", "light", "light.webp", "#EEEEEE", "#111111"),
        ("fixture-slot", "dark", "dark.webp", "#222222", "#000000"),
    ]
    if got != want:
        print(f"self-test FAILED: two-variant parse gave {got!r}", file=sys.stderr)
        ok = False
    else:
        print("self-test: two-variant sample parsed to 2 rows (light, dark)")
    # A slot missing its dark variant must be a parse error (exit 2 at run time).
    one_variant = sample.split("      dark: {")[0] + "    },\n  },\n"
    try:
        parse_slot_source(one_variant, "/fixture")
        print("self-test FAILED: a missing dark variant was not rejected", file=sys.stderr)
        ok = False
    except ParseError as err:
        print(f"self-test: missing variant rejected ({err})")
    print("self-test passed" if ok else "self-test FAILED")
    return 0 if ok else 1


def main(argv):
    args = argv[1:]
    if args == ["--self-test"]:
        return self_test()
    if args == ["--check"]:
        return run(check=True)
    if args == []:
        return run(check=False)
    print(
        "usage: measure-background-extrema.py [--check | --self-test]", file=sys.stderr
    )
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
