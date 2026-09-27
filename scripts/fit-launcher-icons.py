#!/usr/bin/env python3
#
# Fit the owner's adaptive-icon art inside Android's adaptive-icon safe zone
# (RG-041 / release-readiness/AUD-REL-003, owner ruling D-21, Phase 38.4).
#
# Android sizes every adaptive-icon layer at 108x108dp; launcher masks only
# guarantee the inner 66x66dp (the 66/108 "safe zone") stays visible. Expo's
# prebuild icon pipeline (@expo/prebuild-config withAndroidIcons.js) resizes
# `android.adaptiveIcon.foregroundImage` / `monochromeImage` EDGE-TO-EDGE to the
# 108dp layer (resizeMode "cover") and adds NO padding, so the owner's art — which
# fills ~90% of its canvas — would have its orbits clipped by the mask. The fit
# therefore has to be baked into committed derivative PNGs. This script is that
# reproducible step.
#
# Per source (owner-supplied, committed in 6e7f4e4, never modified here):
#   1. load RGBA; bounding box of pixels with alpha > ALPHA_THRESHOLD;
#   2. crop to it; maximum radial distance of those pixels from the crop centre;
#   3. LANCZOS-scale so that distance equals MARGIN * SAFE_ZONE_RATIO / 2 * OUT_SIZE;
#   4. paste centred on a transparent OUT_SIZE x OUT_SIZE canvas;
#   5. save PNG with no metadata chunks (deterministic output).
# This is a pure geometric fit: no recolouring, no redrawing. The legacy icon
# (`assets/orbit-icon-legacy.png`) is used unmodified and is NOT processed here.
#
# Usage:
#   python3 scripts/fit-launcher-icons.py           # (re)write both derivatives
#   python3 scripts/fit-launcher-icons.py --check   # verify committed derivatives
#
# --check regenerates in memory and fails if a committed derivative's mode, size
# or decoded pixel bytes differ from a fresh run, or if its fitted content's
# maximum radial extent from the canvas centre exceeds the target radius (+1px).
#
# Exit codes:
#   0  derivatives written / --check passed
#   1  --check found a stale, missing or out-of-safe-zone derivative
#   2  usage error or unreadable source
#
# Dev-time tool only (system Python 3 + Pillow); nothing is added to package.json.

import io
import math
import os
import sys

from PIL import Image

# ---- Tunables -------------------------------------------------------------
# Output canvas edge in px (xxxhdpi needs 432px; 1024 leaves headroom).
OUT_SIZE = 1024
# Android adaptive-icon safe zone: inner 66dp of the 108dp layer.
SAFE_ZONE_RATIO = 66 / 108
# Fraction of the safe-zone RADIUS the art's furthest pixel may reach. The
# owner-approved preview's exact margin was not recorded; 0.95 (scale ~0.580 on
# the 1254px source) is the researched value, confirmed on the device pass.
MARGIN = 0.95
# Pixels with alpha at or below this are treated as empty when measuring.
ALPHA_THRESHOLD = 16

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# owner source -> fitted derivative (repo-relative)
SOURCES = {
    "assets/orbit-icon-foreground.png": "assets/orbit-icon-foreground-adaptive.png",
    "assets/orbit-icon-monochrome.png": "assets/orbit-icon-monochrome-adaptive.png",
}
# ---------------------------------------------------------------------------

TARGET_RADIUS = MARGIN * SAFE_ZONE_RATIO / 2 * OUT_SIZE


def _mask(img):
    """1-bit-ish L mask: 255 where alpha > ALPHA_THRESHOLD, else 0."""
    return img.getchannel("A").point(lambda v: 255 if v > ALPHA_THRESHOLD else 0)


def max_radial_extent(img, cx, cy):
    """Max distance (px, measured to pixel centres) of any content pixel from (cx, cy).

    Per row the furthest content pixel is the leftmost or rightmost one, so only
    those two are measured.
    """
    mask = _mask(img)
    w, h = mask.size
    data = mask.tobytes()
    best = 0.0
    for y in range(h):
        row = data[y * w : (y + 1) * w]
        left = row.find(b"\xff")
        if left < 0:
            continue
        right = row.rfind(b"\xff")
        dy = y + 0.5 - cy
        for x in (left, right):
            best = max(best, math.hypot(x + 0.5 - cx, dy))
    return best


def fit(src_path):
    """Return the fitted OUT_SIZE x OUT_SIZE RGBA derivative of one source."""
    src = Image.open(src_path).convert("RGBA")
    bbox = _mask(src).getbbox()
    if bbox is None:
        raise ValueError(f"{src_path}: no pixel has alpha > {ALPHA_THRESHOLD}")
    art = src.crop(bbox)
    w, h = art.size
    extent = max_radial_extent(art, w / 2, h / 2)
    scale = TARGET_RADIUS / extent
    size = (max(1, round(w * scale)), max(1, round(h * scale)))
    # Pillow resamples RGBA in premultiplied alpha, so edges do not fringe.
    scaled = art.resize(size, Image.LANCZOS)
    canvas = Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))
    canvas.paste(scaled, ((OUT_SIZE - size[0]) // 2, (OUT_SIZE - size[1]) // 2))
    return canvas, scale


def encode(img):
    """Deterministic PNG bytes: no text/ICC/gamma/dpi chunks carried over."""
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=False, compress_level=9)
    return buf.getvalue()


def main(argv):
    args = argv[1:]
    if args not in ([], ["--check"]):
        print("usage: fit-launcher-icons.py [--check]", file=sys.stderr)
        return 2
    check = args == ["--check"]
    failures = []
    for src_rel, out_rel in SOURCES.items():
        src_path = os.path.join(REPO_ROOT, src_rel)
        out_path = os.path.join(REPO_ROOT, out_rel)
        try:
            fresh, scale = fit(src_path)
        except (OSError, ValueError) as err:
            print(f"error: {err}", file=sys.stderr)
            return 2
        if not check:
            with open(out_path, "wb") as fh:
                fh.write(encode(fresh))
            print(f"wrote {out_rel} (scale {scale:.4f}, margin {MARGIN})")
            continue
        try:
            committed = Image.open(out_path)
            committed.load()
        except OSError as err:
            failures.append(f"{out_rel}: unreadable ({err})")
            continue
        if committed.mode != "RGBA" or committed.size != (OUT_SIZE, OUT_SIZE):
            failures.append(
                f"{out_rel}: {committed.mode} {committed.size}, "
                f"expected RGBA ({OUT_SIZE}, {OUT_SIZE})"
            )
            continue
        before = len(failures)
        if committed.tobytes() != fresh.tobytes():
            failures.append(f"{out_rel}: pixels differ from a fresh run (stale)")
        extent = max_radial_extent(committed, OUT_SIZE / 2, OUT_SIZE / 2)
        if extent > TARGET_RADIUS + 1:
            failures.append(
                f"{out_rel}: content extent {extent:.1f}px exceeds safe radius "
                f"{TARGET_RADIUS:.1f}px (+1)"
            )
        if len(failures) == before:
            print(
                f"ok {out_rel}: extent {extent:.1f}px <= {TARGET_RADIUS:.1f}px "
                f"(scale {scale:.4f}, margin {MARGIN})"
            )
    for failure in failures:
        print(f"FAIL {failure}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
