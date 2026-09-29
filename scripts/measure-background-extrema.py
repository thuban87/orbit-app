#!/usr/bin/env python3
#
# Decoded-asset extrema for the bundled background art (RG-029 /
# ui-accessibility/AUD-UIA-001 / D-12 "real worst-case composite").
#
# `src/theme/backgrounds.ts` declares, per asset slot, one variant per resolved
# mode (`variants.light`, `variants.dark`; 38.5 D-23), and each variant a
# worst-case `darkestPixel` and `brightestPixel`. The node contrast proofs
# (`src/theme/tokens/surface.test.ts`) composite each card / chrome / veil tint
# over BOTH declared pixels instead of decoding the shipped bytes. This script is
# the reproducible bridge between the two: it decodes every bundled asset with
# Pillow (RGB, full resolution) and, for EVERY tint regime of the variant's OWN
# package AND OWN mode (`scripts/background-extrema-regimes.json`: card, chrome
# and the BackgroundHost veil at every density, 38.5-03; the Profile route's
# profileBackgroundScrim, 38.5-05; the signed see-through backings of the
# table-driven components, listEntry / cardEntry / artChrome, 38.5-08; a light
# variant is never rendered in dark mode, 38.5 P-2), composites every pixel
# exactly like
# `alphaComposite` in `src/theme/tokens/surface.ts` (sRGB-space blend, rounded
# per channel) and finds the pixel with the minimum and maximum COMPOSITE WCAG
# relative luminance.
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
# FEATURE ALLOWANCE (38.5 D-20; M-4 union semantics, defined in
# scripts/background_manifest.py): a variant may carry an owner-signed
# `featureAllowance: { maxComponentPx, maxFailingPct, acceptedAt }`. Its declared
# extrema are then the TEXT-BEARING bound after the allowance (the checker's
# `textBearingBound`, or a value inside an empty luminance band between the
# text-bearing pixels and the allowed features; such a declared bound may be
# luminance-only rather than channel-wise, because every check compares
# composite luminance: the Starfield bounds, 38.5-ART-SIGNOFF.md §5), and
# `--check` instead: finds every decoded colour whose
# composite falls outside the declared bounds' composites under ANY regime of
# the variant (card, chrome, veil at every density, profile, the signed art
# treatments listEntry / cardEntry / artChrome, and any regime added later),
# locates those pixels, takes their UNION across regimes (a pixel out of bound
# in several regimes counts once; disjoint pixels that each fit alone can fail
# together), labels its 8-connected components, and passes only when every
# component is <= maxComponentPx pixels and the union is <= maxFailingPct percent
# of the canvas. With no allowance the check is the plain enclosure test.
# Exclusions (38.5-ART-SIGNOFF.md) are NOT read here: an exclusion never narrows
# a declared bound.
#
# Usage:
#   python3 scripts/measure-background-extrema.py            # report per slot/mode
#   python3 scripts/measure-background-extrema.py --check    # validate declared bounds
#   python3 scripts/measure-background-extrema.py --self-test
#   python3 scripts/measure-background-extrema.py --help
#
# Exit codes:
#   0  report printed / every declared bound encloses every regime's decoded
#      composite extrema (or, with an allowance, everything outside it is allowed
#      specks) / self-test passed
#   1  --check found a declared bound that does not enclose a regime's decoded
#      composite extremum (or a slot is missing a declaration, or the union of
#      out-of-bound pixels exceeds the variant's allowance), or the self-test
#      failed
#   2  usage error, unreadable asset, unparseable backgrounds.ts / regime table,
#      or a slot missing a light/dark variant block (or a variant missing its
#      require / brightestPixel / darkestPixel, or a malformed featureAllowance)
#
# Dev-time tool only (system Python 3 + Pillow); nothing is added to package.json.

import json
import math
import os
import re
import sys
from collections import deque

# ---- Tunables -------------------------------------------------------------
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REGIMES_JSON = os.path.join(REPO_ROOT, "scripts", "background-extrema-regimes.json")
# WCAG 2.x sRGB linearisation knee (mirrors src/theme/contrast.ts).
WCAG_KNEE = 0.03928
# ----------------------------------------------------------------------------

# listEntry / cardEntry / artChrome: the owner-signed see-through backings of the
# table-driven components (38.5-08; ART_SEE_THROUGH_OPACITY in surface.ts).
TREATMENTS = ("card", "chrome", "veil", "profile", "listEntry", "cardEntry", "artChrome")
DENSITIES = ("presentation", "comfortable", "dense")

# The variant parser lives in scripts/background_manifest.py (38.5-03), shared
# with scripts/check-background-art.py so both validators read the same manifest.
sys.dont_write_bytecode = True  # no scripts/__pycache__ in the working tree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import background_manifest as bm  # noqa: E402
from background_manifest import ParseError, parse_manifest, parse_slot_source  # noqa: E402


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


def validate_regimes(regimes):
    """Raise ValueError on a malformed regime row."""
    for r in regimes:
        hex_to_rgb(r["tint"])
        float(r["opacity"])
        if r["package"] not in ("galaxy", "standard"):
            raise ValueError(f"unknown package {r['package']!r}")
        if r["mode"] not in ("dark", "light"):
            raise ValueError(f"unknown mode {r['mode']!r}")
        if r["treatment"] not in TREATMENTS:
            raise ValueError(f"unknown treatment {r['treatment']!r}")
        if r["treatment"] == "veil":
            if r.get("density") not in DENSITIES:
                raise ValueError(
                    f"veil regime {r['package']}/{r['mode']} needs a density in {DENSITIES}"
                )
        elif "density" in r:
            raise ValueError(f"{r['treatment']} regime must not carry a density")


def load_regimes():
    try:
        with open(REGIMES_JSON, encoding="utf-8") as fh:
            data = json.load(fh)
        regimes = data["regimes"]
        validate_regimes(regimes)
    except (OSError, KeyError, ValueError, TypeError) as err:
        print(f"measure-background-extrema: bad regime table: {err}", file=sys.stderr)
        sys.exit(2)
    if not regimes:
        print("measure-background-extrema: regime table is empty", file=sys.stderr)
        sys.exit(2)
    return regimes


def parse_slots():
    """Parse BACKGROUND_SLOTS from backgrounds.ts: one row per (slot, mode) variant."""
    try:
        return parse_manifest()
    except ParseError as err:
        print(f"measure-background-extrema: backgrounds.ts: {err}", file=sys.stderr)
        sys.exit(2)


def decode(path):
    """(RGB image, unique colours) for one asset."""
    from PIL import Image  # imported lazily so usage errors need no Pillow

    try:
        with Image.open(path) as im:
            rgb = im.convert("RGB")
            rgb.load()
    except OSError as err:
        print(f"measure-background-extrema: cannot decode {path}: {err}", file=sys.stderr)
        sys.exit(2)
    return rgb, colours_of(rgb)


def colours_of(rgb):
    w, h = rgb.size
    return [c for _, c in rgb.getcolors(maxcolors=w * h)]


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
    density = f"/{r['density']}" if r.get("density") else ""
    return f"{r['package']}/{r['mode']}/{r['treatment']}{density} {r['tint']}@{r['opacity']}"


# ---- D-20 feature allowance -------------------------------------------------
def out_of_bound_colours(colours, regimes, dark, bright):
    """Per regime, the colours whose composite lies outside the declared bounds'
    composites (strictly darker than the darkest, or brighter than the brightest)."""
    per = []
    for r in regimes:
        tint = hex_to_rgb(r["tint"])
        alpha = float(r["opacity"])
        lo = luminance(composite(tint, dark, alpha))
        hi = luminance(composite(tint, bright, alpha))
        bad = set()
        for c in colours:
            lum = luminance(composite(tint, c, alpha))
            if lum < lo or lum > hi:
                bad.add(c)
        per.append((r, bad))
    return per


def locate(rgb, colours):
    """Sparse (x, y) of every pixel whose colour is in `colours` (Pillow getdata)."""
    if not colours:
        return set()
    w = rgb.size[0]
    return {(i % w, i // w) for i, c in enumerate(rgb.getdata()) if c in colours}


def component_sizes(points):
    """Sizes of the 8-connected components of a set of (x, y) points."""
    todo = set(points)
    sizes = []
    while todo:
        seed = todo.pop()
        queue = deque([seed])
        n = 0
        while queue:
            x, y = queue.popleft()
            n += 1
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nb = (x + dx, y + dy)
                    if nb in todo:
                        todo.remove(nb)
                        queue.append(nb)
        sizes.append(n)
    return sizes


def allowance_check(rgb, colours, regimes, dark, bright, allowance):
    """Union (across regimes) of out-of-bound pixels vs. a D-20 allowance."""
    per = out_of_bound_colours(colours, regimes, dark, bright)
    union_colours = set().union(*(bad for _, bad in per)) if per else set()
    points = locate(rgb, union_colours)
    total = rgb.size[0] * rgb.size[1]
    sizes = component_sizes(points)
    largest = max(sizes) if sizes else 0
    pct = len(points) / total * 100
    ok = largest <= allowance["maxComponentPx"] and pct <= allowance["maxFailingPct"]
    return {
        "ok": ok,
        "union_px": len(points),
        "union_pct": pct,
        "components": len(sizes),
        "largest": largest,
        "per_regime_px": [(r, len(locate(rgb, bad))) for r, bad in per],
    }


def check_variant(slot, rgb, colours, regimes, m=None):
    """Failure strings for one variant's declared bounds under its regimes."""
    slot_id = f"{slot['slot']}/{slot['mode']}"
    if slot["darkestPixel"] is None or slot["brightestPixel"] is None:
        return [f"{slot_id}: missing darkestPixel/brightestPixel declaration"], None
    dark = hex_to_rgb(slot["darkestPixel"])
    bright = hex_to_rgb(slot["brightestPixel"])
    allowance = slot.get("featureAllowance")
    if allowance:
        res = allowance_check(rgb, colours, regimes, dark, bright, allowance)
        if res["ok"]:
            return [], res
        return [
            f"{slot_id}: out-of-bound union {res['union_px']} px ({res['union_pct']:.4f}%), "
            f"{res['components']} components, largest {res['largest']} px exceeds the "
            f"featureAllowance (maxComponentPx {allowance['maxComponentPx']}, maxFailingPct "
            f"{allowance['maxFailingPct']})"
        ], res
    if m is None:
        m = measure(colours, regimes)
    failures = []
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
    return failures, None


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
            decoded[slot["asset"]] = decode(slot["asset"])
        rgb, colours = decoded[slot["asset"]]
        m = measure(colours, own)
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
        found, res = check_variant(slot, rgb, colours, own, m)
        if res is not None:
            print(
                f"    featureAllowance {slot['featureAllowance']}: out-of-bound union "
                f"{res['union_px']} px ({res['union_pct']:.4f}%), {res['components']} "
                f"8-connected components, largest {res['largest']} px -> "
                f"{'within' if res['ok'] else 'EXCEEDS'} the allowance"
            )
        failures.extend(found)
    if failures:
        print("\nmeasure-background-extrema: declared bounds do NOT enclose the decoded composites:",
              file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1
    if check:
        print("\nmeasure-background-extrema: every declared bound encloses every regime's "
              "decoded composite extrema (or leaves only allowed specks outside it).")
    return 0


# ---- self-test --------------------------------------------------------------
def self_test():
    """Composite-ordering, parser, allowance, union and cross-script fixtures."""
    from PIL import Image

    ok = True

    def expect(cond, label):
        nonlocal ok
        print(f"self-test: {'ok  ' if cond else 'FAIL'} {label}")
        if not cond:
            ok = False

    blue = (0, 0, 255)
    target = luminance(blue)
    grey = min(((v, v, v) for v in range(256)), key=lambda g: abs(luminance(g) - target))
    white = (255, 255, 255)
    comp_blue = luminance(composite(white, blue, 0.5))
    comp_grey = luminance(composite(white, grey, 0.5))
    print(
        f"self-test: blue L={target:.4f}, grey {rgb_to_hex(grey)} L={luminance(grey):.4f}; "
        f"white@0.5 composites blue L={comp_blue:.4f}, grey L={comp_grey:.4f}"
    )
    # The two raw luminances are (near-)equal, yet the composite argmin is blue.
    expect(abs(luminance(grey) - target) <= 0.005, "grey fixture matches blue's raw luminance")
    m = measure([grey, blue], [{"tint": "#FFFFFF", "opacity": 0.5}])
    expect(m["per_regime"][0]["min_px"] == blue, "composite argmin under white@0.5 is the blue pixel")
    # alphaComposite parity spot-checks (surface.test.ts fixtures).
    expect(composite((0, 0, 0), (255, 255, 255), 0.5) == (128, 128, 128),
           "composite(black, white, 0.5) is mid-grey 128")
    expect(composite(hex_to_rgb("#123456"), hex_to_rgb("#ABCDEF"), 1) == hex_to_rgb("#123456"),
           "alpha=1 returns the tint")

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
    expect(got == [("fixture-slot", "light", "light.webp", "#EEEEEE", "#111111"),
                   ("fixture-slot", "dark", "dark.webp", "#222222", "#000000")],
           "two-variant sample parses to 2 rows (light, dark)")
    # A comment quoting a field is never the declaration (code review IN-04).
    commented = sample.replace(
        "        brightestPixel: \"#EEEEEE\",\n",
        "        // was brightestPixel: \"#ABCDEF\" before the re-master\n"
        "        /* darkestPixel: \"#FEDCBA\" */\n"
        "        brightestPixel: \"#EEEEEE\",\n",
    )
    rows = parse_slot_source(commented, "/fixture")
    expect([(r["brightestPixel"], r["darkestPixel"]) for r in rows]
           == [("#EEEEEE", "#111111"), ("#222222", "#000000")],
           "a commented-out field is ignored; the declaration is read")
    only_comment = sample.replace(
        "        darkestPixel: \"#111111\",\n", "        // darkestPixel: \"#111111\",\n"
    )
    try:
        parse_slot_source(only_comment, "/fixture")
        expect(False, "a field present only in a comment is missing")
    except ParseError as err:
        expect(True, f"a field present only in a comment is missing ({err})")

    one_variant = sample.split("      dark: {")[0] + "    },\n  },\n"
    try:
        parse_slot_source(one_variant, "/fixture")
        expect(False, "a missing dark variant is rejected")
    except ParseError as err:
        expect(True, f"a missing dark variant is rejected ({err})")

    # Veil regimes (38.5-03): a veil row needs a density; card/chrome carry none.
    for bad_row, label in (
        ({"package": "galaxy", "mode": "dark", "treatment": "veil", "tint": "#000000",
          "opacity": 0.1}, "a veil row without a density"),
        ({"package": "galaxy", "mode": "dark", "treatment": "veil", "density": "roomy",
          "tint": "#000000", "opacity": 0.1}, "a veil row with an unknown density"),
        ({"package": "galaxy", "mode": "dark", "treatment": "scrim", "tint": "#000000",
          "opacity": 0.1}, "an unknown treatment"),
        ({"package": "standard", "mode": "dark", "treatment": "listEntry",
          "density": "presentation", "tint": "#000000", "opacity": 0.05},
         "an art-treatment row with a density"),
    ):
        try:
            validate_regimes([bad_row])
            expect(False, f"{label} is rejected")
        except ValueError:
            expect(True, f"{label} is rejected")

    # Signed art-treatment regimes (38.5-08): accepted without a density, and a
    # signed level of 0 composites to the raw pixel.
    try:
        validate_regimes([
            {"package": p, "mode": "dark", "treatment": t, "tint": "#000000", "opacity": 0}
            for p in ("galaxy", "standard") for t in ("listEntry", "cardEntry", "artChrome")
        ])
        expect(True, "listEntry / cardEntry / artChrome rows are accepted")
    except ValueError as err:
        expect(False, f"listEntry / cardEntry / artChrome rows are accepted ({err})")
    expect(composite((255, 255, 255), (12, 34, 56), 0) == (12, 34, 56),
           "a signed see-through level of 0 composites to the raw pixel")

    # ---- D-20 allowance fixture: one isolated 2-px feature ------------------
    def image(w, h, base, paint=()):
        im = Image.new("RGB", (w, h), base)
        for (x, y, pw, ph), colour in paint:
            for yy in range(y, y + ph):
                for xx in range(x, x + pw):
                    im.putpixel((xx, yy), colour)
        return im

    gd_regimes = [r for r in load_regimes() if r["package"] == "galaxy" and r["mode"] == "dark"]
    base = (5, 5, 5)
    feat = image(50, 40, base, [((20, 20, 2, 1), (200, 200, 200))])  # 2 px of 2000 = 0.1%
    variant = {"slot": "fixture", "mode": "dark", "package": "galaxy",
               "darkestPixel": rgb_to_hex(base), "brightestPixel": rgb_to_hex(base)}
    found, _ = check_variant({**variant, "featureAllowance": None}, feat, colours_of(feat),
                             gd_regimes)
    expect(bool(found), "a bound that excludes a 2-px feature fails --check with no allowance")
    found, res = check_variant(
        {**variant, "featureAllowance": {"maxComponentPx": 2, "maxFailingPct": 0.1,
                                         "acceptedAt": "2026-01-01"}},
        feat, colours_of(feat), gd_regimes)
    expect(not found and res["largest"] == 2 and res["components"] == 1,
           "the same passes with maxComponentPx 2 and maxFailingPct 0.1")
    found, _ = check_variant(
        {**variant, "featureAllowance": {"maxComponentPx": 1, "maxFailingPct": 0.1,
                                         "acceptedAt": "2026-01-01"}},
        feat, colours_of(feat), gd_regimes)
    expect(bool(found), "the same fails with maxComponentPx 1")

    # ---- M-4 union fixtures ---------------------------------------------------
    # Declared [#4B4B4B, #4C4C4C]. Pure blue sits inside it raw (identity regime)
    # but composites darker under white@0.5; #4D4D4D is out raw but rounds onto the
    # bound under white@0.5. So the two regimes flag DISJOINT pixels.
    identity = {"package": "galaxy", "mode": "dark", "treatment": "card", "tint": "#000000",
                "opacity": 0.0}
    white_half = {"package": "galaxy", "mode": "dark", "treatment": "chrome", "tint": "#FFFFFF",
                  "opacity": 0.5}
    lo, hi = (75, 75, 75), (76, 76, 76)
    a05 = {"maxComponentPx": 30, "maxFailingPct": 0.5, "acceptedAt": "2026-01-01"}
    disjoint = image(100, 100, lo, [((0, 0, 6, 5), blue), ((50, 50, 6, 5), (77, 77, 77))])
    cols = colours_of(disjoint)
    alone = [allowance_check(disjoint, cols, [r], lo, hi, a05) for r in (identity, white_half)]
    expect([a["union_px"] for a in alone] == [30, 30] and all(a["ok"] for a in alone),
           "each regime alone flags 30 disjoint px (0.3%) and fits maxFailingPct 0.5")
    both = allowance_check(disjoint, cols, [identity, white_half], lo, hi, a05)
    expect(both["union_px"] == 60 and not both["ok"],
           "the union of disjoint out-of-bound pixels (0.6%) exceeds the allowance")
    same = image(100, 100, lo, [((10, 10, 3, 3), white)])
    res = allowance_check(same, colours_of(same), [identity, white_half], lo, hi,
                          {"maxComponentPx": 9, "maxFailingPct": 0.1, "acceptedAt": "2026-01-01"})
    expect(res["union_px"] == 9 and res["ok"] and all(n == 9 for _, n in res["per_regime_px"]),
           "the same out-of-bound pixels in two regimes count once (9 px, not 18)")

    # ---- C2-L3: the checker's textBearingBound passes here -------------------
    fx = bm.ALLOWANCE_FIXTURE
    fw, fh = fx["size"]
    shared = image(fw, fh, fx["baseLeft"], [((fw // 2, 0, fw - fw // 2, fh), fx["baseRight"])]
                   + [(s, fx["speckColor"]) for s in fx["specks"]])
    fx_regimes = [r for r in load_regimes()
                  if r["package"] == fx["package"] and r["mode"] == fx["mode"]]
    fx_variant = {"slot": "shared-fixture", "mode": fx["mode"], "package": fx["package"],
                  "darkestPixel": rgb_to_hex(fx["expectedBound"]["darkest"]),
                  "brightestPixel": rgb_to_hex(fx["expectedBound"]["brightest"])}
    found, res = check_variant({**fx_variant, "featureAllowance": fx["allowance"]}, shared,
                               colours_of(shared), fx_regimes)
    expect(not found, f"the shared fixture's textBearingBound passes --check with its allowance "
                      f"(union {res['union_px']} px, largest {res['largest']})")
    found, _ = check_variant({**fx_variant, "featureAllowance": None}, shared,
                             colours_of(shared), fx_regimes)
    expect(bool(found), "the shared fixture fails --check without the allowance")

    # ---- C2-L1 parser fixtures on the real manifest ---------------------------
    with open(bm.BACKGROUNDS_TS, encoding="utf-8") as fh_:
        real = fh_.read()
    base_rows = parse_manifest(real)
    first_variant = re.search(r"^      (light|dark): \{\n(.*?)\n      \},?$", real, re.M | re.S)
    line = ('        featureAllowance: { maxComponentPx: 9, maxFailingPct: 0.1, '
            'acceptedAt: "2026-01-01" },')
    insert_at = first_variant.end(2)
    modified = real[:insert_at] + "\n" + line + real[insert_at:]
    mod_rows = parse_manifest(modified)
    want_fa = {"maxComponentPx": 9, "maxFailingPct": 0.1, "acceptedAt": "2026-01-01"}
    first_key = (base_rows[0]["slot"], base_rows[0]["mode"])
    expect((mod_rows[0]["slot"], mod_rows[0]["mode"]) == first_key
           and mod_rows[0]["featureAllowance"] == want_fa,
           f"a real {first_key[0]}/{first_key[1]} line with featureAllowance parses to {want_fa}")
    same_rest = len(mod_rows) == len(base_rows) and all(
        {k: v for k, v in a.items() if not (i == 0 and k == "featureAllowance")}
        == {k: v for k, v in b.items() if not (i == 0 and k == "featureAllowance")}
        for i, (a, b) in enumerate(zip(mod_rows, base_rows))
    )
    # The fixture line goes into the FIRST variant, which must not already carry an
    # allowance (38.5-05 ships signed allowances on the two Starfield variants, so
    # "no real variant has one" no longer holds; only the target must be clean).
    expect(same_rest and base_rows[0]["featureAllowance"] is None,
           "every other field equals parse_manifest() on the unmodified file")
    # The formatter wraps a long object literal; the wrapped form parses the same.
    wrapped = ('        featureAllowance: {\n          maxComponentPx: 9,\n'
               '          maxFailingPct: 0.1,\n          acceptedAt: "2026-01-01",\n        },')
    wrapped_rows = parse_manifest(real[:insert_at] + "\n" + wrapped + real[insert_at:])
    expect(wrapped_rows[0]["featureAllowance"] == want_fa,
           "the formatter-wrapped multi-line featureAllowance parses to the same values")
    try:
        parse_manifest(real[:insert_at] + "\n        featureAllowance: { maxComponentPx: 0, "
                       "maxFailingPct: 0.1, acceptedAt: \"2026-01-01\" }," + real[insert_at:])
        expect(False, "a featureAllowance with maxComponentPx 0 is rejected")
    except ParseError as err:
        expect(True, f"a featureAllowance with maxComponentPx 0 is rejected ({err})")

    accents = bm.accent_ids()

    def signoff(allowances):
        return (f"# ART sign-off\n\n{bm.ACCEPTED_EXCLUSIONS_HEADING}\n\n```json\n"
                + json.dumps({"allowances": allowances, "exclusions": []}) + "\n```\n")

    good = {"slotId": "galaxy-aurora", "mode": "dark", "maxComponentPx": 25,
            "maxFailingPct": 0.5, "acceptedAt": "2026-09-28"}
    try:
        bm.parse_accepted_exclusions_text(signoff([good]), accents)
        expect(True, "a well-formed allowance parses")
    except ParseError as err:
        expect(False, f"a well-formed allowance parses ({err})")
    bad_cases = [
        ("a missing maxComponentPx", [{k: v for k, v in good.items() if k != "maxComponentPx"}]),
        ("a non-integer maxComponentPx", [{**good, "maxComponentPx": 1.5}]),
        ("a zero maxComponentPx", [{**good, "maxComponentPx": 0}]),
        ("maxFailingPct of 0", [{**good, "maxFailingPct": 0}]),
        ("maxFailingPct above 100", [{**good, "maxFailingPct": 100.5}]),
        ("a non-date acceptedAt", [{**good, "acceptedAt": "yesterday"}]),
        ("an unknown key", [{**good, "note": "x"}]),
        ("two entries for the same slotId x mode", [good, {**good, "maxComponentPx": 9}]),
    ]
    for label, allowances in bad_cases:
        try:
            bm.parse_accepted_exclusions_text(signoff(allowances), accents)
            expect(False, f"allowances with {label} raise")
        except ParseError as err:
            expect(True, f"allowances with {label} raise ({err})")

    print("self-test passed" if ok else "self-test FAILED")
    return 0 if ok else 1


HELP = """usage: measure-background-extrema.py [--check | --self-test | --help]

Decode every bundled background variant and report (or --check) its declared
darkestPixel/brightestPixel against every tint regime of its own package AND
mode: card, chrome, the BackgroundHost veil at every density and the Profile
route's profileBackgroundScrim (scripts/background-extrema-regimes.json).

featureAllowance (38.5 D-20): a variant with an owner-signed allowance passes
--check when the UNION, across every regime of the variant, of the pixels whose
composite falls outside the declared bounds' composites has every 8-connected
component <= maxComponentPx pixels and covers <= maxFailingPct percent of the
canvas. A pixel out of bound in several regimes counts once; disjoint pixels
that each fit alone can fail together. Exclusions are never read here.
"""


def main(argv):
    args = argv[1:]
    if args in (["--help"], ["-h"]):
        print(HELP)
        return 0
    if args == ["--self-test"]:
        return self_test()
    if args == ["--check"]:
        return run(check=True)
    if args == []:
        return run(check=False)
    print(HELP, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
