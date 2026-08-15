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
