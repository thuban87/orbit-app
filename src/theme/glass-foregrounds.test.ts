import { describe, expect, it } from "vitest";
import { ACCENTS, applyAccent, DEFAULT_ACCENT, resolveAccent } from "./accents";
import {
  OWNER_ACCEPTED_SUB12_ACCENT_TEXT,
  resolveGlassForegroundPalette,
  STANDARD_LIGHT_GLASS_ACCENT_TEXT,
  STANDARD_LIGHT_GLASS_VARIANTS,
} from "./glass-foregrounds";
import { ACCENT_IDS, type AccentId } from "./theme-option-ids";
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
    expect(glass?.accentText).toBe(
      STANDARD_LIGHT_GLASS_ACCENT_TEXT[DEFAULT_ACCENT.standard],
    );
    for (const key of Object.keys(palette) as (keyof typeof palette)[]) {
      if (
        key === "textSecondary" ||
        key === "accentText" ||
        key in STANDARD_LIGHT_GLASS_VARIANTS
      ) {
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

describe("Standard-Light glass accentText variants (D-24 / owner ruling D-26)", () => {
  it("declares a variant for exactly every curated accent id", () => {
    expect(Object.keys(STANDARD_LIGHT_GLASS_ACCENT_TEXT).sort()).toEqual(
      [...ACCENT_IDS].sort(),
    );
  });

  it("the owner-accepted sub-12% set is exactly aurora-teal and emerald (D-26)", () => {
    expect([...OWNER_ACCEPTED_SUB12_ACCENT_TEXT].sort()).toEqual([
      "aurora-teal",
      "emerald",
    ]);
  });

  for (const id of ACCENT_IDS) {
    it(`${id}: same hue family (±5°), same saturation band, darker than the root light link tone`, () => {
      const base = toHsl(ACCENTS[id].light.text);
      const next = toHsl(STANDARD_LIGHT_GLASS_ACCENT_TEXT[id]);
      const dh = Math.abs(base.h - next.h);
      expect(Math.min(dh, 360 - dh), `${id} hue shift`).toBeLessThanOrEqual(5);
      expect(Math.abs(base.s - next.s), `${id} saturation`).toBeLessThanOrEqual(
        10,
      );
      expect(next.l, `${id} lightness drops`).toBeLessThan(base.l);
      // D-24 near-black floor is HSL L 12%. The owner accepted aurora-teal and
      // emerald below it (D-26, 2026-09-26) because lightness alone cannot pass
      // Dusk's darkest composite otherwise; they still keep a real hue (>= 10%).
      const floor = (
        OWNER_ACCEPTED_SUB12_ACCENT_TEXT as readonly string[]
      ).includes(id)
        ? 10
        : 12;
      expect(next.l, `${id} not near-black`).toBeGreaterThanOrEqual(floor);
    });
  }

  it("keys the variant by the RESOLVED accent id: null and unknown ids fall back to the package default", () => {
    const cases: (AccentId | null)[] = [null, ...ACCENT_IDS];
    for (const accentId of cases) {
      const palette = applyAccent(
        resolvePalette("standard", "light"),
        resolveAccent(accentId, "standard", "light"),
      );
      const glass = resolveGlassForegroundPalette({
        palette,
        package: "standard",
        mode: "light",
        accentId,
        backgroundIsAsset: true,
      });
      expect(glass?.accentText, String(accentId)).toBe(
        STANDARD_LIGHT_GLASS_ACCENT_TEXT[accentId ?? DEFAULT_ACCENT.standard],
      );
      // accent fill and onAccent are never touched (fills, not link text).
      expect(glass?.accent).toBe(palette.accent);
      expect(glass?.onAccent).toBe(palette.onAccent);
    }
    const tampered = resolveGlassForegroundPalette({
      palette: rootPalette("standard", "light"),
      package: "standard",
      mode: "light",
      accentId: "not-an-accent" as AccentId,
      backgroundIsAsset: true,
    });
    expect(tampered?.accentText).toBe(
      STANDARD_LIGHT_GLASS_ACCENT_TEXT[DEFAULT_ACCENT.standard],
    );
  });
});
