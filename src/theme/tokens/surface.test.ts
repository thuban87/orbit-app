import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyAccent, DEFAULT_ACCENT, resolveAccent } from "../accents";
import { BACKGROUND_SLOTS, type BackgroundVariant } from "../backgrounds";
import {
  AA_LARGE,
  AA_NORMAL,
  contrastRatio,
  relativeLuminance,
} from "../contrast";
import { resolveGlassForegroundPalette } from "../glass-foregrounds";
import { ACCENT_IDS, type AccentId } from "../theme-option-ids";
import { resolvePalette } from "../theme-presets";
import type { ResolvedMode, ThemePackage, ThemePalette } from "../theme-types";
import {
  alphaComposite,
  BACKGROUND_VEIL_OPACITY,
  backgroundVeilOpacity,
  CARD_GLASS_OPACITY,
  cardMatchesMode,
  cardTintOpacity,
  chromeScrimOpacity,
  MIN_BACKGROUND_CONTRIBUTION,
  ORRERY_OVERLAY_BACKDROP_VISIBILITY_CEILING,
  orreryOverlayTintOpacity,
  resolveSurfaceStyle,
  SURFACE,
  SURFACE_COLOR_TOKEN_KEYS,
  SURFACE_DENSITIES,
  surfaceOpacityForDensity,
} from "./surface";

const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
const MODES: ResolvedMode[] = ["dark", "light"];

/**
 * Text foregrounds are gated at AA_NORMAL; status/glyph foregrounds at AA_LARGE
 * (the same split accents.test.ts uses — status hues are large elements). Together
 * these are the "text/status foregrounds" the glass-composite AA gate protects.
 */
const TEXT_FGS = ["textPrimary", "textSecondary"] as const;
const STATUS_FGS = [
  "statusStable",
  "statusWobble",
  "statusDecay",
  "rogue",
] as const;

/**
 * NON-TEXT / LINK / DANGER foregrounds asserted over glass + chrome with the
 * both-extrema + interval proof (RG-029 / D-24). Floors: status hues and rogue
 * are glyph/large elements (AA_LARGE); `danger` renders as validation/warning
 * TEXT, so it carries AA_NORMAL. The set comes from the committed inventory
 * (.planning/phases/38.4-audit-remediation-ui-performance-release/
 * 38.4-RG029-INVENTORY.md); anything not asserted is in PROOF_EXCLUSIONS below.
 */
const GLASS_NONTEXT_FGS: readonly {
  token: keyof ThemePalette;
  floor: number;
}[] = [
  ...STATUS_FGS.map((token) => ({ token, floor: AA_LARGE })),
  { token: "danger", floor: AA_NORMAL },
];

/**
 * Every narrowing of the asserted foreground set, written down (D-24: nothing
 * narrowed silently). Each entry names the inventory row that justifies it.
 */
interface ProofExclusion {
  token: keyof ThemePalette;
  /** Omitted = every package. */
  package?: ThemePackage;
  /** Omitted = every mode. */
  mode?: ResolvedMode;
  /** accentText only: the curated accent excluded. Omitted = every accent. */
  accentId?: AccentId;
  /** Omitted = both the card and the chrome regimes. */
  treatment?: "card" | "chrome";
  /**
   * `accepted` = an owner-ruled, permanent limitation. `held-for-owner` = a
   * failure found by this proof that is the owner's call (a regime other than
   * Standard Light, or a protected tone); nothing is retuned while it is held.
   */
  status: "accepted" | "held-for-owner";
  justification: string;
  inventoryRef: string;
}

const PROOF_EXCLUSIONS: readonly ProofExclusion[] = [
  {
    token: "danger",
    package: "galaxy",
    mode: "dark",
    justification:
      "ADR-084 owner-accepted Galaxy Dark danger (#E5484D) limitation: danger-as-text reaches 3.58-4.16:1 over the brightest Galaxy composites. D-24 keeps it as it is; it is never retuned here.",
    status: "accepted",
    inventoryRef: "E-1",
  },
];

function isExcluded(
  token: keyof ThemePalette,
  pkg: ThemePackage,
  mode: ResolvedMode,
  scope: { accentId?: AccentId | null; treatment?: "card" | "chrome" } = {},
): boolean {
  return PROOF_EXCLUSIONS.some(
    (e) =>
      e.token === token &&
      (e.package === undefined || e.package === pkg) &&
      (e.mode === undefined || e.mode === mode) &&
      (e.accentId === undefined || e.accentId === scope.accentId) &&
      (e.treatment === undefined || e.treatment === scope.treatment),
  );
}

function assertNonTextClearsExtrema(
  palette: ThemePalette,
  pkg: ThemePackage,
  mode: ResolvedMode,
  tint: string,
  opacity: number,
  slot: BackgroundVariant,
  label: string,
) {
  for (const { token, floor } of GLASS_NONTEXT_FGS) {
    if (isExcluded(token, pkg, mode)) continue;
    assertClearsExtrema(
      palette[token] as string,
      tint,
      opacity,
      slot,
      floor,
      `${label}: ${token}`,
    );
  }
}

function assertForegroundsAA(
  surfaceHex: string,
  palette: ThemePalette,
  label: string,
) {
  for (const fg of TEXT_FGS) {
    expect(
      contrastRatio(palette[fg], surfaceHex),
      `${label}: ${fg} vs composite`,
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  }
  for (const fg of STATUS_FGS) {
    expect(
      contrastRatio(palette[fg], surfaceHex),
      `${label}: ${fg} vs composite`,
    ).toBeGreaterThanOrEqual(AA_LARGE);
  }
}

/**
 * BOTH-EXTREMA + INTERVAL proof (RG-029 / ui-accessibility/AUD-UIA-001 / D-12).
 *
 * The tint is composited over BOTH declared extrema of the asset
 * (`darkestPixel`, `brightestPixel`). For a foreground of luminance Lf over a
 * composite whose luminance spans [Lmin, Lmax]:
 *   - if Lf is OUTSIDE the interval the worst contrast is at the nearer
 *     endpoint, so endpoint checks are exact;
 *   - if Lf is INSIDE the interval (the mid-tone pitfall) some pixel between the
 *     extrema composites to ~Lf and contrast collapses toward 1:1 — endpoint
 *     checks alone would falsely pass. So Lf must lie STRICTLY outside
 *     [Lmin, Lmax]; a luminance equal to an endpoint counts as inside (fails).
 * A ratio exactly equal to the floor passes (`>=`, AA thresholds never lowered).
 */
function evaluateOverExtrema(
  fg: string,
  compositeDark: string,
  compositeBright: string,
) {
  const lf = relativeLuminance(fg);
  const la = relativeLuminance(compositeDark);
  const lb = relativeLuminance(compositeBright);
  const lo = Math.min(la, lb);
  const hi = Math.max(la, lb);
  return {
    ratioDark: contrastRatio(fg, compositeDark),
    ratioBright: contrastRatio(fg, compositeBright),
    outside: lf < lo || lf > hi,
  };
}

function clearsExtrema(
  fg: string,
  compositeDark: string,
  compositeBright: string,
  floor: number,
): boolean {
  const e = evaluateOverExtrema(fg, compositeDark, compositeBright);
  return e.ratioDark >= floor && e.ratioBright >= floor && e.outside;
}

/** The tint composited over a variant's declared darkest and brightest pixels. */
function slotComposites(
  tint: string,
  opacity: number,
  slot: BackgroundVariant,
) {
  return {
    dark: alphaComposite(tint, slot.darkestPixel, opacity),
    bright: alphaComposite(tint, slot.brightestPixel, opacity),
  };
}

function assertClearsExtrema(
  fg: string,
  tint: string,
  opacity: number,
  slot: BackgroundVariant,
  floor: number,
  label: string,
) {
  const { dark, bright } = slotComposites(tint, opacity, slot);
  const e = evaluateOverExtrema(fg, dark, bright);
  expect(
    e.ratioDark,
    `${label}: vs darkest composite ${dark}`,
  ).toBeGreaterThanOrEqual(floor);
  expect(
    e.ratioBright,
    `${label}: vs brightest composite ${bright}`,
  ).toBeGreaterThanOrEqual(floor);
  expect(
    e.outside,
    `${label}: foreground luminance must lie outside the composite interval [${dark}, ${bright}]`,
  ).toBe(true);
}

/**
 * The EFFECTIVE palette the runtime renders on a glass card / chrome over an
 * asset: the same `resolveGlassForegroundPalette` the ThemeProvider feeds to
 * `GlassForegroundScope`, falling back to the root palette where it is inactive.
 */
function effectiveGlassPalette(
  pkg: ThemePackage,
  mode: ResolvedMode,
  accentId: AccentId | null = null,
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
      backgroundIsAsset: true,
    }) ?? palette
  );
}

/**
 * Every curated accent plus the package default (`null`) — accentText is a link
 * tone keyed by accent, so the proof loops all of them (RG-029 / D-24 / D-26).
 */
const ACCENT_CHOICES: readonly (AccentId | null)[] = [null, ...ACCENT_IDS];

function resolveDefaultAccentId(pkg: ThemePackage): AccentId {
  return DEFAULT_ACCENT[pkg];
}

/**
 * accentText (link text, AA_NORMAL) on the EFFECTIVE glass palette for every
 * curated accent. In Standard Light over an asset this is the lightness-only
 * `STANDARD_LIGHT_GLASS_ACCENT_TEXT` variant (owner ruling D-26, which also
 * accepts the sub-12% aurora-teal and emerald variants); elsewhere it is the
 * root accent tone.
 */
function assertAccentTextClearsExtrema(
  pkg: ThemePackage,
  mode: ResolvedMode,
  opacityFor: (pkg: ThemePackage, mode: ResolvedMode) => number,
  treatment: "card" | "chrome",
  slot: BackgroundVariant,
  label: string,
) {
  for (const accentId of ACCENT_CHOICES) {
    // `null` renders the package default; an exclusion keyed by that default
    // id covers it too.
    const rendered = accentId ?? resolveDefaultAccentId(pkg);
    if (
      isExcluded("accentText", pkg, mode, { accentId: rendered, treatment })
    ) {
      continue;
    }
    const palette = effectiveGlassPalette(pkg, mode, accentId);
    assertClearsExtrema(
      palette.accentText,
      palette[SURFACE[pkg].tintTokenKey],
      opacityFor(pkg, mode),
      slot,
      AA_NORMAL,
      `${label}: accentText (${accentId ?? "default"})`,
    );
  }
}

describe("both-extrema interval helper — boundary + mid-tone edges (RG-029)", () => {
  it("a ratio exactly equal to the floor passes", () => {
    const exact = contrastRatio("#000000", "#FFFFFF");
    expect(clearsExtrema("#000000", "#FFFFFF", "#FFFFFF", exact)).toBe(true);
  });

  it("a foreground luminance equal to an endpoint counts as inside (fails)", () => {
    const e = evaluateOverExtrema("#808080", "#808080", "#FFFFFF");
    expect(e.outside).toBe(false);
    expect(clearsExtrema("#808080", "#808080", "#FFFFFF", 1)).toBe(false);
  });

  it("a mid-tone foreground passing both endpoints still fails the interval", () => {
    // Both endpoint ratios clear AA_LARGE, but the grey sits between them, so
    // some pixel of the asset composites to ~1:1 against it.
    const e = evaluateOverExtrema("#767676", "#000000", "#FFFFFF");
    expect(e.ratioDark).toBeGreaterThanOrEqual(AA_LARGE);
    expect(e.ratioBright).toBeGreaterThanOrEqual(AA_LARGE);
    expect(clearsExtrema("#767676", "#000000", "#FFFFFF", AA_LARGE)).toBe(
      false,
    );
  });

  it("a foreground darker than the whole interval passes at the nearer endpoint", () => {
    expect(clearsExtrema("#000000", "#999999", "#FFFFFF", AA_NORMAL)).toBe(
      true,
    );
  });
});

describe("alphaComposite — fg-over-bg blend, clamped #RRGGBB", () => {
  it("alpha=1 returns the foreground; alpha=0 returns the background", () => {
    expect(alphaComposite("#123456", "#abcdef", 1)).toBe("#123456");
    expect(alphaComposite("#123456", "#abcdef", 0)).toBe("#abcdef");
  });
  it("blends channel-wise at alpha=0.5", () => {
    expect(alphaComposite("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("SURFACE tokens — density opacity is monotonic (denser -> more opaque)", () => {
  it("each package's density opacity is non-decreasing across SURFACE_DENSITIES", () => {
    for (const pkg of PACKAGES) {
      let prev = -1;
      for (const density of SURFACE_DENSITIES) {
        const o = surfaceOpacityForDensity(pkg, density);
        expect(o).toBeGreaterThan(0);
        expect(o).toBeLessThanOrEqual(1);
        expect(o).toBeGreaterThanOrEqual(prev);
        prev = o;
      }
      // The densest surface is strictly more opaque than the least dense.
      expect(
        surfaceOpacityForDensity(
          pkg,
          SURFACE_DENSITIES[SURFACE_DENSITIES.length - 1],
        ),
      ).toBeGreaterThan(surfaceOpacityForDensity(pkg, SURFACE_DENSITIES[0]));
    }
  });
});

describe("background-veil visibility floor (31.1-05 — the shipped-bug guard)", () => {
  // Regression guard for the owner production-release failure: the BackgroundHost
  // veil must leave a VISIBLE slice of the selected art at every package/density.
  // The shipped 31.1 reused the card density opacity (0.88–1.00) as a full-screen
  // wash, leaving 0–12% art — every selection looked identical. This fails if any
  // package/density background contribution (1 - veil) regresses below its floor.
  it("each package/density keeps background contribution >= its density floor", () => {
    for (const pkg of PACKAGES) {
      for (const density of SURFACE_DENSITIES) {
        const veil = backgroundVeilOpacity(pkg, density);
        expect(veil, `${pkg}/${density} veil in (0,1)`).toBeGreaterThan(0);
        expect(veil, `${pkg}/${density} veil in (0,1)`).toBeLessThan(1);
        const contribution = 1 - veil;
        expect(
          contribution,
          `${pkg}/${density}: only ${(contribution * 100).toFixed(0)}% art visible (floor ${MIN_BACKGROUND_CONTRIBUTION[density]})`,
        ).toBeGreaterThanOrEqual(MIN_BACKGROUND_CONTRIBUTION[density]);
      }
    }
  });

  it("the veil is strictly lighter than the card surface opacity it replaced", () => {
    // The whole fix: the host veil is DECOUPLED from and lighter than the card
    // density opacity, so lightening the veil never silently tracks card opacity.
    for (const pkg of PACKAGES) {
      for (const density of SURFACE_DENSITIES) {
        expect(
          backgroundVeilOpacity(pkg, density),
          `${pkg}/${density}: veil must be lighter than card surface opacity`,
        ).toBeLessThan(surfaceOpacityForDensity(pkg, density));
      }
    }
  });

  it("veil opacity is monotonic non-decreasing (denser -> more veil -> less art)", () => {
    for (const pkg of PACKAGES) {
      let prev = -1;
      for (const density of SURFACE_DENSITIES) {
        const veil = BACKGROUND_VEIL_OPACITY[pkg][density];
        expect(veil).toBeGreaterThanOrEqual(prev);
        prev = veil;
      }
    }
  });
});

describe("live-glass opacity-ordering guard (REVIEWS 23-06 MEDIUM)", () => {
  it("liveGlassTintOpacity >= fallbackTintOpacity per package (live never more translucent)", () => {
    for (const pkg of PACKAGES) {
      expect(SURFACE[pkg].liveGlassTintOpacity).toBeGreaterThanOrEqual(
        SURFACE[pkg].fallbackTintOpacity,
      );
    }
  });

  it("liveGlassTintOpacity equals the least-dense (worst-case, most translucent) density opacity", () => {
    for (const pkg of PACKAGES) {
      expect(SURFACE[pkg].liveGlassTintOpacity).toBe(
        surfaceOpacityForDensity(pkg, SURFACE_DENSITIES[0]),
      );
    }
  });
});

describe("glass-composite AA — Plan 03 handoff over the tinted FALLBACK surface", () => {
  // text/status foregrounds over the semi-opaque tinted fallback surface token
  // (tint over the palette background at fallbackTintOpacity) meet AA-equivalent
  // contrast in all four palettes (the guaranteed-readable blur-unavailable path).
  for (const pkg of PACKAGES) {
    for (const mode of MODES) {
      it(`${pkg}/${mode}: foregrounds over the fallback tinted surface meet AA`, () => {
        const palette = resolvePalette(pkg, mode);
        const tint = palette[SURFACE[pkg].tintTokenKey];
        const fallbackSurface = alphaComposite(
          tint,
          palette.background,
          SURFACE[pkg].fallbackTintOpacity,
        );
        assertForegroundsAA(
          fallbackSurface,
          palette,
          `${pkg}/${mode} fallback`,
        );
      });
    }
  }
});

describe("COMPOSITED per-asset card AA — the ACTUAL mode-aware card tint (31.1-06)", () => {
  // Every text/status foreground composited over
  //   alphaComposite(card tint @ cardTintOpacity(pkg, mode, presentation), asset)
  // meets AA per asset/package/mode. This proves BOTH regimes: the GLASSY matched
  // regime (galaxy↔dark, standard↔light — light/dark text over a matched-tone art)
  // AND the OPAQUE mismatched regime (galaxy-in-light, standard-in-dark — card falls
  // back opaque so text stays readable). Presentation is the most translucent
  // (worst-case) density.
  //
  // RG-029 (ui-accessibility/AUD-UIA-001 / D-12): text foregrounds are checked
  // over BOTH declared extrema (darkestPixel + brightestPixel) with the interval
  // test, on the EFFECTIVE glass palette the runtime scope renders. The declared
  // extrema are validated against the decoded .webp bytes by
  // `scripts/measure-background-extrema.py --check`.
  //
  // 38.5 D-23 / P-2: each slot's VARIANT is proven in its OWN mode only
  // (`slot.variants[mode]`) — the light file is never rendered in dark mode and
  // vice-versa. Labels read `slot/mode`.
  for (const [id, entry] of Object.entries(BACKGROUND_SLOTS)) {
    const pkg = entry.package;
    for (const mode of MODES) {
      const slot = entry.variants[mode];
      const regime = cardMatchesMode(pkg, mode) ? "glassy" : "opaque";
      it(`${id}/${mode} @ ${pkg}/${mode} (${regime}): text foregrounds over the card clear both extrema`, () => {
        const palette = effectiveGlassPalette(pkg, mode);
        const tint = palette[SURFACE[pkg].tintTokenKey];
        const opacity = cardTintOpacity(pkg, mode, "presentation");
        for (const fg of TEXT_FGS) {
          assertClearsExtrema(
            palette[fg],
            tint,
            opacity,
            slot,
            AA_NORMAL,
            `${id}/${mode} @ ${pkg}/${mode} ${regime} card: ${fg}`,
          );
        }
      });

      it(`${id}/${mode} @ ${pkg}/${mode} (${regime}): status/rogue/danger over the card clear both extrema (RG-029 / D-24)`, () => {
        const palette = effectiveGlassPalette(pkg, mode);
        assertNonTextClearsExtrema(
          palette,
          pkg,
          mode,
          palette[SURFACE[pkg].tintTokenKey],
          cardTintOpacity(pkg, mode, "presentation"),
          slot,
          `${id}/${mode} @ ${pkg}/${mode} ${regime} card`,
        );
      });

      it(`${id}/${mode} @ ${pkg}/${mode} (${regime}): accentText for every curated accent over the card clears both extrema (RG-029 / D-24 / D-26)`, () => {
        assertAccentTextClearsExtrema(
          pkg,
          mode,
          (p, m) => cardTintOpacity(p, m, "presentation"),
          "card",
          slot,
          `${id}/${mode} @ ${pkg}/${mode} ${regime} card`,
        );
      });
    }
  }
});

describe("orrery-overlay treatment — AA over the raw brightest Orrery pixel (38.1-01)", () => {
  // Conservative lower-bound model: the tint is composited over the RAW brightest
  // Orrery pixel with no BlurView contribution. Where GlassSurface renders a real
  // BlurView, it averages/dims the backdrop; on the no-blur path this raw model is
  // exact. The on-device composite is therefore never brighter and is at least as
  // legible as this proof.
  for (const pkg of PACKAGES) {
    for (const mode of MODES) {
      it(`${pkg}/${mode}: foregrounds over the Orrery overlay meet AA and retain backdrop visibility`, () => {
        const palette = resolvePalette(pkg, mode);
        const brightestOrreryPixel = [
          palette.textPrimary,
          ...palette.starPalette,
        ].reduce((brightest, candidate) =>
          contrastRatio("#000000", candidate) >
          contrastRatio("#000000", brightest)
            ? candidate
            : brightest,
        );
        const opacity = orreryOverlayTintOpacity(pkg, mode);
        const composite = alphaComposite(
          palette[SURFACE[pkg].tintTokenKey],
          brightestOrreryPixel,
          opacity,
        );

        assertForegroundsAA(
          composite,
          palette,
          `${pkg}/${mode} Orrery overlay`,
        );
        expect(
          opacity,
          `${pkg}/${mode}: overlay remains translucent`,
        ).toBeLessThan(surfaceOpacityForDensity(pkg, "dense"));
        expect(
          opacity,
          `${pkg}/${mode}: overlay preserves a visible Orrery backdrop`,
        ).toBeLessThanOrEqual(ORRERY_OVERLAY_BACKDROP_VISIBILITY_CEILING);
      });
    }
  }

  it("does not retune the shared ordinary-card glass constants", () => {
    expect(CARD_GLASS_OPACITY.galaxy).toBe(0.05);
    expect(CARD_GLASS_OPACITY.standard).toBe(0.5);
  });
});

describe("mode-aware card glass model (31.1-06)", () => {
  it("cardMatchesMode: galaxy↔dark and standard↔light are the glassy (matched) regimes", () => {
    expect(cardMatchesMode("galaxy", "dark")).toBe(true);
    expect(cardMatchesMode("galaxy", "light")).toBe(false);
    expect(cardMatchesMode("standard", "light")).toBe(true);
    expect(cardMatchesMode("standard", "dark")).toBe(false);
  });

  it("the matched-regime glass opacity is genuinely lighter than the opaque band", () => {
    for (const pkg of PACKAGES) {
      expect(CARD_GLASS_OPACITY[pkg]).toBeGreaterThan(0);
      // Glassy cards let the background show through — strictly lighter than the
      // most translucent step of the opaque (mismatched) band.
      expect(CARD_GLASS_OPACITY[pkg]).toBeLessThan(
        surfaceOpacityForDensity(pkg, SURFACE_DENSITIES[0]),
      );
    }
  });

  it("cardTintOpacity returns the glass value when matched, the opaque band when not", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        for (const density of SURFACE_DENSITIES) {
          const o = cardTintOpacity(pkg, mode, density);
          expect(o).toBe(
            cardMatchesMode(pkg, mode)
              ? CARD_GLASS_OPACITY[pkg]
              : surfaceOpacityForDensity(pkg, density),
          );
        }
      }
    }
  });
});

describe("chrome-scrim AA (31.1-05 — bare-on-background text stays readable)", () => {
  // Bare chrome (app bar, dashboard count, section headings, empty states) does
  // NOT sit on a GlassSurface card. With the veil lightened it would sit on raw
  // art, so a LOCAL chrome scrim (surface tint @ chromeScrimOpacity) backs it.
  // Every text/status foreground over that scrim composited on each asset's
  // brightest pixel must meet AA — the guarantee that "protect chrome" preserves
  // readability while the veil reveals the art. Each slot's variant is proven in
  // its OWN mode only (38.5 D-23 / P-2).
  for (const [id, entry] of Object.entries(BACKGROUND_SLOTS)) {
    const pkg = entry.package;
    for (const mode of MODES) {
      const slot = entry.variants[mode];
      it(`${id}/${mode} @ ${pkg}/${mode}: text foregrounds over the chrome scrim clear both extrema (RG-029)`, () => {
        const palette = effectiveGlassPalette(pkg, mode);
        const tint = palette[SURFACE[pkg].tintTokenKey];
        const opacity = chromeScrimOpacity(pkg, mode);
        for (const fg of TEXT_FGS) {
          assertClearsExtrema(
            palette[fg],
            tint,
            opacity,
            slot,
            AA_NORMAL,
            `${id}/${mode} @ ${pkg}/${mode} chrome: ${fg}`,
          );
        }
      });

      it(`${id}/${mode} @ ${pkg}/${mode}: status/rogue/danger over the chrome scrim clear both extrema (RG-029 / D-24)`, () => {
        const palette = effectiveGlassPalette(pkg, mode);
        assertNonTextClearsExtrema(
          palette,
          pkg,
          mode,
          palette[SURFACE[pkg].tintTokenKey],
          chromeScrimOpacity(pkg, mode),
          slot,
          `${id}/${mode} @ ${pkg}/${mode} chrome`,
        );
      });

      it(`${id}/${mode} @ ${pkg}/${mode}: accentText for every curated accent over the chrome scrim clears both extrema (RG-029 / D-24 / D-26)`, () => {
        assertAccentTextClearsExtrema(
          pkg,
          mode,
          chromeScrimOpacity,
          "chrome",
          slot,
          `${id}/${mode} @ ${pkg}/${mode} chrome`,
        );
      });
    }
  }

  it("chrome goes glassy in the matched regime and opaque when mismatched (mirrors cards)", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        // Chrome reuses the densest card step for a little extra bare-text backing.
        expect(chromeScrimOpacity(pkg, mode)).toBe(
          cardTintOpacity(pkg, mode, "dense"),
        );
      }
    }
  });
});

describe("surface-token-only selector guard (cycle-3 LOW, finding #4)", () => {
  it("resolveSurfaceStyle returns ONLY declared SURFACE token fields (no ad-hoc literal)", () => {
    for (const pkg of PACKAGES) {
      for (const blurAvailable of [true, false]) {
        const style = resolveSurfaceStyle(pkg, blurAvailable);
        // Colour fields are palette-token KEYS drawn from the declared set.
        expect(SURFACE_COLOR_TOKEN_KEYS).toContain(style.tintTokenKey);
        expect(SURFACE_COLOR_TOKEN_KEYS).toContain(style.borderTokenKey);
        if (style.glowTokenKey !== null) {
          expect(SURFACE_COLOR_TOKEN_KEYS).toContain(style.glowTokenKey);
        }
        // Opacity fields are members of the package's declared opacity set.
        const declaredOpacities = new Set<number>([
          ...SURFACE_DENSITIES.map((d) => surfaceOpacityForDensity(pkg, d)),
          SURFACE[pkg].liveGlassTintOpacity,
          SURFACE[pkg].fallbackTintOpacity,
        ]);
        expect(declaredOpacities.has(style.liveGlassTintOpacity)).toBe(true);
        expect(declaredOpacities.has(style.fallbackTintOpacity)).toBe(true);
        // Flags mirror the declared token set.
        expect(style.glass).toBe(SURFACE[pkg].glass);
        expect(style.useBlur).toBe(SURFACE[pkg].glass && blurAvailable);
      }
    }
  });

  it("galaxy is glass-forward (glow token present); standard is flat (no glow)", () => {
    expect(resolveSurfaceStyle("galaxy", true).glass).toBe(true);
    expect(resolveSurfaceStyle("galaxy", true).glowTokenKey).not.toBeNull();
    expect(resolveSurfaceStyle("standard", true).glass).toBe(false);
    expect(resolveSurfaceStyle("standard", true).glowTokenKey).toBeNull();
    // Standard never blurs even when blur is available (flat treatment).
    expect(resolveSurfaceStyle("standard", true).useBlur).toBe(false);
    // Galaxy blurs only where affordable.
    expect(resolveSurfaceStyle("galaxy", false).useBlur).toBe(false);
    expect(resolveSurfaceStyle("galaxy", true).useBlur).toBe(true);
  });
});

describe("background-extrema regime table sync guard (RG-029 / D-12)", () => {
  // scripts/measure-background-extrema.py validates the declared extrema under
  // the tint regimes in scripts/background-extrema-regimes.json. That table must
  // equal exactly the (package, mode, treatment, tint, opacity) tuples the card
  // and chrome suites above composite, or the script would validate a proof
  // that no longer exists.
  interface Regime {
    package: ThemePackage;
    mode: ResolvedMode;
    treatment: "card" | "chrome";
    tint: string;
    opacity: number;
  }

  function tsRegimes(): Regime[] {
    const packages = [
      ...new Set(Object.values(BACKGROUND_SLOTS).map((slot) => slot.package)),
    ];
    const out: Regime[] = [];
    for (const pkg of packages) {
      for (const mode of MODES) {
        const tint = resolvePalette(pkg, mode)[SURFACE[pkg].tintTokenKey];
        out.push({
          package: pkg,
          mode,
          treatment: "card",
          tint,
          opacity: cardTintOpacity(pkg, mode, "presentation"),
        });
        out.push({
          package: pkg,
          mode,
          treatment: "chrome",
          tint,
          opacity: chromeScrimOpacity(pkg, mode),
        });
      }
    }
    return out;
  }

  function sameRegime(a: Regime, b: Regime): boolean {
    return (
      a.package === b.package &&
      a.mode === b.mode &&
      a.treatment === b.treatment &&
      a.tint.toLowerCase() === b.tint.toLowerCase() &&
      Math.abs(a.opacity - b.opacity) <= 1e-9
    );
  }

  it("the script's regime table equals the card + chrome proof tuples exactly", () => {
    const table = JSON.parse(
      readFileSync("scripts/background-extrema-regimes.json", "utf8"),
    ) as { regimes: Regime[] };
    const ts = tsRegimes();
    expect(table.regimes.length).toBeGreaterThan(0);
    expect(table.regimes.length).toBe(ts.length);
    for (const want of ts) {
      expect(
        table.regimes.some((got) => sameRegime(got, want)),
        `missing regime ${want.package}/${want.mode}/${want.treatment} ${want.tint}@${want.opacity}`,
      ).toBe(true);
    }
    for (const got of table.regimes) {
      expect(
        ts.some((want) => sameRegime(got, want)),
        `stale regime ${got.package}/${got.mode}/${got.treatment} ${got.tint}@${got.opacity}`,
      ).toBe(true);
    }
  });
});

describe("proof exclusions are written down against the committed inventory (D-24)", () => {
  const INVENTORY =
    ".planning/phases/38.4-audit-remediation-ui-performance-release/38.4-RG029-INVENTORY.md";

  it("every exclusion carries a justification and an inventory row that exists", () => {
    const inventory = readFileSync(INVENTORY, "utf8");
    expect(PROOF_EXCLUSIONS.length).toBeGreaterThan(0);
    for (const e of PROOF_EXCLUSIONS) {
      expect(e.justification.trim().length, e.token).toBeGreaterThan(40);
      expect(
        inventory.includes(`**${e.inventoryRef}**`),
        `${e.token}: inventory row ${e.inventoryRef} missing`,
      ).toBe(true);
    }
  });

  it("the only ACCEPTED non-Standard-Light exclusion is the ADR-084 Galaxy Dark danger limitation", () => {
    const scopedAccepted = PROOF_EXCLUSIONS.filter(
      (e) =>
        e.status === "accepted" &&
        (e.package !== undefined || e.mode !== undefined),
    );
    expect(scopedAccepted).toEqual([
      expect.objectContaining({
        token: "danger",
        package: "galaxy",
        mode: "dark",
      }),
    ]);
  });

  it("E-7 is resolved (owner ruling D-28): Galaxy Light coral accentText is asserted in every regime, not excluded", () => {
    for (const treatment of ["card", "chrome"] as const) {
      expect(
        isExcluded("accentText", "galaxy", "light", {
          accentId: "coral",
          treatment,
        }),
        `galaxy/light coral ${treatment}`,
      ).toBe(false);
    }
    expect(PROOF_EXCLUSIONS.some((e) => e.inventoryRef === "E-7")).toBe(false);
  });

  it("every held-for-owner exclusion is fully scoped and named as an open owner question in the inventory", () => {
    const inventory = readFileSync(INVENTORY, "utf8");
    const held = PROOF_EXCLUSIONS.filter((e) => e.status === "held-for-owner");
    for (const e of held) {
      // Held items may never blanket-exclude a token: package, mode and (for
      // accentText) the accent must all be named.
      expect(e.package, e.inventoryRef).toBeDefined();
      expect(e.mode, e.inventoryRef).toBeDefined();
      if (e.token === "accentText") {
        expect(e.accentId, e.inventoryRef).toBeDefined();
      }
      expect(
        inventory.includes(`**${e.inventoryRef}** — HELD for the owner`),
        `${e.inventoryRef}: inventory must mark it HELD for the owner`,
      ).toBe(true);
    }
  });
});
