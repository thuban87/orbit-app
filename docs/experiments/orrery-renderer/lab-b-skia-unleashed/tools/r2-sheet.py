#!/usr/bin/env python3
"""ORRERY LAB B — R2 contact sheet: r2-sheet.py <out.jpg> <cols> <img> [img ...]

Tiles screenshots (scaled to 360 px wide) in a grid with the file stem as a
caption. Optional crop: `img.jpg@y0:y1` keeps rows y0..y1 of the full image.
"""
import os
import sys

from PIL import Image, ImageDraw

W = 360


def load(spec):
    path, _, crop = spec.partition("@")
    im = Image.open(path).convert("RGB")
    if crop:
        y0, y1 = (int(v) for v in crop.split(":"))
        im = im.crop((0, y0, im.width, y1))
    h = round(im.height * W / im.width)
    return os.path.splitext(os.path.basename(path))[0], im.resize((W, h))


def main():
    out, cols, *specs = sys.argv[1:]
    cols = int(cols)
    tiles = [load(s) for s in specs]
    th = max(t[1].height for t in tiles) + 22
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (W + 6) + 6, rows * th + 6), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(tiles):
        x = 6 + (i % cols) * (W + 6)
        y = 6 + (i // cols) * th
        sheet.paste(im, (x, y + 20))
        d.text((x + 2, y + 4), name[:58], fill=(230, 230, 230))
    sheet.save(out, quality=85)
    print(out, sheet.size)


if __name__ == "__main__":
    main()
