import { describe, expect, it } from "vitest";
import { BACKGROUND_SLOTS } from "../backgrounds";
import { AA_LARGE, AA_NORMAL, contrastRatio } from "../contrast";
import { resolvePalette } from "../theme-presets";
import type { ResolvedMode, ThemePackage, ThemePalette } from "../theme-types";
import {
  alphaComposite,
  BACKGROUND_VEIL_OPACITY,
  backgroundVeilOpacity,
  chromeScrimOpacity,
  MIN_BACKGROUND_CONTRIBUTION,
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

describe("COMPOSITED per-asset live-glass AA (cycle-3 MEDIUM — the primary proof)", () => {
  // Every text/status foreground composited over
  //   alphaComposite(live glass tint @ liveGlassTintOpacity, asset brightest pixel)
  // meets AA-equivalent contrast, per asset/package/mode. Validates the DECLARED
  // worst-case pixel; the shipped .webp bytes are enforced by the device-UAT.
  for (const [id, slot] of Object.entries(BACKGROUND_SLOTS)) {
    const pkg = slot.package;
    for (const mode of MODES) {
      it(`${id} @ ${pkg}/${mode}: foregrounds over live glass on the brightest pixel meet AA`, () => {
        const palette = resolvePalette(pkg, mode);
        const tint = palette[SURFACE[pkg].tintTokenKey];
        const composite = alphaComposite(
          tint,
          slot.brightestPixel,
          SURFACE[pkg].liveGlassTintOpacity,
        );
        assertForegroundsAA(composite, palette, `${id} @ ${pkg}/${mode} live`);
      });
    }
  }
});

describe("chrome-scrim AA (31.1-05 — bare-on-background text stays readable)", () => {
  // Bare chrome (app bar, dashboard count, section headings, empty states) does
  // NOT sit on a GlassSurface card. With the veil lightened it would sit on raw
  // art, so a LOCAL chrome scrim (surface tint @ chromeScrimOpacity) backs it.
  // Every text/status foreground over that scrim composited on each asset's
  // brightest pixel must meet AA — the guarantee that "protect chrome" preserves
  // readability while the veil reveals the art.
  for (const [id, slot] of Object.entries(BACKGROUND_SLOTS)) {
    const pkg = slot.package;
    for (const mode of MODES) {
      it(`${id} @ ${pkg}/${mode}: foregrounds over the chrome scrim on the brightest pixel meet AA`, () => {
        const palette = resolvePalette(pkg, mode);
        const tint = palette[SURFACE[pkg].tintTokenKey];
        const chrome = alphaComposite(
          tint,
          slot.brightestPixel,
          chromeScrimOpacity(pkg),
        );
        assertForegroundsAA(chrome, palette, `${id} @ ${pkg}/${mode} chrome`);
      });
    }
  }

  it("chrome scrim is lighter than the card live-glass tint (art still shows behind chrome)", () => {
    for (const pkg of PACKAGES) {
      expect(
        chromeScrimOpacity(pkg),
        `${pkg}: chrome scrim should be lighter than the card tint`,
      ).toBeLessThanOrEqual(SURFACE[pkg].liveGlassTintOpacity);
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
