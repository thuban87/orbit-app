#!/usr/bin/env python3
"""ORRERY LAB B — R1 legibility: contrast of text over the lab sky, from screenshots.

Two measurements, both WCAG 2.x contrast ratios (sRGB relative luminance):

1. MODEL (ADR-149 style, conservative): the surface tint at its opacity
   composited over the RAW backdrop extreme that lies under the element — the
   brightest raw pixel (dark themes: light text) or the darkest (light themes:
   dark text) — versus the text token. ADR-149 proved the overlay against "the
   brightest raw Orrery star" from the palette; the lab sky (sun core, corona,
   nebula cores, glows) can be brighter, so the bound is recomputed from pixels.
   - labels (in-canvas HUD tags): the raw backdrop comes from a TWIN screenshot
     of the identical static scene with the labels flag off;
   - RN overlays (glass): the raw backdrop under a glass panel is not visible,
     so the bound uses the extreme raw canvas pixel of the whole scene (exactly
     ADR-149's "anywhere under the panel" assumption).
2. MEASURED: the rendered composite inside each text box (glyph pixels
   excluded) — its extreme backdrop pixel versus the text token. This includes
   any blur / scrim halo that the model ignores.

Usage:
  r1-contrast.py labels <with.png> <without.png> <palette.json> <theme> [--canvas y0,y1]
  r1-contrast.py overlay <shot.png> <ui.xml> <raw-extreme.png> <palette.json> <theme> [--canvas y0,y1]
Prints one TSV row per element; the summary row is the worst case.
"""
import json
import sys
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

AA = 4.5


def srgb_lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lum(rgb):
    rgb = np.asarray(rgb, dtype=np.float64)
    l = srgb_lin(rgb)
    return 0.2126 * l[..., 0] + 0.7152 * l[..., 1] + 0.0722 * l[..., 2]


def ratio(a, b):
    la, lb = float(lum(a)), float(lum(b))
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def comp(fg, bg, a):
    return fg * a + bg * (1 - a)


def load(p):
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.float64)


def extremes(px):
    """(brightest, darkest) pixel rows of an N×3 array (by luminance)."""
    L = lum(px)
    return px[int(np.argmax(L))], px[int(np.argmin(L))]


def canvas_extremes(img, y0, y1):
    reg = img[y0:y1].reshape(-1, 3)
    return extremes(reg)


def text_mask(px, fg, tol=60.0):
    """Pixels close to the text colour (glyph cores / antialiasing)."""
    return np.linalg.norm(px - fg, axis=-1) < tol


def dilate(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(mask, dy, axis=0), dx, axis=1)
    return out


def measured(img, box, fg, dark, inset=0):
    """Extreme BACKDROP pixel inside a text box (rendered composite). Glyph
    pixels = luminance on the text side of the midpoint between the text and
    the box median; they are DILATED by 4 px so glyph antialiasing never counts
    as backdrop. `inset` trims decorative edges (plate outline, status hairline,
    corner brackets). The 98th (light text) / 2nd (dark text) percentile of
    the remaining backdrop decides."""
    x0, y0, x1, y1 = box
    x0, y0, x1, y1 = x0 + inset, y0 + inset, x1 - inset, y1 - inset
    if x1 - x0 < 4 or y1 - y0 < 4:
        return None
    reg = img[y0:y1, x0:x1]
    L = lum(reg)
    Lf = float(lum(fg))
    med = float(np.median(L))
    mid = (med + Lf) / 2
    glyph = L > mid if Lf > med else L < mid
    keep = ~dilate(glyph, 4)
    back = reg[keep]
    if len(back) < 20:
        return None
    Lb = lum(back)
    q = np.percentile(Lb, 98 if Lf > med else 2)
    return back[int(np.argmin(np.abs(Lb - q)))]


def measured_rendered(img, box, fg, inset=0):
    """(rendered text colour, median backdrop, p98-extreme backdrop) inside a
    box: the text colour is taken from the glyph pixels themselves (95th
    percentile toward the text side), so dimmed / defocused labels are judged
    by what is actually drawn."""
    x0, y0, x1, y1 = box
    x0, y0, x1, y1 = x0 + inset, y0 + inset, x1 - inset, y1 - inset
    if x1 - x0 < 4 or y1 - y0 < 4:
        return None
    reg = img[y0:y1, x0:x1]
    L = lum(reg)
    Lf = float(lum(fg))
    med = float(np.median(L))
    mid = (med + Lf) / 2
    light = Lf > med
    glyph = L > mid if light else L < mid
    if glyph.sum() < 10:
        return None
    gp = reg[glyph]
    gl = lum(gp)
    tq = np.percentile(gl, 95 if light else 5)
    text = gp[int(np.argmin(np.abs(gl - tq)))]
    back = reg[~dilate(glyph, 4)]
    if len(back) < 20:
        return None
    bl = lum(back)
    bmed = back[int(np.argmin(np.abs(bl - np.median(bl))))]
    bq = np.percentile(bl, 98 if light else 2)
    b98 = back[int(np.argmin(np.abs(bl - bq)))]
    return text, bmed, b98


def label_boxes(w, wo, y0, y1, thresh=14, min_area=600):
    d = np.abs(w - wo).max(axis=-1)
    m = d > thresh
    m[:y0] = False
    m[y1:] = False
    # connected components (4-neighbour) without scipy: flood fill on a coarse grid
    H, W = m.shape
    step = 4
    g = m[: H - H % step, : W - W % step].reshape(H // step, step, W // step, step).any(axis=(1, 3))
    seen = np.zeros_like(g)
    boxes = []
    for gy in range(g.shape[0]):
        for gx in range(g.shape[1]):
            if not g[gy, gx] or seen[gy, gx]:
                continue
            stack = [(gy, gx)]
            seen[gy, gx] = True
            ys, xs = [], []
            while stack:
                cy, cx = stack.pop()
                ys.append(cy)
                xs.append(cx)
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1), (cy + 1, cx + 1), (cy - 1, cx - 1), (cy + 1, cx - 1), (cy - 1, cx + 1)):
                    if 0 <= ny < g.shape[0] and 0 <= nx < g.shape[1] and g[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            bx0, bx1 = min(xs) * step, (max(xs) + 1) * step
            by0, by1 = min(ys) * step, (max(ys) + 1) * step
            if (bx1 - bx0) * (by1 - by0) >= min_area and (bx1 - bx0) > 40 and (by1 - by0) > 24:
                boxes.append((bx0, by0, bx1, by1))
    return boxes


def parse_canvas(args):
    if "--canvas" in args:
        a, b = args[args.index("--canvas") + 1].split(",")
        return int(a), int(b)
    return 330, 2620


def cmd_labels(args):
    w, wo, pal_path, theme = args[:4]
    y0, y1 = parse_canvas(args)
    pal = json.load(open(pal_path))[theme]
    dark = theme.endswith(":dark")
    W, WO = load(w), load(wo)
    fg = hexrgb(pal["textPrimary"])
    plate = hexrgb(pal["labelPlate"])
    a = pal["labelPlateOpacity"]
    rows = []
    for box in label_boxes(W, WO, y0, y1):
        x0, by0, x1, by1 = box
        raw = WO[by0:by1, x0:x1].reshape(-1, 3)
        hi, lo = extremes(raw)
        ext = hi if dark else lo
        model = ratio(fg, comp(plate, ext, a))
        # inset: halo spread + outline + status hairline (≈ 8 dp ≈ 22 px)
        m = measured_rendered(W, box, fg, inset=22)
        if m is None:
            continue
        text, bmed, b98 = m
        rows.append((box, float(lum(ext)), model, ratio(text, bmed), ratio(text, b98)))
    print("theme\telement\tbox\traw_extreme_L\tmodel_ratio\tmeasured_vs_median\tmeasured_vs_p98")
    for box, L, mo, me, m98 in rows:
        print(f"{theme}\tlabel\t{box}\t{L:.3f}\t{mo:.2f}\t{me:.2f}\t{m98:.2f}")
    if rows:
        print(f"{theme}\tLABELS-WORST\t-\t-\t{min(r[2] for r in rows):.2f}\t{min(r[3] for r in rows):.2f}\t{min(r[4] for r in rows):.2f}\tAA(model)={'PASS' if min(r[2] for r in rows) >= AA else 'FAIL'}")
    else:
        print(f"{theme}\tLABELS\tnone found")


def ui_text_boxes(xml_path):
    root = ET.parse(xml_path).getroot()
    out = []
    for n in root.iter("node"):
        t = n.get("text") or ""
        if not t.strip():
            continue
        b = n.get("bounds")
        x0, y0, x1, y1 = [int(v) for v in b.replace("][", ",").strip("[]").split(",")]
        out.append((t, (x0, y0, x1, y1)))
    return out


def cmd_overlay(args):
    shot, xml_path, raw_path, pal_path, theme = args[:5]
    y0, y1 = parse_canvas(args)
    pal = json.load(open(pal_path))[theme]
    dark = theme.endswith(":dark")
    S = load(shot)
    R = load(raw_path)
    hi, lo = canvas_extremes(R, y0, y1)
    ext = hi if dark else lo
    tint = hexrgb(pal["overlayTint"])
    a = pal["overlayOpacity"]
    under = comp(tint, ext, a)
    print("theme\telement\ttoken\tmodel_ratio(tint over raw extreme)\tmeasured_ratio\tbox")
    worst_m, worst_me = 99.0, 99.0
    for token in ("textPrimary", "textSecondary", "accentText"):
        r = ratio(hexrgb(pal[token]), under)
        print(f"{theme}\tglass-model\t{token}\t{r:.2f}\t-\t raw extreme L={float(lum(ext)):.3f} rgb={ext.astype(int).tolist()}")
        worst_m = min(worst_m, r)
    fg = hexrgb(pal["textPrimary"])
    for text, box in ui_text_boxes(xml_path):
        if box[1] < y0 or box[3] > y1 or text in ("LAB B", "+"):
            continue  # lab marker / shell FAB: not Orrery overlay text
        m = measured(S, box, fg, dark)
        if m is None:
            continue
        me = ratio(fg, m)
        worst_me = min(worst_me, me)
        print(f"{theme}\t{text[:24]!r}\ttextPrimary\t-\t{me:.2f}\t{box}")
    print(f"{theme}\tOVERLAY-WORST\t-\t{worst_m:.2f}\t{worst_me:.2f}\tAA(model)={'PASS' if worst_m >= AA else 'FAIL'}")


if __name__ == "__main__":
    {"labels": cmd_labels, "overlay": cmd_overlay}[sys.argv[1]](sys.argv[2:])
