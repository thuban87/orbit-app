import { describe, expect, it } from "vitest";
import { BACKGROUND_SLOTS } from "../backgrounds";
import { AA_LARGE, AA_NORMAL, contrastRatio } from "../contrast";
import { resolvePalette } from "../theme-presets";
import type { ResolvedMode, ThemePackage, ThemePalette } from "../theme-types";
import {
  alphaComposite,
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
