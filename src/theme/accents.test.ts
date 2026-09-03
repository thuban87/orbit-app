import { describe, expect, it } from "vitest";
import { ACCENTS, applyAccent, DEFAULT_ACCENT, resolveAccent } from "./accents";
import { AA_LARGE, AA_NORMAL, contrastRatio } from "./contrast";
import { ACCENT_IDS } from "./theme-option-ids";
import { resolvePalette, THEME_PRESETS } from "./theme-presets";
import type { ResolvedMode, ThemePackage } from "./theme-types";

const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
const MODES: ResolvedMode[] = ["dark", "light"];

// The three palettes AUTHORED in Plan 03 — their required tokens are on the
// HARD-FAIL path (a miss fails the build; fix by retuning the discretion value,
// never by weakening AA). galaxy-dark is the pre-existing owner palette and is
// handled on the FLAG-FOR-OWNER path below.
const NEW_PALETTES: Array<[ThemePackage, ResolvedMode]> = [
  ["galaxy", "light"],
  ["standard", "dark"],
  ["standard", "light"],
];

describe("AA thresholds are unchanged (never weakened to pass a token)", () => {
  it("AA_NORMAL = 4.5 and AA_LARGE = 3.0", () => {
    expect(AA_NORMAL).toBe(4.5);
    expect(AA_LARGE).toBe(3.0);
  });
});

describe("curated accents — HARD-FAIL AA in all four (package, mode) combos", () => {
  for (const id of ACCENT_IDS) {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        const tone = resolveAccent(id, pkg, mode);
        const palette = resolvePalette(pkg, mode);

        it(`${id} @ ${pkg}/${mode}: onAccent vs fill >= AA_NORMAL`, () => {
          expect(
            contrastRatio(tone.onAccent, tone.fill),
          ).toBeGreaterThanOrEqual(AA_NORMAL);
        });

        it(`${id} @ ${pkg}/${mode}: text vs background & surface >= AA_NORMAL`, () => {
          expect(
            contrastRatio(tone.text, palette.background),
          ).toBeGreaterThanOrEqual(AA_NORMAL);
          expect(
            contrastRatio(tone.text, palette.surface),
          ).toBeGreaterThanOrEqual(AA_NORMAL);
        });
      }
    }
  }
});

describe("newly-authored palettes — required tokens HARD-FAIL over real opaque pairs", () => {
  for (const [pkg, mode] of NEW_PALETTES) {
    const p = resolvePalette(pkg, mode);

    it(`${pkg}/${mode}: textPrimary/textSecondary vs bg/surface/elevated >= AA_NORMAL`, () => {
      for (const bg of [p.background, p.surface, p.surfaceElevated] as const) {
        expect(contrastRatio(p.textPrimary, bg)).toBeGreaterThanOrEqual(
          AA_NORMAL,
        );
        expect(contrastRatio(p.textSecondary, bg)).toBeGreaterThanOrEqual(
          AA_NORMAL,
        );
      }
    });

    it(`${pkg}/${mode}: status hues vs bg/surface >= AA_LARGE (glyph/large element)`, () => {
      for (const hue of [
        p.statusStable,
        p.statusWobble,
        p.statusDecay,
        p.rogue,
      ] as const) {
        expect(contrastRatio(hue, p.background)).toBeGreaterThanOrEqual(
          AA_LARGE,
        );
        expect(contrastRatio(hue, p.surface)).toBeGreaterThanOrEqual(AA_LARGE);
      }
    });

    it(`${pkg}/${mode}: danger — onDanger vs fill AND danger-as-text vs surfaces >= AA_NORMAL`, () => {
      // Plan 07's Destructive Button / ConfirmDialog renders onDanger on the
      // danger fill; danger doubles as validation/warning TEXT. Both must clear
      // AA (REVIEWS 23-03 LOW + cycle-4 MEDIUM).
      expect(contrastRatio(p.onDanger, p.danger)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
      for (const bg of [p.background, p.surface, p.surfaceElevated] as const) {
        expect(contrastRatio(p.danger, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    });
  }
});

// ── FLAG-FOR-OWNER path ─────────────────────────────────────────────────────
// The pre-existing galaxy-dark REQUIRED tokens are the owner's approved hues.
// The gate MEASURES them and, on any AA miss, emits an owner-escalation
// diagnostic (token + measured ratio) — it NEVER edits the hue and NEVER weakens
// AA. Because these are owner-bucket, a known miss does not hard-fail the build:
// it is surfaced to the owner (recorded in the SUMMARY). An UNEXPECTED new miss
// changes the escalation set and fails the pinning test loudly.

interface OwnerEscalation {
  token: string;
  pair: string;
  ratio: number;
  threshold: number;
}

/** All pre-existing galaxy-dark required tokens the gate may only FLAG. */
const LEGACY_TEXT = ["textPrimary", "textSecondary"] as const;
const LEGACY_STATUS = [
  "statusStable",
  "statusWobble",
  "statusDecay",
  "rogue",
] as const;

/**
 * READ-ONLY audit: measure every pre-existing galaxy-dark required pair and
 * return the ones below their AA threshold as owner escalations. It returns
 * diagnostics only — it constructs NO new palette and mutates nothing, so it can
 * never "fix" a miss by retuning the owner hue.
 */
function auditLegacyGalaxyDark(
  palette: (typeof THEME_PRESETS)["galaxy"]["dark"],
): OwnerEscalation[] {
  const out: OwnerEscalation[] = [];
  const surfaces = {
    background: palette.background,
    surface: palette.surface,
    surfaceElevated: palette.surfaceElevated,
  };
  const push = (
    token: string,
    pair: string,
    fg: string,
    bg: string,
    th: number,
  ) => {
    const ratio = contrastRatio(fg, bg);
    if (ratio < th) out.push({ token, pair, ratio, threshold: th });
  };
  // Text tokens @ AA_NORMAL vs the three surfaces.
  for (const token of LEGACY_TEXT) {
    for (const [name, bg] of Object.entries(surfaces)) {
      push(token, `${token}/${name}`, palette[token], bg, AA_NORMAL);
    }
  }
  // Status hues @ AA_LARGE vs background/surface (glyph/large element).
  for (const token of LEGACY_STATUS) {
    for (const name of ["background", "surface"] as const) {
      push(token, `${token}/${name}`, palette[token], surfaces[name], AA_LARGE);
    }
  }
  // danger-as-text @ AA_NORMAL vs the three surfaces.
  for (const [name, bg] of Object.entries(surfaces)) {
    push("danger", `danger-text/${name}`, palette.danger, bg, AA_NORMAL);
  }
  // onDanger foreground on the danger fill @ AA_NORMAL.
  push(
    "onDanger",
    "onDanger/danger",
    palette.onDanger,
    palette.danger,
    AA_NORMAL,
  );
  return out;
}

describe("legacy galaxy-dark — FLAG-FOR-OWNER (measured, never auto-retuned)", () => {
  it("a SIMULATED legacy miss emits an owner-escalation diagnostic (token + ratio), mutating nothing", () => {
    // Inject a deliberately-failing textPrimary (merges into the background) to
    // prove the flag mechanism fires with the token + measured ratio and returns
    // a read-only diagnostic — NOT a retuned palette.
    const simulated = {
      ...THEME_PRESETS.galaxy.dark,
      textPrimary: "#0C0F1B", // ~= background, will miss AA badly
    };
    const escalations = auditLegacyGalaxyDark(simulated);
    const flagged = escalations.find((e) => e.token === "textPrimary");
    expect(flagged).toBeDefined();
    expect(flagged?.ratio).toBeLessThan(AA_NORMAL);
    expect(typeof flagged?.ratio).toBe("number");
    // The audit did not edit the owner hue to "fix" the miss.
    expect(simulated.textPrimary).toBe("#0C0F1B");
    expect(THEME_PRESETS.galaxy.dark.textPrimary).toBe("#E6E9F5");
  });

  it("the REAL galaxy-dark escalation set is EXACTLY the two known owner decisions (pinned)", () => {
    // The owner-approved galaxy-dark palette misses AA on precisely two pairs —
    // the destructive `danger`(#E5484D)/onDanger and danger-as-text-on-elevated.
    // These are recorded in the SUMMARY as owner decisions; the executor does NOT
    // retune the owner hue. A NEW/unexpected legacy miss changes this set and
    // fails this test loudly (flagging a fresh owner decision).
    const escalations = auditLegacyGalaxyDark(THEME_PRESETS.galaxy.dark);
    const pairs = escalations.map((e) => e.pair).sort();
    expect(pairs).toEqual(["danger-text/surfaceElevated", "onDanger/danger"]);
    // Both measured ratios are below AA-normal and above AA-large — sanity-pin
    // the magnitudes the SUMMARY reports to the owner.
    const byPair = Object.fromEntries(
      escalations.map((e) => [e.pair, e.ratio]),
    );
    expect(byPair["onDanger/danger"]).toBeGreaterThan(3.8);
    expect(byPair["onDanger/danger"]).toBeLessThan(AA_NORMAL);
    expect(byPair["danger-text/surfaceElevated"]).toBeGreaterThan(3.9);
    expect(byPair["danger-text/surfaceElevated"]).toBeLessThan(AA_NORMAL);
  });

  it("does NOT mutate the owner danger hue and keeps AA thresholds intact", () => {
    expect(THEME_PRESETS.galaxy.dark.danger).toBe("#E5484D");
    expect(AA_NORMAL).toBe(4.5);
    expect(AA_LARGE).toBe(3.0);
  });
});

describe("id drift guard — ACCENTS keys equal ACCENT_IDS exactly (single source)", () => {
  it("every ACCENT_ID resolves to a real tone AND ACCENTS declares no extra id", () => {
    const provided = Object.keys(ACCENTS).sort();
    const canonical = [...ACCENT_IDS].sort();
    expect(provided).toEqual(canonical);
    // Every id resolves to a complete tone in both modes.
    for (const id of ACCENT_IDS) {
      for (const mode of MODES) {
        const tone = ACCENTS[id][mode];
        for (const k of ["fill", "onAccent", "text"] as const) {
          expect(typeof tone[k]).toBe("string");
          expect(tone[k].length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("resolveAccent — NULL/unknown -> package default, known -> its tone", () => {
  it("NULL resolves to the package default accent tone", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        expect(resolveAccent(null, pkg, mode)).toEqual(
          ACCENTS[DEFAULT_ACCENT[pkg]][mode],
        );
      }
    }
  });

  it("a known id resolves to that id's per-mode tone", () => {
    expect(resolveAccent("aurora-teal", "galaxy", "dark")).toEqual(
      ACCENTS["aurora-teal"].dark,
    );
    expect(resolveAccent("coral", "standard", "light")).toEqual(
      ACCENTS.coral.light,
    );
  });

  it("an unknown/tampered id falls back to the package default (T-23-06)", () => {
    // Cast through unknown — a tampered app_settings value could be any string.
    const tampered = "totally-not-an-accent" as never;
    expect(resolveAccent(tampered, "galaxy", "dark")).toEqual(
      ACCENTS[DEFAULT_ACCENT.galaxy].dark,
    );
    expect(resolveAccent(tampered, "standard", "light")).toEqual(
      ACCENTS[DEFAULT_ACCENT.standard].light,
    );
  });

  it("the package default tone MATCHES the palette's seeded accent overlay trio (no drift)", () => {
    // The preset seeds accent/onAccent/accentText with the package default
    // accent tone; assert accents.ts agrees so seed and resolver never diverge.
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        const palette = resolvePalette(pkg, mode);
        const tone = resolveAccent(null, pkg, mode);
        expect(tone.fill).toBe(palette.accent);
        expect(tone.onAccent).toBe(palette.onAccent);
        expect(tone.text).toBe(palette.accentText);
      }
    }
  });
});

describe("applyAccent — provider overlay logic (accent=fill/onAccent/accentText)", () => {
  it("overlays the tone onto a base palette and mutates nothing else", () => {
    const base = resolvePalette("galaxy", "dark");
    const tone = resolveAccent("solar-amber", "galaxy", "dark");
    const overlaid = applyAccent(base, tone);
    expect(overlaid.accent).toBe(tone.fill);
    expect(overlaid.onAccent).toBe(tone.onAccent);
    expect(overlaid.accentText).toBe(tone.text);
    // Non-accent tokens are untouched; the base object is not mutated.
    expect(overlaid.background).toBe(base.background);
    expect(overlaid.danger).toBe(base.danger);
    expect(base.accent).toBe("#6C8CFF");
  });
});
