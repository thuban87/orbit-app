#!/usr/bin/env python3
"""Re-sign-off v3 page builder (38.5-07 Task 2; owner rulings D-04, D-06, D-08..D-13,
D-27, D-28). DEV tooling, not app code.

Builds a self-contained sign-off page from the capture driver's screenshots and
`candidates.json`:

    <out>/site/index.html
    <out>/site/shots/*.jpg      (540 px wide JPEGs, referenced relatively)

The page mirrors the v2 sheet's mechanism: every choice is prefilled with the
owner's v2 (38.4 sign-off) answer, labelled "your 38.4 choice", and saves
automatically through the artifact `db` capability
(`claude.use("db")` -> collection "combos" per combination in the v2 schema,
collection "answers" per extra question). With no db it shows "Saving
unavailable in this view". A secondary "Download answers JSON" / "Copy JSON"
emits the plan's v3 schema (`_meta`, `combos`, `treatmentValues`, `questions`).

Every choice carries a short code printed large (Q-codes, combination codes such
as GL-Aurora, rung codes R1/R2/R3) so the owner can also answer in chat. Each
question shows a labelled "Claude's suggestion"; a suggestion is not a decision.

External resources: only Google Fonts stylesheets (the owner's allow-list also
permits cdnjs scripts; none are used). Everything else is inline or relative.

Run (numpy + pillow are needed for the downscale and the text-colour mock):
    uv run --no-project --with numpy --with pillow \\
        python3 scripts/dev/build-art-signoff-page.py [--out DIR]
"""
from __future__ import annotations

import argparse
import html
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT = Path.home() / "orbit-art/38.5/signoff-v3"
WIDTH = 540
QUALITY = 80

ART_NAMES = {
    "quiet": "Deep Space", "aurora": "Aurora", "starfield": "Starfield",
    "dawn": "Dawn", "paper": "Paper", "dusk": "Dusk", "none": "None (plain colour)",
}
ART_CODES = {
    "quiet": "DeepSpace", "aurora": "Aurora", "starfield": "Starfield",
    "dawn": "Dawn", "paper": "Paper", "dusk": "Dusk", "none": "None",
}
PM_CODES = {"galaxy-light": "GL", "galaxy-dark": "GD", "standard-light": "SL", "standard-dark": "SD"}
PM_NAMES = {"galaxy-light": "Galaxy Light", "galaxy-dark": "Galaxy Dark",
            "standard-light": "Standard Light", "standard-dark": "Standard Dark"}

# The 11 v2 component keys: short chat code, plain name, what it is, and whether
# the sheet offers a choice for it.
COMPONENTS = [
    ("contactsListEntries", "List", "Contact rows (List view)",
     "The rows in the Contacts list view (the default view: one contact per row).", "choice"),
    ("contactsCardEntries", "Card", "Contact cards (Card view)",
     "The tiles in the Contacts card view (the grid of contact cards).", "choice"),
    ("contactsTopButtons", "TopBtns", "Population / Filters / Sort buttons",
     "The three buttons across the top of Contacts that open pop-up menus.", "fixed"),
    ("contactsSearchAndToggle", "Search", "Search icon + List/Card switch",
     "The magnifier and the two small List/Card buttons.", "fixed"),
    ("contactsCountLabel", "Count", '"N contacts" label',
     'The small "7 contacts" line above the list.', "choice"),
    ("contactsHeader", "CHead", "Contacts header bar",
     'The "Orbit" title bar at the top of Contacts, with the ⋯ button.', "choice"),
    ("digestHeader", "DHead", "Digest header bar",
     'The "Digest" title bar at the top of the Digest tab.', "choice"),
    ("digestSectionHeadings", "DHeadings", "Digest section headings",
     'The big "Up Next", "Horizon" and "Your Week" headings.', "nopreview"),
    ("digestUpNextItems", "UpNext", "Up Next items",
     "The rows under Up Next (and the \"all caught up\" text).", "nopreview"),
    ("digestHorizonItems", "Horizon", "Horizon items",
     "The rows under Horizon, its sub-headings and the \"more\" link.", "nopreview"),
    ("digestYourWeek", "Week", "Your Week",
     "The Your Week block: period switch, totals tiles and heatmap.", "nopreview"),
]
FIXED_REASON = ("Always solid, not asked: buttons that open pop-up menus keep their backing "
                "(your rulings D-04 and D-12). Shown for completeness.")
NOPREVIEW_REASON = ("No preview: the app has no switch to render this part differently yet. "
                    "You can still change it; a change means new work in the next plan (38.5-08).")

GROUP_INFO = {
    "listEntry": ("contact rows (List view)", ["contactsListEntries"]),
    "cardEntry": ("contact cards (Card view)", ["contactsCardEntries"]),
    "artChrome": ('"N contacts" label and the Contacts / Digest header bars',
                  ["contactsCountLabel", "contactsHeader", "digestHeader"]),
}
LADDER_CODES = {
    ("galaxy-light", "listEntry"): "Q2a", ("galaxy-light", "cardEntry"): "Q2b",
    ("galaxy-dark", "listEntry"): "Q2c", ("standard-light", "listEntry"): "Q2d",
    ("standard-dark", "listEntry"): "Q2e", ("standard-dark", "cardEntry"): "Q2f",
    ("standard-dark", "artChrome"): "Q2g",
}
# Claude's suggestions (a suggestion is not a decision; the owner's choice governs).
# Rung suggestions name the value, so they survive rung renumbering.
SUGGEST = {
    "Q2a": (0.05, "Matches your 38.4 words for these rows: \"truly see-through, like Galaxy Dark's card transparency\" (Galaxy Dark cards are 5% today)."),
    "Q2b": (0.05, "Same reason as Q2a: \"like Galaxy Dark's card transparency\" is 5%."),
    "Q2c": (0.05, "Matches the Galaxy Dark cards next to them (5% today), so rows and cards look alike."),
    "Q2d": (0.50, "Matches the Standard Light cards next to them (50% today), so rows and cards look alike."),
    "Q2e": (0.05, "Matches your 38.4 words: \"truly see-through\", like Galaxy Dark's cards (5%)."),
    "Q2f": (0.05, "Same reason as Q2e."),
    "Q2g": (0.50, "You asked for a \"slightly-black\" backing here; 0% would be no backing at all, so the 50% level is the one that is still slightly black."),
    "Q3a": ("keep", "Your D-28 rule is to change nothing you did not mark; keeping today's level is the no-change option."),
    "Q3b": ("keep", "Same reason as Q3a."),
    "Q4": ("keep", "Your D-04 ruling says buttons that open pop-up menus keep a backing; a small backing on the ⋯ keeps that rule while the header itself has none."),
    "Q5": ("ok", "On the new art the Digest text reads cleanly in all three WATCH cases on these captures; nothing needs changing unless you see otherwise."),
    "Q6a": ("mode", "The new Galaxy Light art is pale, so the normal dark text already reads on it; flipping to light text would make it harder to read."),
    "Q6b": ("mode", "The new Standard Dark art is dark, so the normal light text already reads on it; flipping to dark text would make it harder to read."),
}

FLIP_ROLES = ["textPrimary", "textSecondary", "textPlaceholder", "danger", "statusStable",
              "statusWobble", "statusDecay", "rogue", "accentText"]


# ---------------------------------------------------------------------------
# images
# ---------------------------------------------------------------------------

def to_jpg(src: Path, dst: Path, width: int = WIDTH) -> str:
    if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
        im = Image.open(src).convert("RGB")
        h = round(im.height * width / im.width)
        im.resize((width, h), Image.LANCZOS).save(dst, "JPEG", quality=QUALITY, optimize=True)
    return f"shots/{dst.name}"


def hex_rgb(h: str) -> np.ndarray:
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)


def flip_mock(src: Path, dst: Path, pal_from: dict, pal_to: dict, top: float = 0.30,
              bottom: float = 0.92) -> str:
    """A MOCK of the flipped text colour on a crop of a real capture: pixels drawn
    in one of the swapped roles are recoloured to the opposite mode's token,
    keeping their anti-aliasing (alpha estimated against a coarse local median
    background). Only pixels over a background of the mode's own tone are
    touched, and busy regions are skipped, so photos and avatar discs keep their
    colours. A page-builder illustration, not a render."""
    im = Image.open(src).convert("RGB")
    w, h = im.size
    im = im.crop((0, int(h * top), w, int(h * bottom)))
    small = im.resize((im.width // 4, im.height // 4), Image.BILINEAR).filter(ImageFilter.MedianFilter(15))
    med = small.resize(im.size, Image.BILINEAR)
    bg = np.asarray(med, dtype=np.float32)
    grad = np.abs(bg - np.asarray(med.filter(ImageFilter.BoxBlur(10)), dtype=np.float32)).sum(-1)
    lin = np.where(bg / 255 <= 0.03928, bg / 255 / 12.92, ((bg / 255 + 0.055) / 1.055) ** 2.4)
    lum = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    light_mode = sum(hex_rgb(pal_from["background"])) > 3 * 128
    tone_ok = (lum > 0.45) if light_mode else (lum < 0.1)
    allowed = tone_ok & (grad < 25)
    px = np.asarray(im, dtype=np.float32)
    out = px.copy()
    best_a = np.zeros(px.shape[:2], dtype=np.float32)
    for role in dict.fromkeys(FLIP_ROLES):
        c = hex_rgb(pal_from[role])
        t = hex_rgb(pal_to[role])
        d = c - bg
        denom = np.maximum((d * d).sum(-1), 1.0)
        a = np.clip(((px - bg) * d).sum(-1) / denom, 0, 1)
        resid = np.linalg.norm(px - (bg + a[..., None] * d), axis=-1)
        mask = (a > 0.12) & (resid < 40) & (np.sqrt(denom) > 40) & (a > best_a) & allowed
        best_a = np.where(mask, a, best_a)
        out = np.where(mask[..., None], bg + a[..., None] * (t - bg), out)
    res = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    res.resize((WIDTH, round(res.height * WIDTH / w)), Image.LANCZOS).save(dst, "JPEG", quality=QUALITY)
    return f"shots/{dst.name}"


def palettes() -> dict:
    ts = """
import { applyAccent, resolveAccent } from "%(r)s/src/theme/accents";
import { resolvePalette } from "%(r)s/src/theme/theme-presets";
const out: Record<string, unknown> = {};
for (const p of ["galaxy", "standard"] as const) for (const m of ["light", "dark"] as const)
  out[`${p}-${m}`] = applyAccent(resolvePalette(p, m), resolveAccent(null, p, m));
console.log(JSON.stringify(out));
""" % {"r": REPO}
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "pal.ts"
        f.write_text(ts)
        r = subprocess.run(["npx", "tsx", str(f)], cwd=REPO, capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def rung_values(l: dict) -> list[dict]:
    seen: dict[float, list[str]] = {}
    for name in ("minSafe", "precedent", "midpoint"):
        v = l[name]["value"]
        if v is not None:
            seen.setdefault(v, []).append(name)
    return [{"code": f"R{i + 1}", "value": v, "sources": seen[v]}
            for i, v in enumerate(sorted(seen))]


# ---------------------------------------------------------------------------
# data
# ---------------------------------------------------------------------------

def combo_code(key: str) -> str:
    pkg, mode, bg = key.split("-", 2)
    return f"{PM_CODES[f'{pkg}-{mode}']}-{ART_CODES[bg]}"


def combo_label(key: str) -> str:
    pkg, mode, bg = key.split("-", 2)
    return f"{PM_NAMES[f'{pkg}-{mode}']} · {ART_NAMES[bg]}"


def build(out: Path) -> dict:
    site = out / "site"
    shots = site / "shots"
    shots.mkdir(parents=True, exist_ok=True)
    cands = json.loads((out / "candidates.json").read_text())
    order = ["galaxy-light", "galaxy-dark", "standard-light", "standard-dark"]
    bgs = ["quiet", "aurora", "starfield", "dawn", "paper", "dusk", "none"]
    mapped = dict(sorted(cands["mappedV2"].items(), key=lambda kv: (
        order.index(f"{kv[1]['theme']}-{kv[1]['mode']}"), bgs.index(kv[1]["bg"]))))
    v2raw = json.loads((REPO / ".planning/phases/38.5-background-art-text-contrast/38.5-scrim-signoff-v2.json").read_text())["combos"]
    missing: list[str] = []

    def img(name: str) -> str | None:
        src = out / f"{name}.png"
        if not src.exists():
            missing.append(name)
            return None
        return to_jpg(src, shots / f"{name}.jpg")

    def corner(name: str) -> str | None:
        """A zoomed crop of the header's top-right corner (the ⋯ button), for Q4."""
        src = out / f"{name}.png"
        if not src.exists():
            return None
        dst = shots / f"{name}__corner-zoom.jpg"
        im = Image.open(src).convert("RGB")
        w, _ = im.size
        im.crop((int(w * 0.55), 60, w, 250)).save(dst, "JPEG", quality=85)
        return f"shots/{dst.name}"

    base_vals = {f"{l['pkgMode']}:{l['group']}": l["baseValue"] for l in cands["ladders"]}

    combos = []
    for key, row in mapped.items():
        pkg, mode, bg = key.split("-", 2)
        pm = f"{pkg}-{mode}"
        watch = pm in ("galaxy-light", "standard-dark") or bg == "dusk"
        levels = []
        for g in ("listEntry", "cardEntry", "artChrome"):
            if any(row["cells"][c] == "transparent" for c in GROUP_INFO[g][1]):
                levels.append(f"{GROUP_INFO[g][0]} at {round(base_vals[f'{pm}:{g}'] * 100)}%")
        combos.append({
            "key": key, "code": combo_code(key), "label": combo_label(key), "theme": pkg,
            "mode": mode, "bg": bg, "art": ART_NAMES[bg], "v2": row["cells"],
            "note": row["note"], "source": row["source"], "watch": watch,
            "levels": levels,
            "shots": {v: img(f"{key}__{v}__v2") for v in ("list", "card", "digest")},
            "active": img(f"{key}__list__active-top-buttons"),
            "overflowLocal": img(f"{key}__list__overflow-local-backing")
            if row["cells"]["contactsHeader"] == "none" else None,
            "overflowZoom": [corner(f"{key}__list__v2"), corner(f"{key}__list__overflow-local-backing")]
            if row["cells"]["contactsHeader"] == "none" else None,
        })

    ladders = []
    for l in cands["ladders"]:
        code = LADDER_CODES.get((l["pkgMode"], l["group"]))
        if code is None:
            continue
        rungs = rung_values(l)
        views = {"listEntry": ["list"], "cardEntry": ["card"], "artChrome": ["list", "digest"]}[l["group"]]
        pkg, mode = l["pkgMode"].split("-")
        rows = []
        for bg in l["transparentOn"]:
            if bg == "none":
                continue
            key = f"{pkg}-{mode}-{bg}"
            rows.append({"bg": bg, "art": ART_NAMES[bg], "code": combo_code(key), "cells": [
                {"rung": r["code"], "value": r["value"],
                 "imgs": [img(f"{key}__{v}__{l['group']}-{r['code']}-{r['value']:.2f}") for v in views]}
                for r in rungs]})
        plain_prec = {
            ("galaxy-light", "listEntry"): "the level your 38.4 note names, \"like Galaxy Dark's card transparency\" (Galaxy Dark cards are 5% today)",
            ("galaxy-light", "cardEntry"): "the level your 38.4 note names, \"like Galaxy Dark's card transparency\" (Galaxy Dark cards are 5% today)",
            ("standard-dark", "listEntry"): "the level your 38.4 note names, \"truly see-through\" like Galaxy Dark's cards (5% today)",
            ("standard-dark", "cardEntry"): "the level your 38.4 note names, \"truly see-through\" like Galaxy Dark's cards (5% today)",
            ("galaxy-dark", "listEntry"): "the level of the Galaxy Dark contact cards next to them (5% today)",
            ("standard-light", "listEntry"): "the level of the Standard Light contact cards next to them (50% today)",
        }.get((l["pkgMode"], l["group"]))
        meaning = {
            "minSafe": "the most see-through level at which every text colour still passes the contrast check on this art (computed)",
            "precedent": plain_prec or "",
            "midpoint": f"halfway between that lowest safe level and solid ({round(l['full']['value'] * 100)}%), rounded",
        }
        for r in rungs:
            r["meaning"] = "; also ".join(meaning[src] for src in r["sources"] if meaning[src])
        sv, sw = SUGGEST[code]
        ladders.append({
            "code": code, "pkgMode": l["pkgMode"], "group": l["group"],
            "pmName": PM_NAMES[l["pkgMode"]], "what": GROUP_INFO[l["group"]][0],
            "components": GROUP_INFO[l["group"]][1],
            "rungs": rungs, "minSafe": l["minSafe"]["value"], "full": l["full"]["value"],
            "precedentSource": l["precedent"]["source"], "base": l["baseValue"],
            "rows": rows, "views": views,
            "suggest": {"value": sv, "why": sw},
        })

    # Signed-today groups (not asked; value carried or changed by card-blend).
    signed = [{"pkgMode": l["pkgMode"], "group": l["group"], "value": l["signedToday"],
               "cardBlend": (l.get("cardBlend") or {}).get("value")}
              for l in cands["ladders"] if not l["needsOwnerValue"]]

    blend = []
    for code, pm in (("Q3a", "galaxy-dark"), ("Q3b", "standard-light")):
        l = next(x for x in cands["ladders"] if x["pkgMode"] == pm and x["group"] == "cardEntry")
        cb = l["cardBlend"]["value"]
        pkg, mode = pm.split("-")
        rows = []
        for bg in l["transparentOn"]:
            if bg == "none":
                continue
            key = f"{pkg}-{mode}-{bg}"
            rows.append({"art": ART_NAMES[bg], "code": combo_code(key),
                         "today": img(f"{key}__card__v2"),
                         "more": img(f"{key}__card__cardblend-{cb:.2f}")})
        sv, sw = SUGGEST[code]
        blend.append({"code": code, "pkgMode": pm, "pmName": PM_NAMES[pm], "today": l["signedToday"],
                      "more": cb, "rows": rows, "suggest": {"value": sv, "why": sw}})

    pals = palettes()
    flips = []
    for code, pm, opp in (("Q6a", "galaxy-light", "galaxy-dark"), ("Q6b", "standard-dark", "standard-light")):
        pkg, mode = pm.split("-")
        rows = []
        for bg in [b for b in ("quiet", "aurora", "starfield", "dawn", "paper", "dusk")
                   if f"{pkg}-{mode}-{b}" in mapped]:
            key = f"{pkg}-{mode}-{bg}"
            if mapped[key]["cells"]["contactsListEntries"] != "transparent":
                continue
            r = {"art": ART_NAMES[bg], "code": combo_code(key)}
            for v in ("list", "card"):
                src = out / f"{key}__{v}__v2.png"
                if src.exists():
                    im = Image.open(src).convert("RGB")
                    w, h = im.size
                    crop = im.crop((0, int(h * 0.30), w, int(h * 0.92)))
                    dst = shots / f"{key}__{v}__textcolour-real.jpg"
                    crop.resize((WIDTH, round(crop.height * WIDTH / w)), Image.LANCZOS).save(dst, "JPEG", quality=QUALITY)
                    r[f"{v}Real"] = f"shots/{dst.name}"
                    r[f"{v}Mock"] = flip_mock(src, shots / f"{key}__{v}__textcolour-MOCK-flipped.jpg", pals[pm], pals[opp])
                else:
                    missing.append(f"{key}__{v}__v2")
            rows.append(r)
        swatches = [{"role": role, "mode": pals[pm][role], "flipped": pals[opp][role]} for role in FLIP_ROLES]
        sv, sw = SUGGEST[code]
        flips.append({"code": code, "pkgMode": pm, "pmName": PM_NAMES[pm], "oppName": PM_NAMES[opp],
                      "rows": rows, "swatches": swatches, "suggest": {"value": sv, "why": sw}})

    gallery = []
    for key, row in mapped.items():
        if row["bg"] == "none":
            continue
        gallery.append({"code": combo_code(key), "label": combo_label(key), "imgs": [
            {"route": name, "img": img(f"{key}__{slug}__gallery")}
            for slug, name in (("things-to-remember", "Things to Remember"),
                               ("edit-interaction", "Edit interaction"),
                               ("ai-permissions", "AI permissions"))]})

    return {
        "combos": combos,
        "components": [{"key": k, "code": c, "name": n, "plain": p, "kind": kind} for k, c, n, p, kind in COMPONENTS],
        "ladders": ladders, "signed": signed, "blend": blend, "flips": flips, "gallery": gallery,
        "suggest": {k: {"value": v, "why": w} for k, (v, w) in SUGGEST.items()},
        "v2updated": {k: v.get("updatedAt") for k, v in v2raw.items()},
        "missing": missing,
    }


# ---------------------------------------------------------------------------
# page
# ---------------------------------------------------------------------------

CSS = r"""
:root{--bg:#f6f5f1;--panel:#ffffff;--ink:#1d1f24;--muted:#5d6270;--line:#dcdad3;--accent:#2f4fb5;
--accent-ink:#ffffff;--sugg:#fff4d6;--sugg-line:#e0b94a;--ok:#1e7d5a;--warn:#9a5b14;--chip:#eef0f7;
--watch:#b3261e;--mock:#6b3fa0;--sel:#e3e9ff}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#15171c;--panel:#1e2129;--ink:#e8eaf0;--muted:#a3a9b8;
--line:#343845;--accent:#8fa6ff;--accent-ink:#0b0e1a;--sugg:#3a3220;--sugg-line:#a88734;--ok:#57c79a;
--warn:#e0a060;--chip:#2a2f3c;--watch:#ff8a80;--mock:#c9a2ff;--sel:#2c3656}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#15171c;--panel:#1e2129;--ink:#e8eaf0;--muted:#a3a9b8;
--line:#343845;--accent:#8fa6ff;--accent-ink:#0b0e1a;--sugg:#3a3220;--sugg-line:#a88734;--ok:#57c79a;
--warn:#e0a060;--chip:#2a2f3c;--watch:#ff8a80;--mock:#c9a2ff;--sel:#2c3656}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 Inter,system-ui,sans-serif}
main{max-width:1180px;margin:0 auto;padding:20px 16px 80px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:21px;margin:36px 0 8px;border-top:2px solid var(--line);padding-top:18px}
h3{font-size:17px;margin:18px 0 6px}
.muted{color:var(--muted)}.small{font-size:13px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:12px 0}
.code{display:inline-block;font:700 18px/1.2 ui-monospace,Menlo,monospace;background:var(--chip);border:1px solid var(--line);
border-radius:6px;padding:2px 8px;margin-right:6px;letter-spacing:.3px}
.code.big{font-size:22px}
.status{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--panel);border-bottom:1px solid var(--line);padding:8px 16px;font-size:14px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.status b{font-weight:600}
button{font:inherit;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:7px;padding:6px 12px;cursor:pointer}
button.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.sugg{background:var(--sugg);border:1px solid var(--sugg-line);border-radius:8px;padding:8px 10px;margin:8px 0;font-size:14px}
.sugg b{font-weight:700}
.opts{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.opt{border:1px solid var(--line);border-radius:7px;padding:5px 10px;cursor:pointer;background:var(--panel);font-size:14px}
.opt.on{background:var(--sel);border-color:var(--accent);outline:2px solid var(--accent)}
.opt .tag{font-size:11px;color:var(--muted);display:block}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin:8px 0}
figure{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}
figure img{width:100%;display:block}
figcaption{font-size:12.5px;padding:6px 8px;line-height:1.35}
.badge{display:inline-block;font:700 11px/1 system-ui;padding:3px 6px;border-radius:4px;color:#fff;background:var(--watch);margin-right:4px}
.badge.mock{background:var(--mock)}
table.cells{border-collapse:collapse;width:100%;font-size:14px}
table.cells td,table.cells th{border-top:1px solid var(--line);padding:6px 6px;vertical-align:top;text-align:left}
table.cells .fixed{color:var(--muted)}
.cellname b{display:block}
.changed{color:var(--warn);font-weight:600}
textarea{width:100%;min-height:54px;font:inherit;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);padding:6px}
.summary td,.summary th{padding:4px 8px;border-top:1px solid var(--line);text-align:left;vertical-align:top;font-size:14px}
.summary{border-collapse:collapse;width:100%}
.swatch{display:inline-block;width:18px;height:18px;border-radius:4px;border:1px solid var(--line);vertical-align:middle;margin-right:4px}
.row2{display:grid;grid-template-columns:repeat(2,minmax(0,300px));gap:10px;margin:8px 0}
nav a{margin-right:12px;color:var(--accent)}
details summary{cursor:pointer;color:var(--accent)}
.reviewed{font-weight:600;color:var(--ok)}
dl.gloss dt{font-weight:700;margin-top:6px}dl.gloss dd{margin:0 0 4px 0}
"""

JS = r"""
const D = JSON.parse(document.getElementById('data').textContent);
const VAL = {full:'F', transparent:'T', none:'N'};
const WORD = {full:'full (solid)', transparent:'see-through', none:'none'};
const state = {combos:{}, answers:{}};
let db = null, saving = 'pending';

function now(){ return new Date().toISOString(); }
function comboBody(c){
  const s = state.combos[c.key]; const body = {theme:c.theme, mode:c.mode, bg:c.bg};
  for (const k of D.components) body[k.key] = s.cells[k.key];
  if (Object.keys(s.foreground).length) body.foreground = {...s.foreground};
  body.note = s.note; body.reviewed = s.reviewed; body.updatedAt = s.updatedAt; return body;
}
for (const c of D.combos){
  state.combos[c.key] = {cells:{...c.v2}, foreground:{}, note:'', reviewed:false, updatedAt:null};
}

async function saveCombo(key){
  const c = D.combos.find(x=>x.key===key); state.combos[key].updatedAt = now();
  render(); if (!db) return;
  try { await db.collection('combos').doc(key).set(comboBody(c)); setStatus('Saved'); }
  catch(e){ setStatus('Save failed ('+(e&&e.code||'error')+') — use Download JSON'); }
}
async function saveAnswer(code){
  const a = state.answers[code]; a.updatedAt = now(); render(); if (!db) return;
  try { await db.collection('answers').doc(code).set({...a}); setStatus('Saved'); }
  catch(e){ setStatus('Save failed ('+(e&&e.code||'error')+') — use Download JSON'); }
}
function setStatus(t){ document.getElementById('savestate').textContent = t; }

function setCell(key, comp, v){ state.combos[key].cells[comp] = v; saveCombo(key); }
function setFg(key, comp, on){ const f = state.combos[key].foreground; if (on) f[comp]='inverse'; else delete f[comp]; saveCombo(key); }
function setReviewed(key, on){ state.combos[key].reviewed = on; saveCombo(key); }
let noteTimers = {};
function setNote(key, t){ state.combos[key].note = t; clearTimeout(noteTimers[key]); noteTimers[key] = setTimeout(()=>saveCombo(key), 900); }
function setAnswer(code, value, extra){ state.answers[code] = {value, ...(extra||{})}; saveAnswer(code); }
let typedTimers = {};
function setTyped(code, t){
  const n = Number(t); clearTimeout(typedTimers[code]);
  if (t === '' || !(n>=0 && n<=100)) return;
  typedTimers[code] = setTimeout(()=>setAnswer(code, Math.round(n)/100, {typed:true}), 900);
}

let armed = false;
async function acceptAll(){
  const b = document.getElementById('acceptall');
  if (!armed){ armed = true; b.textContent = 'Click again to confirm: this replaces every answer with the suggestion'; setTimeout(()=>{armed=false; b.textContent='Accept all of Claude\'s suggestions'},6000); return; }
  armed = false; b.textContent = 'Accept all of Claude\'s suggestions';
  for (const c of D.combos){ state.combos[c.key] = {cells:{...c.v2}, foreground:{}, note: state.combos[c.key].note, reviewed:true, updatedAt:now()}; }
  for (const [code, s] of Object.entries(D.suggest)) state.answers[code] = {value:s.value, acceptedSuggestion:true, updatedAt:now()};
  render();
  if (db){
    setStatus('Saving…');
    try {
      for (const c of D.combos) await db.collection('combos').doc(c.key).set(comboBody(c));
      for (const code of Object.keys(D.suggest)) await db.collection('answers').doc(code).set({...state.answers[code]});
      setStatus('Saved');
    } catch(e){ setStatus('Save failed ('+(e&&e.code||'error')+') — use Download JSON'); }
  }
}

// ---- v3 export (the plan's schema) ----
function exportV3(){
  const combos = {};
  for (const c of D.combos){
    const s = state.combos[c.key]; const body = comboBody(c);
    body.foreground = {...s.foreground};
    combos[c.key] = body;
  }
  // Text-colour flip (Q6): mark the see-through GL / SD contact entries inverse.
  for (const f of D.flips){
    const a = state.answers[f.code];
    if (a && a.value === 'flip'){
      for (const c of D.combos){
        if (`${c.theme}-${c.mode}` !== f.pkgMode) continue;
        for (const comp of ['contactsListEntries','contactsCardEntries'])
          if (combos[c.key][comp] === 'transparent') combos[c.key].foreground[comp] = 'inverse';
      }
    }
  }
  for (const k of Object.keys(combos)) if (!Object.keys(combos[k].foreground).length) delete combos[k].foreground;
  const tv = {}; const missingValues = [];
  const groupOf = {listEntry:['contactsListEntries'], cardEntry:['contactsCardEntries'], artChrome:['contactsCountLabel','contactsHeader','digestHeader']};
  for (const pm of ['galaxy-light','galaxy-dark','standard-light','standard-dark']){
    for (const g of Object.keys(groupOf)){
      const used = D.combos.some(c => `${c.theme}-${c.mode}`===pm && groupOf[g].some(k => combos[c.key][k]==='transparent'));
      if (!used) continue;
      const lad = D.ladders.find(l => l.pkgMode===pm && l.group===g);
      const sig = D.signed.find(s => s.pkgMode===pm && s.group===g);
      let v;
      if (lad){ const a = state.answers[lad.code]; v = a ? a.value : undefined; }
      else if (sig){
        v = sig.value;
        const bl = D.blend.find(b => b.pkgMode===pm);
        if (g==='cardEntry' && bl){ const a = state.answers[bl.code]; if (!a) v = undefined; else if (a.value==='more') v = bl.more; }
      }
      if (v === undefined){ missingValues.push(`${pm} ${g}`); continue; }
      (tv[pm] = tv[pm] || {})[g] = v;
    }
  }
  const ans = code => state.answers[code] ? state.answers[code].value : null;
  const questions = {
    contactsHeaderOverflowBacking: ans('Q4') === null ? null : (ans('Q4') === 'keep' ? 'localBacking' : 'followHeader'),
    cardBlend: Object.fromEntries(D.blend.map(b => [b.pkgMode, ans(b.code)===null ? null : (ans(b.code)==='more' ? 'moreSeeThrough' : 'keepToday')])),
    seeThroughEntryForeground: Object.fromEntries(D.flips.map(f => [f.pkgMode, ans(f.code)])),
    digestWatch: {answer: ans('Q5'), note: state.answers.Q5 && state.answers.Q5.note || ''},
    seeThroughLevels: Object.fromEntries(D.ladders.map(l => [l.code, {pkgMode:l.pkgMode, group:l.group, value: ans(l.code), typed: !!(state.answers[l.code]&&state.answers[l.code].typed)}])),
    acceptedSuggestions: Object.keys(D.suggest).filter(k => state.answers[k] && state.answers[k].acceptedSuggestion),
  };
  return {
    _meta: {what:'Owner scrim re-sign-off v3 answers over the new art (38.5-07, D-13 step 3), exported from the sign-off page.',
      captured:'Contacts List, Contacts Card and Digest at rest, Pixel 3a, font scale 1.15, real debug build through the DEV override, new art (38.5-05).',
      values:'full = solid backing; transparent = see-through backing (level in treatmentValues); none = no backing',
      prefill:"Every cell started at the owner's v2 (38.4 sign-off) answer, with corrections (a)/(b), Mesh dropped and the Galaxy art rows carried to Deep Space/Aurora/Starfield.",
      exported: now(), unanswered: missingValues},
    combos, treatmentValues: tv, questions,
  };
}
function download(){
  const blob = new Blob([JSON.stringify(exportV3(), null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '38.5-scrim-signoff-v3.json'; a.click();
}
async function copyJson(){
  const t = JSON.stringify(exportV3(), null, 2);
  try { await navigator.clipboard.writeText(t); setStatus('JSON copied'); }
  catch(e){ const ta = document.getElementById('jsonout'); ta.value = t; ta.style.display='block'; ta.select(); setStatus('Select-all and copy the box below'); }
}

// ---- rendering ----
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function fig(src, cap, badges){
  if (!src) return `<figure><div class="small muted" style="padding:20px">missing shot</div><figcaption>${cap}</figcaption></figure>`;
  return `<figure><a href="${src}" target="_blank"><img loading="lazy" src="${src}" alt="${esc(cap)}"></a><figcaption>${badges||''}${cap}</figcaption></figure>`;
}
function opt(on, label, tag, onclick){
  return `<span class="opt${on?' on':''}" onclick="${onclick}">${label}${tag?`<span class="tag">${tag}</span>`:''}</span>`;
}
function suggBox(code){
  const s = D.suggest[code]; let v = s.value;
  if (typeof v === 'number') v = `${Math.round(v*100)}%`;
  return `<div class="sugg"><b>Claude's suggestion (${code}): ${esc(v)}</b> — ${esc(s.why)} <span class="muted">A suggestion, not a decision: your choice governs.</span></div>`;
}
function answered(code){ return state.answers[code] ? state.answers[code].value : null; }
function pct(v){ return v==null ? '—' : `${Math.round(v*100)}%`; }

function renderSummary(){
  const rows = [];
  const rev = D.combos.filter(c=>state.combos[c.key].reviewed).length;
  rows.push(`<tr><td><span class="code">Q1</span></td><td>Each of the 16 combinations: keep or change which parts have a solid, see-through or no backing. Tick "Reviewed" on each.</td><td>Keep your 38.4 choices</td><td>${rev}/16 reviewed</td></tr>`);
  for (const l of D.ladders) rows.push(`<tr><td><span class="code">${l.code}</span></td><td>How see-through: ${esc(l.pmName)} ${esc(l.what)}</td><td>${pct(D.suggest[l.code].value)}</td><td>${answered(l.code)==null?'<i>not answered</i>':pct(answered(l.code))}</td></tr>`);
  for (const b of D.blend) rows.push(`<tr><td><span class="code">${b.code}</span></td><td>${esc(b.pmName)} contact cards: keep today's ${pct(b.today)} or go more see-through (${pct(b.more)})</td><td>${esc(D.suggest[b.code].value)}</td><td>${answered(b.code)||'<i>not answered</i>'}</td></tr>`);
  rows.push(`<tr><td><span class="code">Q4</span></td><td>The ⋯ button where the Contacts header has no backing: keep a small backing, or follow the header</td><td>keep</td><td>${answered('Q4')||'<i>not answered</i>'}</td></tr>`);
  rows.push(`<tr><td><span class="code">Q5</span></td><td>WATCH check of the Digest on Galaxy Light, Standard Dark and Dusk: fine, or needs a change</td><td>ok</td><td>${answered('Q5')||'<i>not answered</i>'}</td></tr>`);
  for (const f of D.flips) rows.push(`<tr><td><span class="code">${f.code}</span></td><td>${esc(f.pmName)} see-through contact rows/cards: normal text colour ("mode") or flipped ("flip")</td><td>${esc(D.suggest[f.code].value)}</td><td>${answered(f.code)||'<i>not answered</i>'}</td></tr>`);
  document.getElementById('summary').innerHTML = `<table class="summary"><tr><th>Code</th><th>Question</th><th>Claude's suggestion</th><th>Your answer</th></tr>${rows.join('')}</table>`;
}

function renderCombos(){
  const out = [];
  for (const c of D.combos){
    const s = state.combos[c.key];
    const badge = c.watch ? '<span class="badge">WATCH (D-11)</span>' : '';
    const figs = fig(c.shots.list, `<b>${c.code}</b> · ${esc(c.label)} · Contacts, List view · your 38.4 choices`) +
      fig(c.shots.card, `<b>${c.code}</b> · ${esc(c.label)} · Contacts, Card view · your 38.4 choices`) +
      fig(c.shots.digest, `<b>${c.code}</b> · ${esc(c.label)} · Digest · your 38.4 choices`, badge);
    const rows = D.components.map(k => {
      const v = s.cells[k.key], orig = c.v2[k.key];
      let ctl;
      if (k.kind === 'fixed') ctl = `<span class="fixed">full (solid) — ${esc(FIXED)}</span>`;
      else ctl = '<div class="opts">' + ['full','transparent','none'].map(x => opt(v===x, `${VAL[x]} · ${WORD[x]}`, x===orig?'your 38.4 choice':'', `setCell('${c.key}','${k.key}','${x}')`)).join('') + '</div>' +
        (k.kind==='nopreview' ? `<div class="small muted">${esc(NOPREVIEW)}</div>` : '') +
        (v!=='full' && k.kind!=='fixed' ? `<label class="small"><input type="checkbox" ${s.foreground[k.key]?'checked':''} onchange="setFg('${c.key}','${k.key}',this.checked)"> flip this part's text colour (default: the normal colour for this mode, which suits the new art)</label>` : '');
      const changed = v !== orig ? ` <span class="changed">changed from ${VAL[orig]}</span>` : '';
      return `<tr><td class="cellname" style="width:32%"><span class="code">${k.code}</span><b>${esc(k.name)}</b><span class="small muted">${esc(k.plain)}</span></td><td>${ctl}${changed}</td></tr>`;
    }).join('');
    out.push(`<div class="panel" id="c-${c.key}"><h3><span class="code big">${c.code}</span>${esc(c.label)} ${badge}</h3>
      <div class="small muted">Prefilled from ${esc(c.source)}. See-through levels in these shots: ${c.levels.length?esc(c.levels.join('; ')):'none (no see-through parts)'}.</div>
      <div class="shots">${figs}</div>
      <table class="cells">${rows}</table>
      <div style="margin-top:8px"><label>Note (optional)<textarea oninput="setNote('${c.key}',this.value)">${esc(s.note)}</textarea></label></div>
      <label class="${s.reviewed?'reviewed':''}"><input type="checkbox" ${s.reviewed?'checked':''} onchange="setReviewed('${c.key}',this.checked)"> Reviewed ${c.code}</label></div>`);
  }
  document.getElementById('combos').innerHTML = out.join('');
}

function renderLadders(){
  const out = [];
  for (const l of D.ladders){
    const a = answered(l.code);
    const opts = l.rungs.map(r => opt(a===r.value, `<b>${r.code}</b> · ${pct(r.value)}`, r.value===l.base?'used in the Q1 shots':'', `setAnswer('${l.code}',${r.value},{rung:'${r.code}'})`)).join('');
    const typed = state.answers[l.code] && state.answers[l.code].typed ? Math.round(state.answers[l.code].value*100) : '';
    const rows = l.rows.map(row => `<h3 class="small">${esc(row.art)} art (${row.code})</h3><div class="shots">` +
      row.cells.map(cell => cell.imgs.map((im,i) => fig(im, `<b>${l.code} ${cell.rung}</b> · ${pct(cell.value)} · ${esc(l.pmName)} · ${esc(row.art)} · ${l.views[i]==='digest'?'Digest':'Contacts '+(l.views[i]==='list'?'List':'Card')+' view'}`)).join('')).join('') + '</div>').join('');
    out.push(`<div class="panel" id="q-${l.code}"><h3><span class="code big">${l.code}</span>How see-through: ${esc(l.pmName)} ${esc(l.what)}</h3>
      <p class="small">Your 38.4 sheet made these see-through in ${esc(l.pmName)} but there is no level yet. Pick one of the preset levels ("rungs"), or type your own. The percentage is how much of the panel colour is laid over the art: 0% = completely clear, 100% = solid.</p>
      <div class="small">What each rung is (a computed aid, not a recommendation):<ul>${l.rungs.map(r => `<li><b>${r.code} · ${pct(r.value)}</b>: ${esc(r.meaning)}</li>`).join('')}</ul></div>
      ${suggBox(l.code)}
      <div class="opts">${opts}<span class="opt">or type % <input style="width:60px" type="number" min="0" max="100" value="${typed}" oninput="setTyped('${l.code}',this.value)"></span></div>
      ${rows}</div>`);
  }
  document.getElementById('ladders').innerHTML = out.join('');
}

function renderBlend(){
  document.getElementById('blend').innerHTML = D.blend.map(b => {
    const a = answered(b.code);
    return `<div class="panel" id="q-${b.code}"><h3><span class="code big">${b.code}</span>${esc(b.pmName)} contact cards: today's level or more see-through?</h3>
      <p class="small">These cards are already see-through today at ${pct(b.today)}. The "more see-through" option is the lowest level that still passes the contrast check, ${pct(b.more)}. This only covers the contact cards; other cards in the app keep today's look (your D-28 rule).</p>
      ${suggBox(b.code)}
      <div class="opts">${opt(a==='keep', `<b>keep</b> · today's ${pct(b.today)}`, 'today\'s level', `setAnswer('${b.code}','keep')`)}${opt(a==='more', `<b>more</b> · ${pct(b.more)}`, '', `setAnswer('${b.code}','more')`)}</div>
      ${b.rows.map(r => `<div class="row2">${fig(r.today, `<b>${b.code} keep</b> · ${esc(b.pmName)} · ${esc(r.art)} · Card view · ${pct(b.today)}`)}${fig(r.more, `<b>${b.code} more</b> · ${esc(b.pmName)} · ${esc(r.art)} · Card view · ${pct(b.more)}`)}</div>`).join('')}</div>`;
  }).join('');
}

function renderOverflow(){
  const a = answered('Q4');
  const pairs = D.combos.filter(c => c.overflowLocal).map(c => `<div class="row2">${fig(c.overflowZoom[0], `<b>Q4 follow</b> · ${c.code} · zoom on the ⋯`)}${fig(c.overflowZoom[1], `<b>Q4 keep</b> · ${c.code} · zoom on the ⋯`)}</div><div class="row2">${fig(c.shots.list, `<b>Q4 follow</b> · ${c.code} · ${esc(c.label)} · ⋯ follows the header (no backing)`)}${fig(c.overflowLocal, `<b>Q4 keep</b> · ${c.code} · ${esc(c.label)} · ⋯ keeps its own small backing`)}</div>`).join('');
  document.getElementById('overflow').innerHTML = `<div class="panel" id="q-Q4"><h3><span class="code big">Q4</span>The ⋯ button in the Contacts header</h3>
    <p class="small">Two of your rulings meet here. D-04 says buttons that open a pop-up menu keep a backing. Your 38.4 sheet gave the Contacts header <b>no</b> backing in Galaxy Light and on the Standard Light art, and the ⋯ (top right) opens a menu. So: should the ⋯ keep a small backing of its own there ("keep"), or have none like the rest of the header ("follow")? Look at the top-right corner of each pair.</p>
    ${suggBox('Q4')}
    <div class="opts">${opt(a==='keep','<b>keep</b> · small backing on ⋯','',"setAnswer('Q4','keep')")}${opt(a==='follow','<b>follow</b> · no backing, like the header','',"setAnswer('Q4','follow')")}</div>${pairs}</div>`;
}

function renderWatch(){
  const a = answered('Q5'); const note = state.answers.Q5 && state.answers.Q5.note || '';
  const figs = D.combos.filter(c => c.watch).map(c => fig(c.shots.digest, `<b>Q5</b> · ${c.code} · ${esc(c.label)} · Digest`, '<span class="badge">WATCH (D-11)</span>')).join('');
  document.getElementById('watch').innerHTML = `<div class="panel" id="q-Q5"><h3><span class="code big">Q5</span>WATCH: the Digest in the hard cases</h3>
    <p class="small">You asked for an explicit check of the Digest wherever the text sits straight on the art in the difficult cases: every Galaxy Light and Standard Dark background, and Dusk. These are the Digest shots for those. The Digest content itself has no backing in every combination (your D-11).</p>
    ${suggBox('Q5')}
    <div class="opts">${opt(a==='ok','<b>ok</b> · looks fine','',"setAnswer('Q5','ok')")}${opt(a==='change','<b>change</b> · something needs changing (say what below)','',"setAnswer('Q5','change',{note:document.getElementById('q5note').value})")}</div>
    <textarea id="q5note" placeholder="What needs changing (optional)" onchange="if(state.answers.Q5){state.answers.Q5.note=this.value;saveAnswer('Q5')}">${esc(note)}</textarea>
    <div class="shots">${figs}</div></div>`;
}

function renderActive(){
  const figs = D.combos.map(c => `<div class="row2">${fig(c.shots.list, `${c.code} · ${esc(c.label)} · buttons at rest`)}${fig(c.active, `${c.code} · ${esc(c.label)} · Population, Filters and Sort all switched on`)}</div>`).join('');
  document.getElementById('active').innerHTML = `<div class="panel"><h3><span class="code big">I1</span>For information, no choice: switched-on Population / Filters / Sort buttons</h3>
    <p class="small">Your 38.4 sheet marked these buttons solid everywhere. When one is switched on (you picked a population, a filter or a sort), today it loses its fill and shows only a coloured outline, so the art shows through it. That is a mismatch with "solid". It is not a choice on this sheet: it goes on the end-of-phase list for your decision (D-28). Nothing on this page changes the buttons.</p>
    <details><summary>Show the 16 pairs</summary>${figs}</details></div>`;
}

function renderFlips(){
  document.getElementById('flips').innerHTML = D.flips.map(f => {
    const a = answered(f.code);
    const sw = f.swatches.map(s => `<tr><td>${s.role}</td><td><span class="swatch" style="background:${s.mode}"></span>${s.mode}</td><td><span class="swatch" style="background:${s.flipped}"></span>${s.flipped}</td></tr>`).join('');
    const rows = f.rows.map(r => `<h3 class="small">${esc(r.art)} art (${r.code})</h3><div class="shots">${fig(r.listReal, `<b>${f.code} mode</b> · ${r.code} · List view · REAL capture, normal text colour`)}${fig(r.listMock, `<b>${f.code} flip</b> · ${r.code} · List view · MOCK of flipped text`, '<span class="badge mock">MOCK</span>')}${fig(r.cardReal, `<b>${f.code} mode</b> · ${r.code} · Card view · REAL capture`)}${fig(r.cardMock, `<b>${f.code} flip</b> · ${r.code} · Card view · MOCK of flipped text`, '<span class="badge mock">MOCK</span>')}</div>`).join('');
    return `<div class="panel" id="q-${f.code}"><h3><span class="code big">${f.code}</span>Text colour on the see-through ${esc(f.pmName)} contact rows and cards</h3>
      <p class="small">In 38.4 you said the text on these see-through rows and cards should flip to the other colour, because it sat on art of the opposite tone. The new art now matches the mode, so the normal ${esc(f.pmName)} text colour ("mode") is what the art suits. Confirm "mode", or choose "flip" (${esc(f.oppName)}'s text colours). The "mode" pictures are real captures; the "flip" pictures are a <b>mock</b> drawn by recolouring the real capture, not the app. A flip would keep the small category chip on its own colours. If you choose flip, the next plan stops and confirms with you before building it.</p>
      ${suggBox(f.code)}
      <div class="opts">${opt(a==='mode','<b>mode</b> · normal text colour','',`setAnswer('${f.code}','mode')`)}${opt(a==='flip','<b>flip</b> · the other mode\'s text colours','',`setAnswer('${f.code}','flip')`)}</div>
      <details><summary>Every colour that would change (including ones not visible in the pictures)</summary><table class="summary"><tr><th>Role</th><th>Now (mode)</th><th>Flipped</th></tr>${sw}</table></details>
      ${rows}</div>`;
  }).join('');
}

function renderGallery(){
  document.getElementById('gallery').innerHTML = D.gallery.map(g => `<h3 class="small"><span class="code">${g.code}</span>${esc(g.label)}</h3><div class="shots">${g.imgs.map(i => fig(i.img, `${g.code} · ${esc(i.route)} · look only`)).join('')}</div>`).join('');
}

function render(){ renderSummary(); renderCombos(); renderLadders(); renderBlend(); renderOverflow(); renderWatch(); renderFlips(); }
const FIXED = D.fixedReason, NOPREVIEW = D.noPreviewReason;

function applySnapshots(){
  db.collection('combos').onSnapshot(snap => {
    for (const d of snap.docs){
      if (!state.combos[d.id]) continue; const b = d.data(); const s = state.combos[d.id];
      for (const k of D.components) if (['full','transparent','none'].includes(b[k.key])) s.cells[k.key] = b[k.key];
      s.foreground = b.foreground && typeof b.foreground === 'object' ? {...b.foreground} : {};
      s.note = typeof b.note === 'string' ? b.note : ''; s.reviewed = b.reviewed === true; s.updatedAt = b.updatedAt || null;
    }
    render();
  }, e => setStatus('Live sync stopped ('+e.code+'); answers still export'));
  db.collection('answers').onSnapshot(snap => {
    for (const d of snap.docs){ if (D.suggest[d.id]) state.answers[d.id] = {...d.data()}; }
    render();
  }, e => setStatus('Live sync stopped ('+e.code+'); answers still export'));
}

render(); renderActive(); renderGallery();
(async () => {
  try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch(e){ db = null; }
  if (!db){ setStatus('Saving unavailable in this view — your clicks still work; use "Download answers JSON" or reply in chat with the codes'); return; }
  setStatus('Saving on: every click saves automatically'); applySnapshots();
})();
"""


def page(data: dict) -> str:
    data = {**data, "fixedReason": FIXED_REASON, "noPreviewReason": NOPREVIEW_REASON}
    payload = json.dumps(data).replace("</", "<\\/")
    gloss = """
<dl class="gloss">
<dt>Combination</dt><dd>One theme (Galaxy or Standard), one mode (Light or Dark) and one background picture. There are 16: three art backgrounds plus "None" (plain colour), in each of the four theme + mode pairs. Each has a code such as <span class="code">GL-Aurora</span> (Galaxy Light, Aurora art). GL = Galaxy Light, GD = Galaxy Dark, SL = Standard Light, SD = Standard Dark.</dd>
<dt>Backing</dt><dd>The panel drawn behind a piece of text or a button so it stands out from the background picture.</dd>
<dt>F · full (solid)</dt><dd>The backing is solid; the art does not show through it.</dd>
<dt>T · see-through (transparent)</dt><dd>The backing is a thin tint and the art shows through it. How thin is set by the see-through level (Q2).</dd>
<dt>N · none</dt><dd>No backing at all; the text sits straight on the art.</dd>
<dt>See-through level, rung</dt><dd>A see-through backing's strength, as a percentage: 0% is completely clear, 100% is solid. A "rung" is one of a few preset levels shown side by side (R1, R2, R3, from most to least see-through).</dd>
<dt>Your 38.4 choice</dt><dd>What you picked on the last sign-off sheet (v2). Every choice here starts there, and every screenshot shows it, now on the new art. You only need to change what you want different.</dd>
</dl>"""
    art = ("<p class=\"small\">The art: Galaxy has <b>Deep Space</b> (the quiet one), <b>Aurora</b> and <b>Starfield</b>; "
           "Standard has <b>Dawn</b>, <b>Paper</b> and <b>Dusk</b>. Each has a Light and a Dark version, shown automatically "
           "in its mode. <b>None</b> is the plain background colour.</p>")
    missing = ("<div class=\"panel small\" style=\"border-color:var(--watch)\">Missing shots: " + html.escape(", ".join(data["missing"])) + "</div>") if data["missing"] else ""
    # Authored as a Claude artifact body: the publish step adds the doctype/head skeleton.
    return f"""<title>Orbit Scrim Sign-off v3</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">
<style>{CSS}</style>
<div class="status"><b>Orbit scrim re-sign-off v3</b><span id="savestate">Connecting…</span>
<button class="primary" id="acceptall" onclick="acceptAll()">Accept all of Claude's suggestions</button>
<button onclick="copyJson()">Copy JSON</button></div>
<main>
<h1>Backings over the new art — your re-sign-off</h1>
<p>This is the same sheet as your 38.4 sign-off (v2), now on the new art you approved. Every choice starts at your 38.4 answer, and every screenshot shows that answer on a real debug build on the Pixel 3a at font size 1.15. Where you change something, your new answer wins (D-13).</p>
<p><b>Three ways to answer:</b> (1) click through; each click saves automatically. (2) Press <b>Accept all of Claude's suggestions</b> at the top, then change anything you disagree with. (3) Reply in chat with codes, e.g. <span class="code">accept all</span> or <span class="code">Q2a R1</span> <span class="code">GL-Aurora Count: T</span> <span class="code">Q4 follow</span>.</p>
<nav class="small"><a href="#sec-summary">Summary</a><a href="#sec-q1">Q1 combinations</a><a href="#sec-q2">Q2 levels</a><a href="#sec-q3">Q3 card blend</a><a href="#sec-q4">Q4 ⋯</a><a href="#sec-q5">Q5 WATCH</a><a href="#sec-q6">Q6 text colour</a><a href="#sec-info">Info</a><a href="#sec-gallery">Gallery</a></nav>
{missing}
<div class="panel"><h3>Words used on this page</h3>{gloss}{art}</div>
<h2 id="sec-summary">Every question at a glance</h2>
<p class="small">Only the questions below need you. Claude's suggestion is shown for each; it is only a suggestion, and your choice governs.</p>
<div id="summary"></div>
<h2 id="sec-q1"><span class="code big">Q1</span>The 16 combinations</h2>
<p class="small">For each combination: the Contacts List view, the Contacts Card view and the Digest, then one row per part of the screen with F / T / N. Your 38.4 choice is pre-selected and tagged. Top buttons and the search + switch are always solid (not asked). The four Digest content parts have no preview. Tick <b>Reviewed</b> when you are happy with a combination. Suggestion for all of Q1: keep your 38.4 choices.</p>
<div id="combos"></div>
<h2 id="sec-q2">Q2 · How see-through the new see-through parts are</h2><div id="ladders"></div>
<h2 id="sec-q3">Q3 · Card blend</h2><div id="blend"></div>
<h2 id="sec-q4">Q4 · The ⋯ button</h2><div id="overflow"></div>
<h2 id="sec-q5">Q5 · WATCH</h2><div id="watch"></div>
<h2 id="sec-q6">Q6 · Text colour on see-through contact rows and cards</h2><div id="flips"></div>
<h2 id="sec-info">For information</h2><div id="active"></div>
<h2 id="sec-gallery">Gallery: look only, no choices</h2>
<p class="small">Three screens with a lot of text straight on the art, in each of the 12 art combinations, as the app draws them today. Nothing to choose here (your D-04 / D-27): it is for you to see the new art under real screens. The AI screen is only viewed; nothing was sent to an AI provider.</p>
<div id="gallery"></div>
<textarea id="jsonout" style="display:none;min-height:200px"></textarea>
</main>
<script type="application/json" id="data">{payload}</script>
<script>{JS}</script>
"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()
    data = build(args.out)
    (args.out / "site" / "index.html").write_text(page(data))
    files = [p for p in (args.out / "site").rglob("*") if p.is_file()]
    print(f"site: {args.out / 'site'}  files={len(files)}  bytes={sum(p.stat().st_size for p in files)}")
    if data["missing"]:
        print(f"MISSING {len(data['missing'])}: {data['missing'][:12]}")


if __name__ == "__main__":
    main()
