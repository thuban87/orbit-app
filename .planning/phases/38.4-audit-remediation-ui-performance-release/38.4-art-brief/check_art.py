#!/usr/bin/env python3
"""Orbit background-art contrast self-check (38.4 art brief, section H).

Usage:  python3 check_art.py IMAGE --package galaxy|standard --mode dark|light
                              [--density presentation|comfortable|dense] [--margin 0.0]
                              [--exclude-galaxy-dark-danger]
Needs:  pip install pillow numpy

Models exactly what the app renders for text that sits directly on the art
(no card, no scrim): the BackgroundHost veil (the palette `surface` colour at
the density opacity) is blended over every pixel in sRGB space, rounded per
channel like src/theme/tokens/surface.ts alphaComposite(). Each text colour
the app can draw there must reach its WCAG floor against every pixel:
4.5:1 for text and links, 3.0:1 for status glyphs. All eight user-selectable
accent link colours are checked, because the user picks the accent.
The whole canvas is checked (phones crop the sides; foldables crop top/bottom).
Exit 0 = PASS, 1 = FAIL. Also prints the card/chrome proof check (section D).
"""
import argparse, sys
import numpy as np
from PIL import Image

VEIL = {"galaxy": {"presentation": 0.02, "comfortable": 0.10, "dense": 0.22},
        "standard": {"presentation": 0.05, "comfortable": 0.14, "dense": 0.30}}
SURFACE = {("galaxy", "dark"): "#141828", ("galaxy", "light"): "#FBFCFE",
           ("standard", "dark"): "#191C22", ("standard", "light"): "#FFFFFF"}
ACCENT_TEXT = {  # src/theme/accents.ts  (dark tone, light tone)
    "nebula-blue": ("#8FA6FF", "#2A46C7"), "slate-indigo": ("#9AA8E0", "#3C4AA0"),
    "aurora-teal": ("#4FD0C6", "#0B6A64"), "solar-amber": ("#F0C766", "#7A5610"),
    "rose-quartz": ("#EC86A8", "#A8244D"), "violet-haze": ("#B199E8", "#5E37B5"),
    "emerald": ("#63CC7F", "#106A33"), "coral": ("#FF9377", "#AC3925")}
TEXT = {  # src/theme/theme-presets.ts: (token, hex, floor)
    ("galaxy", "dark"): [("textPrimary", "#E6E9F5", 4.5), ("textSecondary", "#8B93B0", 4.5), ("danger", "#E5484D", 4.5),
                         ("statusStable", "#45B98A", 3), ("statusWobble", "#E8C15C", 3), ("statusDecay", "#E56A52", 3), ("rogue", "#E0904A", 3)],
    ("galaxy", "light"): [("textPrimary", "#1A1F33", 4.5), ("textSecondary", "#515A78", 4.5), ("danger", "#B21D22", 4.5),
                          ("statusStable", "#1E7D5A", 3), ("statusWobble", "#8A6A12", 3), ("statusDecay", "#B33A22", 3), ("rogue", "#9A5B14", 3)],
    ("standard", "dark"): [("textPrimary", "#E9ECF1", 4.5), ("textSecondary", "#9AA1AD", 4.5), ("danger", "#FF6B6B", 4.5),
                           ("statusStable", "#4BB08A", 3), ("statusWobble", "#E2C065", 3), ("statusDecay", "#EA7059", 3), ("rogue", "#DA9350", 3)],
    ("standard", "light"): [("textPrimary", "#1B1E26", 4.5), ("textSecondary", "#565D6B", 4.5), ("danger", "#B21D22", 4.5),
                            ("statusStable", "#1E7D5A", 3), ("statusWobble", "#836612", 3), ("statusDecay", "#B33A22", 3), ("rogue", "#96591A", 3)]}
# Card / chrome regimes (scripts/background-extrema-regimes.json) and the text they carry.
CARD = {("galaxy", "dark"): 0.05, ("galaxy", "light"): 0.88, ("standard", "dark"): 0.97, ("standard", "light"): 0.5}
STD_LIGHT_GLASS = [("textPrimary", "#1B1E26", 4.5), ("danger", "#590E11", 4.5), ("statusStable", "#134F39", 3),
                   ("statusWobble", "#57430C", 3), ("statusDecay", "#7E2918", 3), ("rogue", "#663C12", 3)] + [
    (f"accentText:{k}", v, 4.5) for k, v in {"nebula-blue": "#162568", "slate-indigo": "#202856", "aurora-teal": "#05312E",
    "solar-amber": "#392807", "rose-quartz": "#541227", "violet-haze": "#331E61", "emerald": "#083319", "coral": "#501A11"}.items()]

def rgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)
def lum(c):
    s = c / 255.0
    l = np.where(s <= 0.03928, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)
    return 0.2126 * l[..., 0] + 0.7152 * l[..., 1] + 0.0722 * l[..., 2]
def lstar(y): return np.where(y > 216 / 24389, 116 * np.cbrt(y) - 16, y * 24389 / 27)
def blend(tint, px, a): return np.clip(np.floor(rgb(tint) * a + px * (1 - a) + 0.5), 0, 255)

def check(px, tint, alpha, tokens, margin):
    yb = lum(blend(tint, px, alpha))
    bad = np.zeros(yb.shape, bool); rows = []
    for name, hexv, floor in tokens:
        yt = float(lum(rgb(hexv)))
        r = (np.maximum(yt, yb) + 0.05) / (np.minimum(yt, yb) + 0.05)
        fail = r < floor + margin
        bad |= fail
        rows.append((name, hexv, floor, float(r.min()), float(fail.mean() * 100)))
    return rows, bad

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image"); ap.add_argument("--package", required=True, choices=["galaxy", "standard"])
    ap.add_argument("--mode", required=True, choices=["dark", "light"])
    ap.add_argument("--density", default="presentation", choices=["presentation", "comfortable", "dense"])
    ap.add_argument("--margin", type=float, default=0.0, help="extra ratio headroom, e.g. 0.1 while designing")
    ap.add_argument("--exclude-galaxy-dark-danger", action="store_true",
                    help="skip danger text in Galaxy Dark (only if the owner extends exclusion E-1 to bare text)")
    a = ap.parse_args()
    px = np.asarray(Image.open(a.image).convert("RGB")).astype(np.float64)
    key = (a.package, a.mode)
    toks = TEXT[key] + [(f"accentText:{k}", v[0 if a.mode == "dark" else 1], 4.5) for k, v in ACCENT_TEXT.items()]
    if a.exclude_galaxy_dark_danger and key == ("galaxy", "dark"):
        toks = [t for t in toks if t[0] != "danger"]
    ls = lstar(lum(px))
    print(f"{a.image}: {px.shape[1]}x{px.shape[0]}  art L* min {ls.min():.1f} / p1 {np.percentile(ls,1):.1f} / "
          f"median {np.median(ls):.1f} / p99 {np.percentile(ls,99):.1f} / max {ls.max():.1f}")
    rows, bad = check(px, SURFACE[key], VEIL[a.package][a.density], toks, a.margin)
    print(f"\nBARE TEXT on the art ({a.package} {a.mode}, veil {VEIL[a.package][a.density]} @ {a.density}):")
    for n, h, f, worst, pct in rows:
        print(f"  {'ok  ' if pct == 0 else 'FAIL'} {n:26s} {h} floor {f:<3}  worst {worst:5.2f}:1  failing px {pct:6.2f}%")
    h, w = bad.shape
    grid = bad[: h // 16 * 16, : w // 8 * 8].reshape(16, h // 16, 8, w // 8).mean((1, 3)) * 100
    if bad.any():
        print("  failing-pixel % per cell (8 cols x 16 rows, top row first):")
        for r in grid: print("   " + " ".join(f"{v:4.0f}" for v in r))
    card_toks = STD_LIGHT_GLASS if key == ("standard", "light") else [
        t for t in toks if not (key == ("galaxy", "dark") and t[0] == "danger")]  # E-1 owner exclusion
    crow, cbad = check(px, SURFACE[key], CARD[key], card_toks, 0.0)
    print(f"\nCARD/CHROME proof ({CARD[key]} tint): {'ok' if not cbad.any() else 'FAIL'}"
          + ("" if not cbad.any() else "  -> " + ", ".join(n for n, _, _, _, p in crow if p > 0)))
    ok = not bad.any() and not cbad.any()
    print("\nRESULT:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
