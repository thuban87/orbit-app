import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESET_ID,
  resolveMode,
  resolvePalette,
  THEME_PRESETS,
} from "./theme-presets";

describe("resolveMode", () => {
  it("passes an explicit mode through untouched", () => {
    expect(resolveMode("dark", null)).toBe("dark");
    expect(resolveMode("light", null)).toBe("light");
  });

  it("resolves system to the OS scheme when the OS reports a preference", () => {
    expect(resolveMode("system", "light")).toBe("light");
    expect(resolveMode("system", "dark")).toBe("dark");
  });

  it("falls back to the dark default for every non-light system value", () => {
    // null / undefined: OS has no opinion (or Appearance not ready)
    expect(resolveMode("system", null)).toBe("dark");
    expect(resolveMode("system", undefined)).toBe("dark");
    // "unspecified" is what RN's useColorScheme() actually returns for
    // "no preference" — it MUST resolve to the dark default, not invert it.
    expect(resolveMode("system", "unspecified")).toBe("dark");
  });
});

describe("resolvePalette", () => {
  it("returns the requested mode's palette", () => {
    expect(resolvePalette(DEFAULT_PRESET_ID, "dark")).toBe(
      THEME_PRESETS[DEFAULT_PRESET_ID].dark,
    );
  });

  it("falls back to the dark palette when the requested mode is absent", () => {
    // Only a dark palette ships this phase, so "light" deterministically
    // returns the SAME dark palette — proving "light"/"system" are DEFINED,
    // never undefined.
    expect(resolvePalette(DEFAULT_PRESET_ID, "light")).toBe(
      THEME_PRESETS[DEFAULT_PRESET_ID].dark,
    );
  });

  it("exposes every base palette token as a string", () => {
    const palette = resolvePalette(DEFAULT_PRESET_ID, "dark");
    for (const token of [
      "background",
      "surface",
      "surfaceElevated",
      "accent",
      "textPrimary",
      "textSecondary",
      "border",
      "borderStrong",
    ] as const) {
      expect(typeof palette[token]).toBe("string");
    }
  });
});

describe("avatar swatch tokens (PHOTO-04)", () => {
  it("every preset's dark palette exposes a non-empty avatarSwatches array", () => {
    for (const preset of Object.values(THEME_PRESETS)) {
      expect(Array.isArray(preset.dark.avatarSwatches)).toBe(true);
      expect(preset.dark.avatarSwatches.length).toBeGreaterThan(0);
      // Every swatch must be a non-empty string (the deterministic-pick indexes
      // this array, so a hole would render a contact with no colour).
      for (const swatch of preset.dark.avatarSwatches) {
        expect(typeof swatch).toBe("string");
        expect(swatch.length).toBeGreaterThan(0);
      }
    }
  });

  it("every preset's dark palette exposes a non-empty avatarSwatchText token", () => {
    for (const preset of Object.values(THEME_PRESETS)) {
      expect(typeof preset.dark.avatarSwatchText).toBe("string");
      expect(preset.dark.avatarSwatchText.length).toBeGreaterThan(0);
    }
  });

  it("resolvePalette surfaces both avatar tokens for space-dark/dark", () => {
    const palette = resolvePalette("space-dark", "dark");
    expect(palette.avatarSwatches.length).toBeGreaterThan(0);
    expect(palette.avatarSwatchText.length).toBeGreaterThan(0);
  });
});

describe("status/gravity colour tokens (LOG-05, owner-approved 2026-08-15)", () => {
  // Plan 06-05's impact.ts is a sibling in this wave and may not exist yet, so
  // the tier count is mirrored here as a literal. The contract (theme-types.ts)
  // is one colour PER gravity tier — thin/building/solid/deep — hence an EXACT
  // length assertion, not `>=`, so a stray extra/missing entry is caught.
  const GRAVITY_TIER_COUNT = 4;

  it("every preset's dark palette exposes a non-empty-string rogue token", () => {
    for (const preset of Object.values(THEME_PRESETS)) {
      expect(typeof preset.dark.rogue).toBe("string");
      expect(preset.dark.rogue.length).toBeGreaterThan(0);
    }
  });

  it("every preset's dark palette exposes a gravityTiers ramp with exactly one colour per gravity tier", () => {
    for (const preset of Object.values(THEME_PRESETS)) {
      expect(Array.isArray(preset.dark.gravityTiers)).toBe(true);
      // Exact parity with the gravity tier count — one colour PER tier, so
      // `gravityTiers[tierIndex]` is always in range and never over-provisions.
      expect(preset.dark.gravityTiers).toHaveLength(GRAVITY_TIER_COUNT);
      for (const tier of preset.dark.gravityTiers) {
        expect(typeof tier).toBe("string");
        expect(tier.length).toBeGreaterThan(0);
      }
    }
  });

  it("resolvePalette surfaces both status/gravity tokens for space-dark/dark", () => {
    const palette = resolvePalette("space-dark", "dark");
    expect(palette.rogue.length).toBeGreaterThan(0);
    expect(palette.gravityTiers).toHaveLength(GRAVITY_TIER_COUNT);
  });
});
