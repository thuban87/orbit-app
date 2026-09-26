import { describe, expect, it } from "vitest";
import { applyAccent, resolveAccent } from "./accents";
import {
  resolveGlassForegroundPalette,
  STANDARD_LIGHT_GLASS_VARIANTS,
} from "./glass-foregrounds";
import { resolvePalette } from "./theme-presets";
import type { ResolvedMode, ThemePackage } from "./theme-types";

const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
const MODES: ResolvedMode[] = ["dark", "light"];

function rootPalette(pkg: ThemePackage, mode: ResolvedMode) {
  return applyAccent(resolvePalette(pkg, mode), resolveAccent(null, pkg, mode));
}

describe("resolveGlassForegroundPalette — scope is Standard Light over an asset only (RG-029 / D-12 / D-24)", () => {
  it("returns null for Galaxy in both modes, with or without an asset", () => {
    for (const mode of MODES) {
      for (const backgroundIsAsset of [true, false]) {
        expect(
          resolveGlassForegroundPalette({
            palette: rootPalette("galaxy", mode),
            package: "galaxy",
            mode,
            accentId: null,
            backgroundIsAsset,
          }),
        ).toBeNull();
      }
    }
  });

  it("returns null for Standard Dark, with or without an asset", () => {
    for (const backgroundIsAsset of [true, false]) {
      expect(
        resolveGlassForegroundPalette({
          palette: rootPalette("standard", "dark"),
          package: "standard",
          mode: "dark",
          accentId: null,
          backgroundIsAsset,
        }),
      ).toBeNull();
    }
  });

  it("edge (empty): Standard Light over the solid `none` background is inactive (null)", () => {
    expect(
      resolveGlassForegroundPalette({
        palette: rootPalette("standard", "light"),
        package: "standard",
        mode: "light",
        accentId: null,
        backgroundIsAsset: false,
      }),
    ).toBeNull();
  });

  it("Standard Light over an asset resolves textSecondary to textPrimary", () => {
    const palette = rootPalette("standard", "light");
    const glass = resolveGlassForegroundPalette({
      palette,
      package: "standard",
      mode: "light",
      accentId: null,
      backgroundIsAsset: true,
    });
    expect(glass).not.toBeNull();
    expect(glass?.textSecondary).toBe(palette.textPrimary);
    expect(glass?.textPrimary).toBe(palette.textPrimary);
    // The D-24 darker variants replace their tokens; every other key is
    // carried through unchanged.
    for (const [key, hex] of Object.entries(STANDARD_LIGHT_GLASS_VARIANTS)) {
      expect(glass?.[key as keyof typeof palette], key).toBe(hex);
    }
    for (const key of Object.keys(palette) as (keyof typeof palette)[]) {
      if (key === "textSecondary" || key in STANDARD_LIGHT_GLASS_VARIANTS) {
        continue;
      }
      expect(glass?.[key], key).toEqual(palette[key]);
    }
  });

  it("is pure: never mutates the input palette and returns a new object", () => {
    const palette = rootPalette("standard", "light");
    const before = { ...palette };
    const glass = resolveGlassForegroundPalette({
      palette,
      package: "standard",
      mode: "light",
      accentId: null,
      backgroundIsAsset: true,
    });
    expect(glass).not.toBe(palette);
    expect(palette).toEqual(before);
  });

  it("every package × mode × asset flag outside Standard Light + asset is null", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        for (const backgroundIsAsset of [true, false]) {
          const active =
            pkg === "standard" && mode === "light" && backgroundIsAsset;
          const out = resolveGlassForegroundPalette({
            palette: rootPalette(pkg, mode),
            package: pkg,
            mode,
            accentId: null,
            backgroundIsAsset,
          });
          expect(out === null, `${pkg}/${mode}/${backgroundIsAsset}`).toBe(
            !active,
          );
        }
      }
    }
  });
});

/** `#RRGGBB` -> HSL (hue degrees, saturation %, lightness %). */
function toHsl(hex: string): { h: number; s: number; l: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s: sat * 100, l: l * 100 };
}

describe("Standard-Light glass variants are lightness-only darkenings (D-24)", () => {
  const root = resolvePalette("standard", "light");

  it("declares a variant for every inventoried on-glass status/rogue/danger token", () => {
    expect(Object.keys(STANDARD_LIGHT_GLASS_VARIANTS).sort()).toEqual(
      ["danger", "rogue", "statusDecay", "statusStable", "statusWobble"].sort(),
    );
  });

  for (const [key, variant] of Object.entries(STANDARD_LIGHT_GLASS_VARIANTS)) {
    it(`${key}: same hue family (±5°), same saturation band, darker, not near-black`, () => {
      const base = toHsl(root[key as keyof typeof root] as string);
      const next = toHsl(variant);
      const dh = Math.abs(base.h - next.h);
      expect(Math.min(dh, 360 - dh), `${key} hue shift`).toBeLessThanOrEqual(5);
      expect(
        Math.abs(base.s - next.s),
        `${key} saturation`,
      ).toBeLessThanOrEqual(10);
      expect(next.l, `${key} lightness drops`).toBeLessThan(base.l);
      // D-24 STOP floor: below HSL L 12% a hue reads as neutral near-black.
      expect(next.l, `${key} not near-black`).toBeGreaterThanOrEqual(12);
    });
  }

  it("Galaxy and Standard Dark effective palettes equal their root palettes", () => {
    for (const [pkg, mode] of [
      ["galaxy", "dark"],
      ["galaxy", "light"],
      ["standard", "dark"],
    ] as const) {
      const palette = rootPalette(pkg, mode);
      const effective =
        resolveGlassForegroundPalette({
          palette,
          package: pkg,
          mode,
          accentId: null,
          backgroundIsAsset: true,
        }) ?? palette;
      expect(effective).toBe(palette);
    }
  });
});
