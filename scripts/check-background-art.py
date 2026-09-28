#!/usr/bin/env python3
"""Orbit background-art contrast checker (38.5-03; promoted from the 38.4 brief's
check_art.py, section H; D-14, D-20, D-24, H-2, M-4).

Models exactly what the app renders for text that sits directly on the art (no
card, no scrim): the BackgroundHost veil (the palette `surface` colour at the
density opacity) is blended over EVERY pixel of the WHOLE canvas in sRGB space,
rounded per channel like src/theme/tokens/surface.ts alphaComposite() (JS
Math.round). Every bare foreground must reach its WCAG floor against every
pixel: 4.5:1 for textPrimary / textSecondary / textPlaceholder / danger and all
eight user-selectable accentText links, 3.0:1 for status glyphs and rogue. It
also checks the card/chrome proof (surface tint at the presentation card
opacity; one composite standing for both treatments, section D of the brief).

Every colour and opacity comes from scripts/art-checker-constants.json (synced
to the TS theme by src/theme/art-checker-constants.test.ts); this file holds no
colour table.

H1 = whole canvas, presentation veil, 0.00% failing pixels, card/chrome ok.
H2 = the same with --margin 0.1.

Run with numpy (not in system Python):
  uv run --no-project --with numpy --with pillow python3 scripts/check-background-art.py \\
      IMAGE --package galaxy|standard --mode dark|light [options]

Exit 0 = PASS, 1 = FAIL, 2 = usage error / unreadable image / malformed
manifest, constants or accepted-exclusions block.
"""
import argparse
import json
import os
import shutil
import sys
import tempfile

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import background_manifest as bm  # noqa: E402

DENSITIES = ("presentation", "comfortable", "dense")
# Card/chrome foregrounds (surface.test.ts TEXT_FGS + danger + STATUS_FGS); in
# Standard Light over an asset they come from the glass-scoped palette.
CARD_TOKENS = ("textPrimary", "textSecondary", "danger", "statusStable", "statusWobble",
               "statusDecay", "rogue")

HELP_EPILOG = """\
feature allowance (D-20, M-4 union semantics):
  --feature-max-px N --feature-max-pct P  PASS only when every 8-connected
  component of the UNION failing mask is <= N px and the union covers <= P % of
  the canvas. The union is taken over every foreground token's failure mask:
  every bare token, every accent, and the card/chrome section. A pixel failing
  for several tokens counts once; disjoint failures that each fit alone can fail
  together. With an allowance the output also reports textBearingBound: the
  channel-wise darkest and brightest pixel outside the allowed failing
  components (excluded pixels count as text-bearing). 38.5-05 declares that
  bound for such a variant. Without an allowance any failing pixel fails.

accepted exclusions (H-2):
  --accepted-exclusions MD reads the one fenced json block under
  "## Accepted exclusions (machine-readable)" in an ART-SIGNOFF markdown
  (parsed and validated by scripts/background_manifest.py). For the variant
  being checked (--slot and --mode; --all supplies the slot) each record removes
  exactly its listed tokens' failures ("accentText" = every accent,
  "accentText:<id>" = one) inside its region, or over the whole canvas when it
  names a feature, BEFORE the verdict and before the allowance is measured. A
  record acts in the bare section iff its treatments include "bare", and in the
  card/chrome section iff they include "card" and "chrome"; listEntry, cardEntry
  and artChrome act only in the TS proof. Excluded pixel counts are reported per
  record. A malformed or missing block is an error (exit 2), never a pass.

--all checks every shipped variant of src/theme/backgrounds.ts in its own mode,
applies each variant's declared featureAllowance, and applies
--exclude-galaxy-dark-danger only to galaxy/dark variants.
"""


# ---- colour maths (mirrors src/theme/contrast.ts + surface.ts) ----------------
def rgb(hexv):
    return np.array([int(hexv[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)


def hex_of(triple):
    return "#" + "".join(f"{int(c):02X}" for c in triple)


def lum(c):
    s = np.asarray(c, dtype=np.float64) / 255.0
    lin = np.where(s <= 0.03928, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]


def lstar(y):
    return np.where(y > 216 / 24389, 116 * np.cbrt(y) - 16, y * 24389 / 27)


def blend(tint, px, alpha):
    a = max(0.0, min(1.0, float(alpha)))
    return np.clip(np.floor(tint * a + px * (1 - a) + 0.5), 0, 255)


# ---- constants → sections ------------------------------------------------------
def build_sections(constants, package, mode, density, exclude_gd_danger):
    """The bare (veil) section and the card/chrome section for one package x mode."""
    key = f"{package}-{mode}"
    text_floor = constants["floors"]["text"]
    tint = rgb(constants["surface"][key])
    accents = [(f"accentText:{aid}", rgb(h), text_floor)
               for aid, h in constants["accentText"][key].items()]
    bare = [(t["token"], rgb(t["hex"]), t["floor"]) for t in constants["bare"][key]] + accents
    if exclude_gd_danger and key == "galaxy-dark":
        bare = [t for t in bare if t[0] != "danger"]
    if key == "standard-light":
        glass = constants["standardLightGlass"]
        card = [(t["token"], rgb(t["hex"]), t["floor"]) for t in glass["tokens"]] + [
            (f"accentText:{aid}", rgb(h), text_floor) for aid, h in glass["accentText"].items()]
    else:
        root = {t["token"]: t for t in constants["bare"][key]}
        card = [(n, rgb(root[n]["hex"]), root[n]["floor"]) for n in CARD_TOKENS] + accents
        if key == "galaxy-dark":
            # E-1 (ADR-084 owner-accepted Galaxy Dark danger), scoped to card + chrome.
            card = [t for t in card if t[0] != "danger"]
    return [
        {"name": "bare", "tint": tint, "alpha": constants["veil"][key][density], "tokens": bare},
        {"name": "cardChrome", "tint": tint, "alpha": constants["card"][key], "tokens": card},
    ]


# ---- 8-connected components (run-length union-find; no scipy) -----------------
def label_components(mask):
    """Return (runs, roots, sizes): runs = [(y, x0, x1)], roots[i] = component id of
    run i, sizes = {component id: pixel count}, 8-connectivity."""
    runs, parent = [], []

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    prev = []
    padded = np.zeros(mask.shape[1] + 2, dtype=np.int8)
    for y in range(mask.shape[0]):
        row = mask[y]
        if not row.any():
            prev = []
            continue
        padded[1:-1] = row
        d = np.diff(padded)
        starts = np.flatnonzero(d == 1).tolist()
        ends = np.flatnonzero(d == -1).tolist()
        cur = []
        j = 0
        for s, e in zip(starts, ends):
            idx = len(runs)
            runs.append((y, s, e))
            parent.append(idx)
            cur.append(idx)
            # run [s, e) touches prev run [ps, pe) (8-conn) iff ps <= e and pe >= s
            while j < len(prev) and runs[prev[j]][2] < s:
                j += 1
            k = j
            while k < len(prev) and runs[prev[k]][1] <= e:
                a, b = find(prev[k]), find(idx)
                if a != b:
                    parent[b] = a
                k += 1
        prev = cur
    roots = [find(i) for i in range(len(runs))]
    sizes = {}
    for (y, s, e), r in zip(runs, roots):
        sizes[r] = sizes.get(r, 0) + (e - s)
    return runs, roots, sizes


# ---- evaluation -----------------------------------------------------------------
def _token_matches(record_token, name):
    if record_token == name:
        return True
    return record_token == "accentText" and name.startswith("accentText:")


def _region_mask(shape, rec):
    m = np.zeros(shape, dtype=bool)
    if "region" in rec:
        r = rec["region"]
        m[r["y"]:r["y"] + r["h"], r["x"]:r["x"] + r["w"]] = True
    else:
        m[:, :] = True
    return m


def evaluate(px, sections, margin=0.0, allowance=None, exclusions=(), slot=None, mode=None):
    """Evaluate one image. `px` is an HxWx3 float array of the raw art.

    Returns a result dict; `_union` holds the post-exclusion union failing mask.
    """
    h, w = px.shape[:2]
    total = h * w
    applicable = [r for r in exclusions if r["slotId"] == slot and r["mode"] == mode]
    union = np.zeros((h, w), dtype=bool)
    excluded = {r["id"]: {"bare": 0, "cardChrome": 0} for r in applicable}
    out_sections = {}
    for sec in sections:
        yb = lum(blend(sec["tint"], px, sec["alpha"]))
        section_treatment = "bare" if sec["name"] == "bare" else "card"
        recs = [r for r in applicable if section_treatment in r["treatments"]]
        rows = []
        sec_bad = np.zeros((h, w), dtype=bool)
        removed_by = {r["id"]: np.zeros((h, w), dtype=bool) for r in recs}
        for name, fg, floor in sec["tokens"]:
            yt = float(lum(fg))
            ratio = (np.maximum(yt, yb) + 0.05) / (np.minimum(yt, yb) + 0.05)
            # --margin is design headroom on BARE text only (brief H2); the card/chrome
            # proof always runs at the exact floor, as in the brief.
            fail = ratio < floor + (margin if sec["name"] == "bare" else 0.0)
            keep = np.ones((h, w), dtype=bool)
            for r in recs:
                if any(_token_matches(t, name) for t in r["tokens"]):
                    region = _region_mask((h, w), r)
                    removed_by[r["id"]] |= fail & region
                    keep &= ~region
            fail &= keep
            worst = float(ratio[keep].min()) if keep.any() else None
            rows.append({"token": name, "floor": floor, "worst": worst,
                         "failingPct": float(fail.mean() * 100)})
            sec_bad |= fail
        for rid, m in removed_by.items():
            excluded[rid][sec["name"]] = int(m.sum())
        union |= sec_bad
        out_sections[sec["name"]] = {
            "alpha": sec["alpha"],
            "tokens": rows,
            "failingPct": float(sec_bad.mean() * 100),
            "result": "ok" if not sec_bad.any() else "FAIL",
            "_mask": sec_bad,
        }
    union_px = int(union.sum())
    runs, roots, sizes = label_components(union)
    largest = max(sizes.values()) if sizes else 0
    union_pct = union_px / total * 100
    if allowance is None:
        ok = union_px == 0
    else:
        ok = largest <= allowance["maxComponentPx"] and union_pct <= allowance["maxFailingPct"]
    result = {
        "size": [w, h],
        "sections": out_sections,
        "unionFailingPx": union_px,
        "unionFailingPct": union_pct,
        "components": {"count": len(sizes), "largestPx": largest},
        "allowance": allowance,
        "exclusions": [{"id": rid, "excludedPx": counts} for rid, counts in excluded.items()],
        "result": "PASS" if ok else "FAIL",
        "_union": union,
    }
    if allowance is not None:
        allowed = np.zeros((h, w), dtype=bool)
        for (y, s, e), r in zip(runs, roots):
            if sizes[r] <= allowance["maxComponentPx"]:
                allowed[y, s:e] = True
        bearing = px[~allowed]
        if bearing.size:
            result["textBearingBound"] = {
                "darkest": hex_of(bearing.min(axis=0)),
                "brightest": hex_of(bearing.max(axis=0)),
            }
        else:
            result["textBearingBound"] = None
    return result


def lstar_stats(px):
    ls = lstar(lum(px))
    return {"min": float(ls.min()), "p1": float(np.percentile(ls, 1)),
            "median": float(np.median(ls)), "p99": float(np.percentile(ls, 99)),
            "max": float(ls.max())}


def public(result):
    """Strip internal arrays for --json."""
    out = {k: v for k, v in result.items() if not k.startswith("_")}
    out["sections"] = {n: {k: v for k, v in s.items() if not k.startswith("_")}
                       for n, s in result["sections"].items()}
    return out


def print_human(meta, result):
    ls = meta["lstar"]
    print(f"{meta['image']}: {result['size'][0]}x{result['size'][1]}  art L* min {ls['min']:.1f} / "
          f"p1 {ls['p1']:.1f} / median {ls['median']:.1f} / p99 {ls['p99']:.1f} / max {ls['max']:.1f}")
    bare = result["sections"]["bare"]
    print(f"\nBARE TEXT on the art ({meta['package']} {meta['mode']}"
          f"{' slot ' + meta['slot'] if meta.get('slot') else ''}, veil {bare['alpha']} @ "
          f"{meta['density']}, margin {meta['margin']}):")
    for row in bare["tokens"]:
        worst = "  n/a" if row["worst"] is None else f"{row['worst']:5.2f}"
        print(f"  {'ok  ' if row['failingPct'] == 0 else 'FAIL'} {row['token']:26s} floor "
              f"{row['floor']:<3}  worst {worst}:1  failing px {row['failingPct']:6.2f}%")
    mask = bare["_mask"]
    h, w = mask.shape
    if mask.any() and h >= 16 and w >= 8:
        grid = mask[: h // 16 * 16, : w // 8 * 8].reshape(16, h // 16, 8, w // 8).mean((1, 3)) * 100
        print("  failing-pixel % per cell (8 cols x 16 rows, top row first):")
        for r in grid:
            print("   " + " ".join(f"{v:4.0f}" for v in r))
    card = result["sections"]["cardChrome"]
    failing = [r["token"] for r in card["tokens"] if r["failingPct"] > 0]
    print(f"\nCARD/CHROME proof ({card['alpha']} tint): {card['result']}"
          + ("" if not failing else "  -> " + ", ".join(failing)))
    print(f"\nUNION failing px {result['unionFailingPx']} ({result['unionFailingPct']:.4f}%), "
          f"8-connected components {result['components']['count']}, largest "
          f"{result['components']['largestPx']} px")
    if result["allowance"] is not None:
        a = result["allowance"]
        print(f"feature allowance: components <= {a['maxComponentPx']} px, union <= "
              f"{a['maxFailingPct']}%  textBearingBound {result.get('textBearingBound')}")
    for ex in result["exclusions"]:
        print(f"exclusion {ex['id']}: removed {ex['excludedPx']['bare']} bare px, "
              f"{ex['excludedPx']['cardChrome']} card/chrome px")
    print("\nRESULT:", result["result"])


def load_image(path):
    try:
        with Image.open(path) as im:
            return np.asarray(im.convert("RGB")).astype(np.float64)
    except OSError as err:
        raise bm.ParseError(f"cannot decode {path}: {err}") from err


def check_one(constants, image, package, mode, density, margin, exclude_gd_danger,
              allowance, exclusions, slot, px=None):
    if px is None:
        px = load_image(image)
    sections = build_sections(constants, package, mode, density, exclude_gd_danger)
    result = evaluate(px, sections, margin, allowance, exclusions, slot, mode)
    meta = {"image": image, "package": package, "mode": mode, "slot": slot,
            "density": density, "margin": margin, "lstar": lstar_stats(px)}
    return meta, result


def build_parser():
    ap = argparse.ArgumentParser(
        description=__doc__.split("\n\n")[0],
        epilog=HELP_EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("image", nargs="?", help="PNG or WebP to check")
    ap.add_argument("--package", choices=["galaxy", "standard"])
    ap.add_argument("--mode", choices=["dark", "light"])
    ap.add_argument("--slot", help="slot id of the variant (selects --accepted-exclusions records)")
    ap.add_argument("--density", default="presentation", choices=list(DENSITIES))
    ap.add_argument("--margin", type=float, default=0.0,
                    help="extra ratio headroom, e.g. 0.1 while designing (H2)")
    ap.add_argument("--exclude-galaxy-dark-danger", action="store_true",
                    help="skip bare danger text in Galaxy Dark (D-24 extend: E-1-bare)")
    ap.add_argument("--feature-max-px", type=int,
                    help="D-20 allowance: largest 8-connected component of the union failing mask")
    ap.add_argument("--feature-max-pct", type=float,
                    help="D-20 allowance: union failing percentage of the canvas")
    ap.add_argument("--accepted-exclusions", metavar="MD",
                    help="ART-SIGNOFF markdown holding the accepted-exclusions json block (H-2)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--all", action="store_true",
                    help="check every shipped variant of src/theme/backgrounds.ts in its own mode")
    ap.add_argument("--self-test", action="store_true", help="run the synthetic fixtures")
    return ap


def main(argv):
    ap = build_parser()
    try:
        a = ap.parse_args(argv)
    except SystemExit as exc:
        return 2 if exc.code else 0
    if a.self_test:
        return self_test()
    try:
        constants = bm.load_constants()
        allowance = None
        if (a.feature_max_px is None) != (a.feature_max_pct is None):
            print("check-background-art: --feature-max-px and --feature-max-pct go together",
                  file=sys.stderr)
            return 2
        if a.feature_max_px is not None:
            allowance = {"maxComponentPx": a.feature_max_px, "maxFailingPct": a.feature_max_pct}
            if a.feature_max_px < 1 or not (0 < a.feature_max_pct <= 100):
                print("check-background-art: allowance needs px >= 1 and 0 < pct <= 100",
                      file=sys.stderr)
                return 2
        exclusions = []
        if a.accepted_exclusions:
            exclusions = bm.parse_accepted_exclusions(a.accepted_exclusions)["exclusions"]
        if a.all:
            outputs, ok = [], True
            decoded = {}
            for v in bm.parse_manifest():
                if v["asset"] not in decoded:
                    decoded[v["asset"]] = load_image(v["asset"])
                meta, result = check_one(
                    constants, os.path.relpath(v["asset"], bm.REPO_ROOT), v["package"], v["mode"],
                    a.density, a.margin,
                    a.exclude_galaxy_dark_danger and v["package"] == "galaxy" and v["mode"] == "dark",
                    v["featureAllowance"] or allowance, exclusions, v["slot"], decoded[v["asset"]])
                ok = ok and result["result"] == "PASS"
                if a.json:
                    outputs.append({**meta, **public(result)})
                else:
                    print(f"==== {v['slot']}/{v['mode']} ====")
                    print_human(meta, result)
                    print()
            if a.json:
                print(json.dumps({"variants": outputs, "result": "PASS" if ok else "FAIL"}, indent=2))
            else:
                print("ALL:", "PASS" if ok else "FAIL")
            return 0 if ok else 1
        if not a.image or not a.package or not a.mode:
            print("check-background-art: IMAGE, --package and --mode are required "
                  "(or use --all / --self-test)", file=sys.stderr)
            return 2
        if a.accepted_exclusions and not a.slot:
            print("check-background-art: --accepted-exclusions needs --slot", file=sys.stderr)
            return 2
        meta, result = check_one(constants, a.image, a.package, a.mode, a.density, a.margin,
                                 a.exclude_galaxy_dark_danger, allowance, exclusions, a.slot)
    except bm.ParseError as err:
        print(f"check-background-art: {err}", file=sys.stderr)
        return 2
    if a.json:
        print(json.dumps({**meta, **public(result)}, indent=2))
    else:
        print_human(meta, result)
    return 0 if result["result"] == "PASS" else 1


# ---- self-test ------------------------------------------------------------------
def self_test():
    constants = bm.load_constants()
    failures = []

    def expect(cond, label):
        print(f"  {'ok  ' if cond else 'FAIL'} {label}")
        if not cond:
            failures.append(label)

    def canvas(w, h, colour):
        img = np.zeros((h, w, 3), dtype=np.float64)
        img[:, :] = colour
        return img

    def real(px, pkg="galaxy", mode="dark", allowance=None, exclusions=(), slot=None, margin=0.0,
             exclude=False):
        return evaluate(px, build_sections(constants, pkg, mode, "presentation", exclude),
                        margin, allowance, exclusions, slot, mode)

    deep, bright, mid = (5, 5, 5), (255, 255, 255), (119, 119, 119)
    print("self-test: uniform images")
    expect(real(canvas(40, 40, deep))["result"] == "PASS", "uniform in-band Galaxy Dark image passes")
    r = real(canvas(40, 40, mid))
    expect(r["result"] == "FAIL" and abs(r["unionFailingPct"] - 100) < 1e-9,
           "uniform out-of-band image fails with 100% failing")

    print("self-test: feature allowance")
    img = canvas(200, 200, deep)
    img[20:23, 20:23] = bright
    img[150:153, 100:103] = bright
    allow = {"maxComponentPx": 9, "maxFailingPct": 0.1}
    r = real(img, allowance=allow)
    expect(r["result"] == "PASS" and r["components"] == {"count": 2, "largestPx": 9},
           "two isolated 3x3 specks pass at --feature-max-px 9 --feature-max-pct 0.1")
    expect(real(img)["result"] == "FAIL", "the same specks fail with no allowance")
    img4 = canvas(200, 200, deep)
    img4[50:54, 50:54] = bright
    expect(real(img4, allowance=allow)["result"] == "FAIL", "one 4x4 speck fails at --feature-max-px 9")

    print("self-test: union semantics (M-4)")
    white_tok = ("white", np.array([255.0, 255.0, 255.0]), 3.0)
    black_tok = ("black", np.array([0.0, 0.0, 0.0]), 3.0)
    grey = np.array([124.0, 124.0, 124.0])  # passes both tokens at 3.0

    def sect(tokens, alpha=0.0):
        return [{"name": "bare", "tint": np.zeros(3), "alpha": alpha, "tokens": tokens}]

    same = canvas(100, 100, grey)
    same[10:13, 10:13] = bright  # fails the white token AND a near-white token
    near_white = ("nearWhite", np.array([250.0, 250.0, 250.0]), 3.0)
    r = evaluate(same, sect([white_tok, near_white]), allowance={"maxComponentPx": 9, "maxFailingPct": 0.1})
    expect(r["unionFailingPx"] == 9 and r["result"] == "PASS",
           "two tokens failing on the same 3x3 speck count 9 px once (pass at 9)")
    disjoint = canvas(100, 100, grey)
    disjoint[0:5, 0:6] = (0, 0, 0)       # fails the black token only (30 px, 0.3%)
    disjoint[50:55, 50:56] = bright      # fails the white token only (30 px, 0.3%)
    a05 = {"maxComponentPx": 30, "maxFailingPct": 0.5}
    alone = [evaluate(disjoint, sect([tok]), allowance=a05)["result"] for tok in (black_tok, white_tok)]
    expect(alone == ["PASS", "PASS"], "each disjoint region alone fits (0.3% <= 0.5%)")
    r = evaluate(disjoint, sect([black_tok, white_tok]), allowance=a05)
    expect(r["unionFailingPct"] > 0.5 and r["result"] == "FAIL",
           "disjoint regions that each fit fail together (union 0.6% > 0.5%)")
    diag = canvas(100, 100, grey)
    diag[10:12, 10:12] = (0, 0, 0)
    diag[12:14, 12:14] = bright
    r = evaluate(diag, sect([black_tok, white_tok]), allowance={"maxComponentPx": 4, "maxFailingPct": 1})
    expect(r["components"] == {"count": 1, "largestPx": 8} and r["result"] == "FAIL",
           "two 2x2 specks for different tokens touching diagonally form one 8-px component")

    print("self-test: accepted exclusions (H-2)")
    tmp = tempfile.mkdtemp(prefix="check-art-selftest-")

    def md(block, heading=bm.ACCEPTED_EXCLUSIONS_HEADING):
        path = os.path.join(tmp, f"signoff-{len(os.listdir(tmp))}.md")
        body = f"# Sign-off\n\n{heading}\n\n```json\n{block}\n```\n" if block is not None else \
            "# Sign-off\n\nno block here\n"
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(body)
        return path

    def rec(**kw):
        base = {"id": "X-1", "slotId": "galaxy-fixture", "mode": "dark", "tokens": ["danger"],
                "treatments": ["bare"], "region": {"x": 0, "y": 20, "w": 60, "h": 20},
                "reason": "owner-accepted fixture band", "ownerApproved": "2026-09-28"}
        base.update(kw)
        return {k: v for k, v in base.items() if v is not None}

    def block(*excl, allowances=()):
        return json.dumps({"allowances": list(allowances), "exclusions": list(excl)})

    def parse(*excl, allowances=()):
        return bm.parse_accepted_exclusions(md(block(*excl, allowances=allowances)))["exclusions"]

    # A band that fails only bare Galaxy Dark `danger` (art L* ~12: under the 18.5
    # textSecondary edge, over the 8.2 danger edge).
    band_img = canvas(60, 60, deep)
    band_img[25:35, :] = (30, 30, 30)
    base = real(band_img, slot="galaxy-fixture")
    expect(base["result"] == "FAIL" and [t["token"] for t in base["sections"]["bare"]["tokens"]
                                         if t["failingPct"] > 0] == ["danger"],
           "fixture band fails bare danger only")
    ex = parse(rec())
    r = real(band_img, exclusions=ex, slot="galaxy-fixture")
    expect(r["result"] == "PASS" and r["exclusions"][0]["excludedPx"]["bare"] == 600,
           "an exclusion for that slot/mode/token/region passes the band (600 px reported)")
    r = real(band_img, exclusions=parse(rec(tokens=["textSecondary"])), slot="galaxy-fixture")
    expect(r["result"] == "FAIL", "the same band fails when the record lists another token")
    r = real(band_img, exclusions=parse(rec(region={"x": 0, "y": 40, "w": 60, "h": 10})),
             slot="galaxy-fixture")
    expect(r["result"] == "FAIL", "the band fails when it lies outside the region")
    expect(real(band_img, exclusions=ex, slot="galaxy-other")["result"] == "FAIL",
           "the record has no effect for another slot")
    ex_light = parse(rec(mode="light"))
    expect(real(band_img, exclusions=ex_light, slot="galaxy-fixture")["result"] == "FAIL",
           "the record has no effect for another mode")

    def parse_error(label, path):
        try:
            bm.parse_accepted_exclusions(path)
            expect(False, f"{label} is a parse error")
        except bm.ParseError as err:
            expect(True, f"{label} is a parse error ({err})")

    parse_error("a markdown with no block", md(None))
    parse_error("a malformed block", md("{ not json"))
    parse_error("an exclusion missing ownerApproved", md(block(rec(ownerApproved=None))))
    png = os.path.join(tmp, "band.png")
    Image.fromarray(band_img.astype(np.uint8)).save(png)
    code = main([png, "--package", "galaxy", "--mode", "dark", "--slot", "galaxy-fixture",
                 "--accepted-exclusions", md(block(rec(ownerApproved=None))), "--json"])
    expect(code == 2, "the CLI exits 2 on an invalid exclusion, never a silent pass")
    code = main([png, "--package", "galaxy", "--mode", "dark", "--slot", "galaxy-fixture",
                 "--accepted-exclusions", md(None)])
    expect(code == 2, "the CLI exits 2 when the markdown has no block")

    print("self-test: exclusion schema (C2-M2)")
    ts = ("textSecondary", rgb(constants["bare"]["galaxy-dark"][1]["hex"]), 4.5)
    two = [{"name": "bare", "tint": np.zeros(3), "alpha": 0.0, "tokens": [ts]},
           {"name": "cardChrome", "tint": np.zeros(3), "alpha": 0.0, "tokens": [ts]}]
    ts_band = canvas(60, 60, deep)
    ts_band[25:35, :] = mid
    whole = {"x": 0, "y": 0, "w": 60, "h": 60}
    r = evaluate(ts_band, two, exclusions=parse(rec(tokens=["textSecondary"], region=whole)),
                 slot="galaxy-fixture", mode="dark")
    expect(r["sections"]["bare"]["result"] == "ok" and r["sections"]["cardChrome"]["result"] == "FAIL"
           and r["result"] == "FAIL", "treatments [bare] relaxes the bare section only")
    r = evaluate(ts_band, two, exclusions=parse(rec(tokens=["textSecondary"], region=whole,
                                                    treatments=["card", "chrome"])),
                 slot="galaxy-fixture", mode="dark")
    expect(r["sections"]["bare"]["result"] == "FAIL" and r["sections"]["cardChrome"]["result"] == "ok",
           "treatments [card, chrome] relaxes the card/chrome section only")
    parse_error("treatments [card] alone", md(block(rec(treatments=["card"]))))
    parse_error("treatments [chrome] alone", md(block(rec(treatments=["chrome"]))))
    for t in ("listEntry", "cardEntry", "artChrome"):
        parse_error(f"a region record naming {t}", md(block(rec(treatments=["bare", t]))))
    feature_ok = parse(rec(treatments=["bare", "listEntry", "cardEntry", "artChrome"], region=None,
                           feature="the visible Aurora ribbon"))
    expect(len(feature_ok) == 1, "the same record with a feature parses")
    acc_img = canvas(40, 40, mid)
    all_acc = real(acc_img, exclusions=parse(rec(tokens=["accentText"], region=None,
                                                 feature="whole canvas")), slot="galaxy-fixture")
    acc_rows = {t["token"]: t["failingPct"] for t in all_acc["sections"]["bare"]["tokens"]}
    expect(all(v == 0 for k, v in acc_rows.items() if k.startswith("accentText:"))
           and acc_rows["textPrimary"] == 100, "tokens [accentText] removes every accent's failures")
    one_acc = real(acc_img, exclusions=parse(rec(tokens=["accentText:coral"], region=None,
                                                 feature="whole canvas")), slot="galaxy-fixture")
    acc_rows = {t["token"]: t["failingPct"] for t in one_acc["sections"]["bare"]["tokens"]}
    expect(acc_rows["accentText:coral"] == 0
           and all(v == 100 for k, v in acc_rows.items() if k.startswith("accentText:") and k != "accentText:coral"),
           "tokens [accentText:coral] removes only coral's failures")
    parse_error("a record missing id", md(block(rec(id=None))))
    parse_error("a duplicated id", md(block(rec(), rec(slotId="galaxy-other"))))
    parse_error("an unknown token", md(block(rec(tokens=["accent"]))))
    parse_error("an unknown accent", md(block(rec(tokens=["accentText:teal"]))))
    parse_error("an unknown treatment", md(block(rec(treatments=["bare", "scrim"]))))
    parse_error("both region and feature", md(block(rec(feature="both"))))
    parse_error("neither region nor feature", md(block(rec(region=None))))
    parse_error("an unknown key", md(block(rec(note="x"))))

    print("self-test: shared allowance fixture (C2-L3)")
    fx = bm.ALLOWANCE_FIXTURE
    fw, fh = fx["size"]
    fimg = np.zeros((fh, fw, 3), dtype=np.float64)
    fimg[:, : fw // 2] = fx["baseLeft"]
    fimg[:, fw // 2:] = fx["baseRight"]
    for x, y, sw, sh in fx["specks"]:
        fimg[y:y + sh, x:x + sw] = fx["speckColor"]
    fa = {k: fx["allowance"][k] for k in ("maxComponentPx", "maxFailingPct")}
    r = real(fimg, fx["package"], fx["mode"], allowance=fa)
    want = {"darkest": hex_of(fx["expectedBound"]["darkest"]),
            "brightest": hex_of(fx["expectedBound"]["brightest"])}
    expect(r["result"] == "PASS" and r.get("textBearingBound") == want,
           f"textBearingBound {r.get('textBearingBound')} equals the fixture bound {want}")

    shutil.rmtree(tmp, ignore_errors=True)
    print("self-test", "passed" if not failures else f"FAILED ({len(failures)})")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
