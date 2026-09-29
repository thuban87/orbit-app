#!/usr/bin/env tsx
/**
 * Re-sign-off candidate ladders (38.5-07 Task 1; owner rulings D-06, D-08, D-09,
 * D-13, D-18, D-27). DEV tooling, not app code. Read-only over `src/`.
 *
 * What it does:
 *   1. Builds the MAPPED v2 table: the owner's raw v2 answers
 *      (`38.5-scrim-signoff-v2.json`) with correction (a) (Galaxy Dark · Deep
 *      Space List = transparent) and correction (b) (Standard Light · Paper stays
 *      full, i.e. the raw value is kept), the Mesh rows dropped (D-18), and the
 *      v2 Galaxy art values carried to the new quiet / Aurora / Starfield slots
 *      (every v2 Galaxy art row within a mode is identical after (a), which this
 *      script asserts before carrying).
 *   2. For every package × mode × opacity group (`listEntry`, `cardEntry`,
 *      `artChrome`) with a transparent cell in the mapped table, computes a
 *      candidate ladder with the app's own palettes, accents, glass-foreground
 *      resolver, background extrema and contrast helpers:
 *        - minSafe   the smallest opacity (0.00–1.00, 0.01 steps) at which every
 *                    foreground clears BOTH declared extrema with the interval
 *                    rule (the surface.test.ts harness semantics), for the
 *                    default and all 8 accents, over `surface` tint composited on
 *                    every background of that package × mode where the group is
 *                    transparent (the solid background colour for None);
 *        - precedent the value D-09 names (Galaxy Dark's card transparency) or
 *                    today's value (see `precedentFor`), or null;
 *        - midpoint  between minSafe and the full value, rounded to 0.05;
 *        - cardBlend for groups already see-through today (Galaxy Dark cards,
 *                    Standard Light cards): minSafe when it is below today's
 *                    value, else a note.
 *      Every number is COMPUTED. The rung rule is a selection aid, not a
 *      recommendation (D-06): the owner picks.
 *
 * Usage:
 *   npx tsx scripts/dev/art-signoff-candidates.ts --out <candidates.json>
 *   npx tsx scripts/dev/art-signoff-candidates.ts --check-value <pkg-mode> <group> <opacity>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { applyAccent, resolveAccent } from "../../src/theme/accents";
import {
  BACKGROUND_ORDER,
  BACKGROUND_SLOTS,
  NONE_SLOT_ID,
} from "../../src/theme/backgrounds";
import {
  AA_LARGE,
  AA_NORMAL,
  contrastRatio,
  relativeLuminance,
} from "../../src/theme/contrast";
import { resolveGlassForegroundPalette } from "../../src/theme/glass-foregrounds";
import { ACCENT_IDS, type AccentId } from "../../src/theme/theme-option-ids";
import { resolvePalette } from "../../src/theme/theme-presets";
import type {
  ResolvedMode,
  ThemePackage,
  ThemePalette,
} from "../../src/theme/theme-types";
import {
  ART_SEE_THROUGH_OPACITY,
  type ArtOpacityGroup,
  alphaComposite,
  CARD_GLASS_OPACITY,
  SURFACE,
} from "../../src/theme/tokens/surface";

const V2_PATH =
  ".planning/phases/38.5-background-art-text-contrast/38.5-scrim-signoff-v2.json";

const COMPONENTS = [
  "contactsListEntries",
  "contactsCardEntries",
  "contactsTopButtons",
  "contactsSearchAndToggle",
  "contactsCountLabel",
  "contactsHeader",
  "digestHeader",
  "digestSectionHeadings",
  "digestUpNextItems",
  "digestHorizonItems",
  "digestYourWeek",
] as const;
type Component = (typeof COMPONENTS)[number];
type V2Value = "full" | "transparent" | "none";

const PACKAGES: readonly ThemePackage[] = ["galaxy", "standard"];
const MODES: readonly ResolvedMode[] = ["light", "dark"];
const GROUPS: readonly ArtOpacityGroup[] = [
  "listEntry",
  "cardEntry",
  "artChrome",
];

const GROUP_COMPONENTS: Record<ArtOpacityGroup, readonly Component[]> = {
  listEntry: ["contactsListEntries"],
  cardEntry: ["contactsCardEntries"],
  artChrome: ["contactsCountLabel", "contactsHeader", "digestHeader"],
};

/** The new lineup's short background keys per package (slot id minus prefix). */
function bgKeys(pkg: ThemePackage): string[] {
  return BACKGROUND_ORDER[pkg].map((id) =>
    id === NONE_SLOT_ID ? NONE_SLOT_ID : id.replace(/^(galaxy|standard)-/, ""),
  );
}

// ---------------------------------------------------------------------------
// 1. The mapped v2 table
// ---------------------------------------------------------------------------

interface MappedRow {
  theme: ThemePackage;
  mode: ResolvedMode;
  bg: string;
  cells: Record<Component, V2Value>;
  /** Where the row's values came from, for the page and the record. */
  source: string;
  note: string;
}

function buildMappedV2(): Record<string, MappedRow> {
  const raw = JSON.parse(readFileSync(V2_PATH, "utf8")) as {
    combos: Record<string, Record<string, unknown>>;
  };
  const combos = raw.combos;
  const pick = (key: string): Record<Component, V2Value> => {
    const row = combos[key];
    if (!row) throw new Error(`v2 has no ${key}`);
    const out = {} as Record<Component, V2Value>;
    for (const c of COMPONENTS) out[c] = row[c] as V2Value;
    return out;
  };
  // Correction (a): Galaxy Dark · Deep Space List was a fluke "full".
  const corrected = (key: string): Record<Component, V2Value> => {
    const cells = pick(key);
    if (key === "galaxy-dark-deep-space")
      cells.contactsListEntries = "transparent";
    return cells;
  };
  const note = (key: string) => String(combos[key]?.note ?? "");

  const out: Record<string, MappedRow> = {};
  const galaxyArtV2 = ["deep-space", "starfield", "nebula", "aurora"];
  for (const mode of MODES) {
    // Carry the Galaxy art row: assert every v2 Galaxy art row in this mode agrees.
    const rows = galaxyArtV2.map((bg) => corrected(`galaxy-${mode}-${bg}`));
    for (const r of rows) {
      for (const c of COMPONENTS) {
        if (r[c] !== rows[0][c]) {
          throw new Error(
            `v2 Galaxy ${mode} art rows disagree on ${c}; cannot carry to the new slots`,
          );
        }
      }
    }
    for (const bg of bgKeys("galaxy")) {
      const key = `galaxy-${mode}-${bg}`;
      if (bg === NONE_SLOT_ID) {
        out[key] = {
          theme: "galaxy",
          mode,
          bg,
          cells: pick(key),
          source: `v2 ${key}`,
          note: note(key),
        };
      } else {
        out[key] = {
          theme: "galaxy",
          mode,
          bg,
          cells: { ...rows[0] },
          source: `v2 Galaxy ${mode} art rows (Deep Space, Starfield, Nebula, Aurora; identical after correction (a)) carried to the new ${bg} slot`,
          note: note(`galaxy-${mode}-aurora`),
        };
      }
    }
    // Standard keeps Dawn, Paper, Dusk, None by name; Mesh is dropped (D-18).
    for (const bg of bgKeys("standard")) {
      const key = `standard-${mode}-${bg}`;
      out[key] = {
        theme: "standard",
        mode,
        bg,
        cells: pick(key),
        source:
          key === "standard-light-paper"
            ? `v2 ${key} (correction (b): full List and Card are intentional)`
            : `v2 ${key}`,
        note: note(key),
      };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Contrast (mirrors src/theme/tokens/surface.test.ts)
// ---------------------------------------------------------------------------

const STATUS_FGS = [
  "statusStable",
  "statusWobble",
  "statusDecay",
  "rogue",
] as const;

/** Foregrounds a see-through component shows, with their floors. */
const FOREGROUNDS: readonly { token: keyof ThemePalette; floor: number }[] = [
  { token: "textPrimary", floor: AA_NORMAL },
  { token: "textSecondary", floor: AA_NORMAL },
  { token: "danger", floor: AA_NORMAL },
  ...STATUS_FGS.map((token) => ({ token, floor: AA_LARGE })),
];

/** ADR-084 E-1: Galaxy Dark danger is an owner-accepted limitation (card + chrome). */
function excluded(
  token: keyof ThemePalette,
  pkg: ThemePackage,
  mode: ResolvedMode,
) {
  return token === "danger" && pkg === "galaxy" && mode === "dark";
}

/** The palette a scoped see-through component renders with (the glass scope). */
function effectivePalette(
  pkg: ThemePackage,
  mode: ResolvedMode,
  accentId: AccentId | null,
  backgroundIsAsset: boolean,
): ThemePalette {
  const palette = applyAccent(
    resolvePalette(pkg, mode),
    resolveAccent(accentId, pkg, mode),
  );
  return (
    resolveGlassForegroundPalette({
      palette,
      package: pkg,
      mode,
      accentId,
      backgroundIsAsset,
    }) ?? palette
  );
}

interface Bounds {
  bg: string;
  darkest: string;
  brightest: string;
  isAsset: boolean;
}

function boundsFor(pkg: ThemePackage, mode: ResolvedMode, bg: string): Bounds {
  if (bg === NONE_SLOT_ID) {
    const solid = resolvePalette(pkg, mode).background;
    return { bg, darkest: solid, brightest: solid, isAsset: false };
  }
  const slot =
    BACKGROUND_SLOTS[`${pkg}-${bg}` as keyof typeof BACKGROUND_SLOTS];
  const v = slot.variants[mode];
  return {
    bg,
    darkest: v.darkestPixel,
    brightest: v.brightestPixel,
    isAsset: true,
  };
}

interface Failure {
  bg: string;
  token: string;
  accent: string | null;
  ratioDark: number;
  ratioBright: number;
  outside: boolean;
  floor: number;
}

function evaluate(
  fg: string,
  tint: string,
  opacity: number,
  b: Bounds,
  floor: number,
) {
  const dark = alphaComposite(tint, b.darkest, opacity);
  const bright = alphaComposite(tint, b.brightest, opacity);
  const lf = relativeLuminance(fg);
  const la = relativeLuminance(dark);
  const lb = relativeLuminance(bright);
  const ratioDark = contrastRatio(fg, dark);
  const ratioBright = contrastRatio(fg, bright);
  const outside = lf < Math.min(la, lb) || lf > Math.max(la, lb);
  return {
    ok: ratioDark >= floor && ratioBright >= floor && outside,
    ratioDark,
    ratioBright,
    outside,
  };
}

/** Every failure at one opacity over the given backgrounds ([] = contrast-safe). */
function failuresAt(
  pkg: ThemePackage,
  mode: ResolvedMode,
  bgs: readonly string[],
  opacity: number,
): Failure[] {
  const out: Failure[] = [];
  for (const bg of bgs) {
    const b = boundsFor(pkg, mode, bg);
    const base = effectivePalette(pkg, mode, null, b.isAsset);
    const tint = base[SURFACE[pkg].tintTokenKey];
    for (const { token, floor } of FOREGROUNDS) {
      if (excluded(token, pkg, mode)) continue;
      const e = evaluate(base[token] as string, tint, opacity, b, floor);
      if (!e.ok) out.push({ bg, token, accent: null, floor, ...e });
    }
    for (const accentId of [null, ...ACCENT_IDS] as (AccentId | null)[]) {
      const p = effectivePalette(pkg, mode, accentId, b.isAsset);
      const e = evaluate(
        p.accentText,
        p[SURFACE[pkg].tintTokenKey],
        opacity,
        b,
        AA_NORMAL,
      );
      if (!e.ok) {
        out.push({
          bg,
          token: "accentText",
          accent: accentId ?? "default",
          floor: AA_NORMAL,
          ...e,
        });
      }
    }
  }
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round05 = (n: number) => Math.round(n * 20) / 20;

function fullValue(pkg: ThemePackage, group: ArtOpacityGroup): number {
  return group === "listEntry" ? 1 : SURFACE[pkg].densityOpacity.dense;
}

function minSafe(
  pkg: ThemePackage,
  mode: ResolvedMode,
  bgs: readonly string[],
) {
  for (let i = 0; i <= 100; i++) {
    const o = round2(i / 100);
    if (failuresAt(pkg, mode, bgs, o).length === 0) return o;
  }
  return null;
}

/** The ladder's precedent rung and where it comes from (plan 07 Task 1 (2)). */
function precedentFor(
  pkg: ThemePackage,
  mode: ResolvedMode,
  group: ArtOpacityGroup,
): { value: number | null; source: string } {
  const entry = group === "listEntry" || group === "cardEntry";
  if (
    entry &&
    ((pkg === "galaxy" && mode === "light") ||
      (pkg === "standard" && mode === "dark"))
  ) {
    return {
      value: CARD_GLASS_OPACITY.galaxy,
      source:
        "D-09 'like Galaxy Dark's card transparency' (CARD_GLASS_OPACITY.galaxy)",
    };
  }
  if (group === "listEntry" && pkg === "galaxy" && mode === "dark") {
    return {
      value: CARD_GLASS_OPACITY.galaxy,
      source: "the Galaxy Dark card value (CARD_GLASS_OPACITY.galaxy)",
    };
  }
  if (group === "listEntry" && pkg === "standard" && mode === "light") {
    return {
      value: CARD_GLASS_OPACITY.standard,
      source: "the Standard Light card value (CARD_GLASS_OPACITY.standard)",
    };
  }
  const today = ART_SEE_THROUGH_OPACITY[pkg][mode][group];
  if (today !== null) {
    return {
      value: today,
      source: "today's shipped see-through value (ART_SEE_THROUGH_OPACITY)",
    };
  }
  return {
    value: null,
    source: "none: today this component is full in this package × mode",
  };
}

interface Ladder {
  pkgMode: string;
  group: ArtOpacityGroup;
  components: readonly Component[];
  transparentOn: string[];
  signedToday: number | null;
  needsOwnerValue: boolean;
  full: { value: number; label: string };
  minSafe: {
    value: number | null;
    label: string;
    failuresAtPrecedent?: Failure[];
  };
  precedent: { value: number | null; source: string; label: string };
  midpoint: { value: number | null; label: string };
  baseRung: "precedent" | "midpoint" | "today";
  baseValue: number | null;
  cardBlend?: { value: number | null; label: string; note: string };
}

function buildLadders(mapped: Record<string, MappedRow>): Ladder[] {
  const ladders: Ladder[] = [];
  for (const pkg of PACKAGES) {
    for (const mode of MODES) {
      for (const group of GROUPS) {
        const comps = GROUP_COMPONENTS[group];
        const transparentOn = bgKeys(pkg).filter((bg) =>
          comps.some(
            (c) => mapped[`${pkg}-${mode}-${bg}`].cells[c] === "transparent",
          ),
        );
        if (transparentOn.length === 0) continue;
        const signedToday = ART_SEE_THROUGH_OPACITY[pkg][mode][group];
        const full = fullValue(pkg, group);
        const ms = minSafe(pkg, mode, transparentOn);
        const prec = precedentFor(pkg, mode, group);
        const mid = ms === null ? null : round05((ms + full) / 2);
        const ladder: Ladder = {
          pkgMode: `${pkg}-${mode}`,
          group,
          components: comps,
          transparentOn,
          signedToday,
          needsOwnerValue: signedToday === null,
          full: { value: full, label: "COMPUTED (today's full value)" },
          minSafe: {
            value: ms,
            label:
              "COMPUTED (minimum contrast-safe opacity; computed aid, not a recommendation, D-06)",
          },
          precedent: { ...prec, label: "COMPUTED (value named by the rule)" },
          midpoint: {
            value: mid,
            label: "COMPUTED (midpoint of minSafe and full, rounded to 0.05)",
          },
          baseRung:
            signedToday !== null
              ? "today"
              : prec.value !== null
                ? "precedent"
                : "midpoint",
          baseValue: signedToday ?? prec.value ?? mid,
        };
        if (prec.value !== null) {
          const f = failuresAt(pkg, mode, transparentOn, prec.value);
          if (f.length) ladder.minSafe.failuresAtPrecedent = f;
        }
        if (group === "cardEntry" && signedToday !== null) {
          ladder.cardBlend =
            ms !== null && ms < signedToday
              ? {
                  value: ms,
                  label:
                    "COMPUTED (card-blend rung = minSafe, below today's value)",
                  note: `more see-through than today's ${signedToday}`,
                }
              : {
                  value: null,
                  label: "COMPUTED",
                  note: `no more-see-through value than today's ${signedToday} clears contrast (minSafe ${ms})`,
                };
        }
        ladders.push(ladder);
      }
    }
  }
  return ladders;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv: string[]) {
  const mapped = buildMappedV2();
  const ci = argv.indexOf("--check-value");
  if (ci >= 0) {
    const [pkgMode, group, value] = argv.slice(ci + 1);
    const [pkg, mode] = pkgMode.split("-") as [ThemePackage, ResolvedMode];
    const opacity = Number(value);
    if (
      !PACKAGES.includes(pkg) ||
      !MODES.includes(mode) ||
      !GROUPS.includes(group as ArtOpacityGroup) ||
      !(opacity >= 0 && opacity <= 1)
    ) {
      throw new Error(
        "usage: --check-value <galaxy|standard>-<light|dark> <listEntry|cardEntry|artChrome> <0..1>",
      );
    }
    const bgs = bgKeys(pkg).filter((bg) =>
      GROUP_COMPONENTS[group as ArtOpacityGroup].some(
        (c) => mapped[`${pkg}-${mode}-${bg}`].cells[c] === "transparent",
      ),
    );
    const failures = failuresAt(
      pkg,
      mode,
      bgs.length ? bgs : bgKeys(pkg),
      opacity,
    );
    process.stdout.write(
      `${JSON.stringify({ pkgMode, group, opacity, backgrounds: bgs, contrastSafe: failures.length === 0, failures, label: "COMPUTED" }, null, 2)}\n`,
    );
    return;
  }
  const oi = argv.indexOf("--out");
  const out = oi >= 0 ? argv[oi + 1] : undefined;
  const result = {
    _meta: {
      what: "38.5-07 re-sign-off candidate ladders and the mapped v2 table. Every number is COMPUTED with the app's own palettes, accents, glass-foreground resolver, declared background extrema and WCAG helpers (both-extrema + interval rule, as surface.test.ts). The rungs are a selection aid, not a recommendation (D-06).",
      foregrounds:
        "textPrimary, textSecondary, danger at 4.5 (Galaxy Dark danger excluded, ADR-084 E-1); statusStable, statusWobble, statusDecay, rogue at 3.0; accentText at 4.5 for the package default and all 8 accents",
      palette:
        "the glass-scope palette (Standard Light over art), the root palette otherwise",
      generated: new Date().toISOString(),
    },
    mappedV2: mapped,
    ladders: buildLadders(mapped),
  };
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (out) writeFileSync(out, text);
  else process.stdout.write(text);
}

main(process.argv.slice(2));
