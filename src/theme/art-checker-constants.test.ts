/**
 * Sync guard: `scripts/art-checker-constants.json` === the TypeScript theme
 * (38.5-03, D-14 / T-38.5-03-01).
 *
 * `scripts/check-background-art.py` (the promoted 38.4 brief `check_art.py`)
 * and `scripts/background_manifest.py` load EVERY colour and opacity they use
 * from that JSON; the Python side holds no colour table of its own. This test
 * rebuilds the same object from the app's own resolvers (`resolvePalette`,
 * `resolveAccent`, `resolveGlassForegroundPalette`, `backgroundVeilOpacity`,
 * `cardTintOpacity`) and asserts deep equality, naming every stale key, so the
 * Python verdict cannot drift from what the app renders.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyAccent, resolveAccent } from "./accents";
import { AA_LARGE, AA_NORMAL } from "./contrast";
import { resolveGlassForegroundPalette } from "./glass-foregrounds";
import { ACCENT_IDS } from "./theme-option-ids";
import { resolvePalette } from "./theme-presets";
import type { ResolvedMode, ThemePackage, ThemePalette } from "./theme-types";
import {
  backgroundVeilOpacity,
  cardTintOpacity,
  SURFACE_DENSITIES,
} from "./tokens/surface";

const CONSTANTS_PATH = "scripts/art-checker-constants.json";

const PAIRS: readonly [ThemePackage, ResolvedMode][] = [
  ["galaxy", "dark"],
  ["galaxy", "light"],
  ["standard", "dark"],
  ["standard", "light"],
];

/** Bare foregrounds, in the checker's order: text at 4.5, glyphs at 3.0. */
const BARE_TOKENS: readonly { token: keyof ThemePalette; floor: number }[] = [
  { token: "textPrimary", floor: AA_NORMAL },
  { token: "textSecondary", floor: AA_NORMAL },
  { token: "textPlaceholder", floor: AA_NORMAL },
  { token: "danger", floor: AA_NORMAL },
  { token: "statusStable", floor: AA_LARGE },
  { token: "statusWobble", floor: AA_LARGE },
  { token: "statusDecay", floor: AA_LARGE },
  { token: "rogue", floor: AA_LARGE },
];

/**
 * The foregrounds the card/chrome proof asserts over glass (surface.test.ts:
 * TEXT_FGS + danger + STATUS_FGS). In Standard Light over an asset these come
 * from the glass-scoped palette.
 */
const GLASS_TOKENS: readonly { token: keyof ThemePalette; floor: number }[] = [
  { token: "textPrimary", floor: AA_NORMAL },
  { token: "textSecondary", floor: AA_NORMAL },
  { token: "danger", floor: AA_NORMAL },
  { token: "statusStable", floor: AA_LARGE },
  { token: "statusWobble", floor: AA_LARGE },
  { token: "statusDecay", floor: AA_LARGE },
  { token: "rogue", floor: AA_LARGE },
];

function key(pkg: ThemePackage, mode: ResolvedMode): string {
  return `${pkg}-${mode}`;
}

function buildExpected(): Record<string, unknown> {
  const veil: Record<string, Record<string, number>> = {};
  const surface: Record<string, string> = {};
  const card: Record<string, number> = {};
  const bare: Record<string, { token: string; hex: string; floor: number }[]> =
    {};
  const accentText: Record<string, Record<string, string>> = {};
  for (const [pkg, mode] of PAIRS) {
    const k = key(pkg, mode);
    const palette = resolvePalette(pkg, mode);
    veil[k] = Object.fromEntries(
      SURFACE_DENSITIES.map((d) => [d, backgroundVeilOpacity(pkg, d)]),
    );
    surface[k] = palette.surface;
    card[k] = cardTintOpacity(pkg, mode, "presentation");
    bare[k] = BARE_TOKENS.map(({ token, floor }) => ({
      token,
      hex: palette[token] as string,
      floor,
    }));
    accentText[k] = Object.fromEntries(
      ACCENT_IDS.map((id) => [id, resolveAccent(id, pkg, mode).text]),
    );
  }

  // Standard Light glass scope (RG-029 D-24/D-26): the palette the card/chrome
  // descendants render with over an asset, per accent.
  const slRoot = (id: (typeof ACCENT_IDS)[number]) =>
    applyAccent(
      resolvePalette("standard", "light"),
      resolveAccent(id, "standard", "light"),
    );
  const slGlass = (id: (typeof ACCENT_IDS)[number]) => {
    const g = resolveGlassForegroundPalette({
      palette: slRoot(id),
      package: "standard",
      mode: "light",
      accentId: id,
      backgroundIsAsset: true,
    });
    if (!g) throw new Error("Standard Light glass scope must be active");
    return g;
  };
  const first = slGlass(ACCENT_IDS[0]);
  const standardLightGlass = {
    tokens: GLASS_TOKENS.map(({ token, floor }) => ({
      token,
      hex: first[token] as string,
      floor,
    })),
    accentText: Object.fromEntries(
      ACCENT_IDS.map((id) => [id, slGlass(id).accentText]),
    ),
  };

  return {
    veil,
    surface,
    card,
    bare,
    accentText,
    standardLightGlass,
    floors: { text: AA_NORMAL, glyph: AA_LARGE },
  };
}

/** Flatten to `path -> leaf` so a mismatch names the exact stale key. */
function flatten(value: unknown, path = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (value !== null && typeof value === "object") {
    const entries = Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>);
    for (const [k, v] of entries) {
      for (const [p, leaf] of flatten(v, path ? `${path}.${k}` : k)) {
        out.set(p, leaf);
      }
    }
    if (entries.length === 0) out.set(path, value);
  } else {
    out.set(path, value);
  }
  return out;
}

describe("art-checker constants sync guard (38.5-03, T-38.5-03-01)", () => {
  const raw = JSON.parse(readFileSync(CONSTANTS_PATH, "utf8")) as Record<
    string,
    unknown
  >;
  const { _comment, ...json } = raw;

  it("documents itself", () => {
    expect(typeof _comment).toBe("string");
  });

  it("every constant equals the value the TS theme resolves (no stale or missing key)", () => {
    const want = flatten(buildExpected());
    const got = flatten(json);
    const problems: string[] = [];
    for (const [path, value] of want) {
      if (!got.has(path)) {
        problems.push(`missing ${path} (want ${JSON.stringify(value)})`);
      } else if (got.get(path) !== value) {
        problems.push(
          `stale ${path}: json ${JSON.stringify(got.get(path))} != ts ${JSON.stringify(value)}`,
        );
      }
    }
    for (const path of got.keys()) {
      if (!want.has(path)) problems.push(`extra ${path}`);
    }
    expect(problems).toEqual([]);
  });

  it("covers all four package x mode pairs and all eight curated accents", () => {
    const j = json as {
      accentText: Record<string, Record<string, string>>;
      standardLightGlass: { accentText: Record<string, string> };
    };
    expect(Object.keys(j.accentText).sort()).toEqual(
      PAIRS.map(([p, m]) => key(p, m)).sort(),
    );
    for (const k of Object.keys(j.accentText)) {
      expect(Object.keys(j.accentText[k]).sort()).toEqual(
        [...ACCENT_IDS].sort(),
      );
    }
    expect(Object.keys(j.standardLightGlass.accentText).sort()).toEqual(
      [...ACCENT_IDS].sort(),
    );
  });
});
