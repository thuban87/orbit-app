#!/usr/bin/env python3
#
# The single Python parser of the background manifest and the owner's accepted
# art exclusions (38.5-03; D-20, D-23, H-2, C2-M2, C3-L3, C3-M1).
#
# Imported by BOTH `scripts/measure-background-extrema.py` (Pillow only) and
# `scripts/check-background-art.py` (numpy + Pillow), so the two validators read
# the same variants, the same `featureAllowance` and the same exclusion records.
# This module is pure standard library.
#
#   parse_manifest()            -> one record per (slot, mode) variant of
#                                  `src/theme/backgrounds.ts` BACKGROUND_SLOTS
#   parse_accepted_exclusions() -> the one fenced `json` block under
#                                  `## Accepted exclusions (machine-readable)` in
#                                  `38.5-ART-SIGNOFF.md`, fully validated
#   load_constants()            -> `scripts/art-checker-constants.json` (colours and
#                                  opacities, synced to TS by
#                                  src/theme/art-checker-constants.test.ts)
#
# FEATURE ALLOWANCE (D-20; the M-4 union semantics, defined once here):
#   A variant's optional `featureAllowance: { maxComponentPx, maxFailingPct,
#   acceptedAt }` is owner-signed at the 38.5 art sign-off. It applies to the
#   UNION, per variant: the checker unions every foreground token's failure mask
#   (every accent, bare and card/chrome sections); the extrema script unions
#   every regime's out-of-bound mask (card, chrome, veil at every density, and
#   any regime added later). A pixel in several masks counts ONCE; disjoint masks
#   that each fit alone can fail together. The variant passes only when every
#   8-connected component of that union is <= maxComponentPx pixels AND the
#   union covers <= maxFailingPct percent of the canvas. With no allowance, any
#   failing or out-of-bound pixel fails.
#
# EXCLUSION RECORD SCHEMA (C2-M2; used unchanged by 38.5-04/05/09):
#   exclusions[]: {
#     "id":           "X-<n>", required, unique (a bold **X-<n>** prose row in
#                     38.5-ART-SIGNOFF.md names it),
#     "slotId":       a background slot id,
#     "mode":         "dark" | "light",
#     "tokens":       non-empty list of EXCLUSION_TOKENS, or "accentText" (every
#                     accent) or "accentText:<accentId>" (one curated accent),
#     "treatments":   non-empty subset of TREATMENTS; names "card" and "chrome"
#                     together or neither (C3-L3),
#     "region":       { x, y, w, h } integer image px, w/h > 0    } exactly
#     "feature":      non-empty text (the whole variant)          } one of
#                     a "region" record may name only bare/card/chrome; a record
#                     naming listEntry/cardEntry/artChrome must use "feature"
#                     (C3-M1),
#     "reason":       non-empty text,
#     "ownerApproved":"YYYY-MM-DD"
#   }  (unknown keys rejected)
#   allowances[]: { "slotId", "mode", "maxComponentPx" (int >= 1),
#     "maxFailingPct" (0 < p <= 100), "acceptedAt" ("YYYY-MM-DD") }, at most one
#     per slotId x mode (unknown keys rejected).
#
# An exclusion never narrows a declared bound: measure-background-extrema.py
# ignores exclusions, and the checker's `textBearingBound` counts excluded pixels
# as text-bearing.

import datetime
import json
import os
import re

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKGROUNDS_TS = os.path.join(REPO_ROOT, "src", "theme", "backgrounds.ts")
CONSTANTS_JSON = os.path.join(REPO_ROOT, "scripts", "art-checker-constants.json")

MODES = ("light", "dark")
PACKAGES = ("galaxy", "standard")

ACCEPTED_EXCLUSIONS_HEADING = "## Accepted exclusions (machine-readable)"

# The palette keys an exclusion may name (the checker's token names). accentText
# additionally accepts `accentText` (every accent) and `accentText:<accentId>`.
EXCLUSION_TOKENS = (
    "textPrimary",
    "textSecondary",
    "textPlaceholder",
    "danger",
    "statusStable",
    "statusWobble",
    "statusDecay",
    "rogue",
)
TREATMENTS = ("bare", "card", "chrome", "listEntry", "cardEntry", "artChrome")
# Treatments a checker section can enforce a region for (C3-M1).
REGION_TREATMENTS = ("bare", "card", "chrome")

EXCLUSION_KEYS = {
    "id",
    "slotId",
    "mode",
    "tokens",
    "treatments",
    "region",
    "feature",
    "reason",
    "ownerApproved",
}
ALLOWANCE_KEYS = {"slotId", "mode", "maxComponentPx", "maxFailingPct", "acceptedAt"}
FEATURE_ALLOWANCE_KEYS = {"maxComponentPx", "maxFailingPct", "acceptedAt"}

# ---- C2-L3 shared allowance fixture ------------------------------------------
# One synthetic Galaxy Dark image both self-tests build: the checker derives its
# `textBearingBound` and asserts it equals `expectedBound`; the extrema script
# declares `expectedBound` with `allowance` and asserts `--check` passes. The two
# scripts evaluate different masks (per-token contrast vs. enclosure of the
# declared bound), so this proves consistency by construction on this image,
# not a shared verdict on arbitrary images. Colours are RGB triples.
ALLOWANCE_FIXTURE = {
    "package": "galaxy",
    "mode": "dark",
    "size": (120, 80),  # width, height
    # left half / right half base tones (both well inside the Galaxy Dark band)
    "baseLeft": (5, 5, 5),
    "baseRight": (10, 10, 18),
    # isolated bright specks (x, y, w, h), each failing every bare foreground
    "specks": [(10, 10, 3, 3), (90, 50, 2, 2)],
    "speckColor": (255, 255, 255),
    "allowance": {"maxComponentPx": 9, "maxFailingPct": 0.2, "acceptedAt": "2026-01-01"},
    "expectedBound": {"darkest": (5, 5, 5), "brightest": (10, 10, 18)},
}


class ParseError(ValueError):
    """backgrounds.ts, the constants JSON or an ART-SIGNOFF block is malformed."""


# ---- backgrounds.ts ----------------------------------------------------------
# BACKGROUND_SLOTS layout (fixed for this parser): slot key at 2 spaces;
# `package:` and `variants: {` at 4; `light: {` / `dark: {` at 6; `source` /
# `brightestPixel` / `darkestPixel` / optional `featureAllowance` at 8.
SLOT_RE = re.compile(r'^  "([a-z0-9-]+)": \{\n(.*?)\n  \},?$', re.M | re.S)
VARIANT_RE = re.compile(r"^      (light|dark): \{\n(.*?)\n      \},?$", re.M | re.S)
FEATURE_ALLOWANCE_RE = re.compile(r"^        featureAllowance: \{(.*?)\},?[ \t]*$", re.M | re.S)
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _is_date(value):
    if not isinstance(value, str) or not DATE_RE.match(value):
        return False
    try:
        datetime.date.fromisoformat(value)
    except ValueError:
        return False
    return True


def _is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def validate_allowance_fields(obj, label):
    """Validate maxComponentPx / maxFailingPct / acceptedAt of one allowance."""
    if not _is_int(obj.get("maxComponentPx")) or obj["maxComponentPx"] < 1:
        raise ParseError(f"{label}: maxComponentPx must be an integer >= 1")
    pct = obj.get("maxFailingPct")
    if not _is_number(pct) or not (0 < pct <= 100):
        raise ParseError(f"{label}: maxFailingPct must be a number in (0, 100]")
    if not _is_date(obj.get("acceptedAt")):
        raise ParseError(f"{label}: acceptedAt must be a YYYY-MM-DD date")


def _parse_feature_allowance(vbody, label):
    matches = FEATURE_ALLOWANCE_RE.findall(vbody)
    if not matches:
        if re.search(r"featureAllowance", vbody):
            raise ParseError(f"{label}: featureAllowance not in the fixed layout")
        return None
    if len(matches) > 1:
        raise ParseError(f"{label}: more than one featureAllowance")
    obj = {}
    for part in re.split(r"[,\n]", matches[0]):
        part = part.strip()
        if not part:
            continue
        m = re.fullmatch(r'([A-Za-z]+):\s*(?:"([^"]*)"|([-+0-9.eE]+))', part)
        if not m:
            raise ParseError(f"{label}: featureAllowance field {part!r} is not parseable")
        name = m.group(1)
        if name in obj:
            raise ParseError(f"{label}: featureAllowance repeats {name}")
        if m.group(2) is not None:
            obj[name] = m.group(2)
        else:
            text = m.group(3)
            obj[name] = int(text) if re.fullmatch(r"[-+]?\d+", text) else float(text)
    unknown = set(obj) - FEATURE_ALLOWANCE_KEYS
    if unknown:
        raise ParseError(f"{label}: featureAllowance unknown key(s) {sorted(unknown)}")
    missing = FEATURE_ALLOWANCE_KEYS - set(obj)
    if missing:
        raise ParseError(f"{label}: featureAllowance missing {sorted(missing)}")
    validate_allowance_fields(obj, f"{label} featureAllowance")
    return obj


def strip_ts_comments(text):
    """`text` without its `/* ... */` blocks and `//` line comments (code review IN-04).

    The variant fields are read with first-match searches, so a comment that
    quotes a field (the Starfield blocks discuss the checker's old bounds) must
    never be taken for the declaration. A `//` counts as a comment only at the
    start of a line or after whitespace, so a `//` inside a quoted string with
    no space before it (a URL) is kept. The backgrounds manifest has neither.
    """
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"(^|\s)//[^\n]*", r"\1", text)


def parse_slot_source(source, base_dir):
    """Parse the nested BACKGROUND_SLOTS layout into one record per (slot, mode).

    Record keys: slot, mode, package, asset, brightestPixel, darkestPixel,
    featureAllowance (None or {maxComponentPx, maxFailingPct, acceptedAt}).
    Raises ParseError when a slot lacks either variant block, a variant lacks its
    require / brightestPixel / darkestPixel, or a featureAllowance is malformed.
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
            # Match the declarations, never a comment that quotes one (IN-04).
            vbody = strip_ts_comments(vbody)
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
                    "featureAllowance": _parse_feature_allowance(vbody, f"{slot_id}/{mode}"),
                }
            )
    return rows


def parse_manifest(source=None, base_dir=None):
    """Every (slot, mode) variant of BACKGROUND_SLOTS.

    `source` defaults to the text of src/theme/backgrounds.ts and `base_dir` to
    its directory. Raises ParseError (callers exit 2) on a malformed manifest or
    when no slot parses.
    """
    if source is None:
        try:
            with open(BACKGROUNDS_TS, encoding="utf-8") as fh:
                source = fh.read()
        except OSError as err:
            raise ParseError(str(err)) from err
    if base_dir is None:
        base_dir = os.path.dirname(BACKGROUNDS_TS)
    rows = parse_slot_source(source, base_dir)
    if not rows:
        raise ParseError("no BACKGROUND_SLOTS entries parsed")
    return rows


# ---- art-checker-constants.json ----------------------------------------------
def load_constants(path=CONSTANTS_JSON):
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError) as err:
        raise ParseError(f"{path}: {err}") from err
    for section in ("veil", "surface", "card", "bare", "accentText", "standardLightGlass", "floors"):
        if section not in data:
            raise ParseError(f"{path}: missing section {section!r}")
    return data


def accent_ids(constants=None):
    constants = constants or load_constants()
    ids = set()
    for table in constants["accentText"].values():
        ids.update(table.keys())
    return sorted(ids)


# ---- 38.5-ART-SIGNOFF.md accepted exclusions ---------------------------------
def _extract_block(text):
    lines = text.splitlines()
    heads = [i for i, line in enumerate(lines) if line.strip() == ACCEPTED_EXCLUSIONS_HEADING]
    if not heads:
        raise ParseError(f"no {ACCEPTED_EXCLUSIONS_HEADING!r} heading")
    if len(heads) > 1:
        raise ParseError(f"duplicated {ACCEPTED_EXCLUSIONS_HEADING!r} heading")
    start = heads[0] + 1
    end = len(lines)
    for i in range(start, len(lines)):
        if re.match(r"^#{1,2} ", lines[i]):
            end = i
            break
    section = lines[start:end]
    blocks = []
    i = 0
    while i < len(section):
        if section[i].strip().startswith("```"):
            fence_info = section[i].strip()[3:].strip()
            j = i + 1
            while j < len(section) and not section[j].strip().startswith("```"):
                j += 1
            if j >= len(section):
                raise ParseError("unterminated fenced block under the exclusions heading")
            blocks.append((fence_info, "\n".join(section[i + 1 : j])))
            i = j + 1
        else:
            i += 1
    json_blocks = [body for info, body in blocks if info == "json"]
    if not json_blocks:
        raise ParseError("no fenced ```json block under the exclusions heading")
    if len(json_blocks) > 1:
        raise ParseError("more than one fenced ```json block under the exclusions heading")
    return json_blocks[0]


def _validate_exclusion(rec, idx, accents):
    label = f"exclusions[{idx}]"
    if not isinstance(rec, dict):
        raise ParseError(f"{label}: not an object")
    unknown = set(rec) - EXCLUSION_KEYS
    if unknown:
        raise ParseError(f"{label}: unknown key(s) {sorted(unknown)}")
    rid = rec.get("id")
    if not isinstance(rid, str) or not re.fullmatch(r"X-[1-9]\d*", rid):
        raise ParseError(f"{label}: id must be present and of the form X-<n>")
    label = f"exclusion {rid}"
    slot = rec.get("slotId")
    if not isinstance(slot, str) or not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slot):
        raise ParseError(f"{label}: slotId must be a slot id")
    if rec.get("mode") not in ("dark", "light"):
        raise ParseError(f"{label}: mode must be dark or light")
    tokens = rec.get("tokens")
    if not isinstance(tokens, list) or not tokens:
        raise ParseError(f"{label}: tokens must be a non-empty list")
    for tok in tokens:
        ok = tok in EXCLUSION_TOKENS or tok == "accentText"
        if isinstance(tok, str) and tok.startswith("accentText:"):
            ok = tok.split(":", 1)[1] in accents
        if not ok:
            raise ParseError(f"{label}: unknown token {tok!r}")
    treatments = rec.get("treatments")
    if not isinstance(treatments, list) or not treatments:
        raise ParseError(f"{label}: treatments must be a non-empty list")
    for t in treatments:
        if t not in TREATMENTS:
            raise ParseError(f"{label}: unknown treatment {t!r}")
    if len(set(treatments)) != len(treatments):
        raise ParseError(f"{label}: repeated treatment")
    if ("card" in treatments) != ("chrome" in treatments):
        raise ParseError(f"{label}: treatments must name card and chrome together or neither (C3-L3)")
    has_region = "region" in rec
    has_feature = "feature" in rec
    if has_region == has_feature:
        raise ParseError(f"{label}: exactly one of region or feature is required")
    if has_region:
        region = rec["region"]
        if not isinstance(region, dict) or set(region) != {"x", "y", "w", "h"}:
            raise ParseError(f"{label}: region must be {{x, y, w, h}}")
        if not all(_is_int(region[k]) for k in ("x", "y", "w", "h")):
            raise ParseError(f"{label}: region values must be integers")
        if region["x"] < 0 or region["y"] < 0 or region["w"] <= 0 or region["h"] <= 0:
            raise ParseError(f"{label}: region needs x, y >= 0 and w, h > 0")
        extra = [t for t in treatments if t not in REGION_TREATMENTS]
        if extra:
            raise ParseError(
                f"{label}: a region record may name only bare/card/chrome; {extra} need a feature (C3-M1)"
            )
    else:
        feature = rec["feature"]
        if not isinstance(feature, str) or not feature.strip():
            raise ParseError(f"{label}: feature must be non-empty text")
    reason = rec.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise ParseError(f"{label}: reason must be non-empty text")
    if not _is_date(rec.get("ownerApproved")):
        raise ParseError(f"{label}: ownerApproved must be a YYYY-MM-DD date")


def _validate_allowance(rec, idx):
    label = f"allowances[{idx}]"
    if not isinstance(rec, dict):
        raise ParseError(f"{label}: not an object")
    unknown = set(rec) - ALLOWANCE_KEYS
    if unknown:
        raise ParseError(f"{label}: unknown key(s) {sorted(unknown)}")
    missing = ALLOWANCE_KEYS - set(rec)
    if missing:
        raise ParseError(f"{label}: missing {sorted(missing)}")
    if not isinstance(rec["slotId"], str) or not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", rec["slotId"]):
        raise ParseError(f"{label}: slotId must be a slot id")
    if rec["mode"] not in ("dark", "light"):
        raise ParseError(f"{label}: mode must be dark or light")
    validate_allowance_fields(rec, label)


def parse_accepted_exclusions_text(text, accents=None):
    """Parse + validate the accepted-exclusions block from markdown text."""
    if accents is None:
        accents = accent_ids()
    body = _extract_block(text)
    try:
        data = json.loads(body)
    except ValueError as err:
        raise ParseError(f"malformed exclusions JSON: {err}") from err
    if not isinstance(data, dict) or set(data) != {"allowances", "exclusions"}:
        raise ParseError('the block must be { "allowances": [...], "exclusions": [...] }')
    if not isinstance(data["allowances"], list) or not isinstance(data["exclusions"], list):
        raise ParseError("allowances and exclusions must be lists")
    seen = set()
    for idx, rec in enumerate(data["exclusions"]):
        _validate_exclusion(rec, idx, accents)
        if rec["id"] in seen:
            raise ParseError(f"exclusion {rec['id']}: duplicated id")
        seen.add(rec["id"])
    pairs = set()
    for idx, rec in enumerate(data["allowances"]):
        _validate_allowance(rec, idx)
        pair = (rec["slotId"], rec["mode"])
        if pair in pairs:
            raise ParseError(f"allowances[{idx}]: a second allowance for {pair[0]}/{pair[1]}")
        pairs.add(pair)
    return data


def parse_accepted_exclusions(md_path, accents=None):
    """Parse + validate the accepted-exclusions block of an ART-SIGNOFF markdown."""
    try:
        with open(md_path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError as err:
        raise ParseError(str(err)) from err
    return parse_accepted_exclusions_text(text, accents)
