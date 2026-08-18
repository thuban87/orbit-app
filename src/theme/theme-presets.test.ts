import { describe, expect, it } from "vitest";
// C2-5: import the ACTUAL DAO validator, not a re-inlined regex, so the palette
// lock and the write path can never desync (loosening the DAO rule would fail
// this suite too).
import {
  assertSelfSunColour,
  SELF_SUN_COLOUR_RE,
} from "@/db/app-settings-dao";
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

describe("shared status palette tokens (owner-approved 2026-08-16, UI-SPEC ⭐)", () => {
  // The four status hues are the owner's locked decision (widget + ContactCard +
  // Phase-13 orrery share them). Lock the three NEW tokens against their exact
  // owner-approved hexes so a future seed drift fails loudly (Codex/Claude M1);
  // `rogue` was locked at 2026-08-15 and stays #E0904A.
  it("seeds the three new status tokens with their exact owner-approved hexes", () => {
    const palette = resolvePalette(DEFAULT_PRESET_ID, "dark");
    expect(palette.statusStable).toBe("#45B98A");
    expect(palette.statusWobble).toBe("#E8C15C");
    expect(palette.statusDecay).toBe("#E56A52");
    // rogue is unchanged by this phase.
    expect(palette.rogue).toBe("#E0904A");
  });

  it("every preset's dark palette exposes all three status tokens as non-empty strings", () => {
    for (const preset of Object.values(THEME_PRESETS)) {
      for (const token of [
        "statusStable",
        "statusWobble",
        "statusDecay",
      ] as const) {
        expect(typeof preset.dark[token]).toBe("string");
        expect(preset.dark[token].length).toBeGreaterThan(0);
      }
    }
  });
});

describe("orrery theme tokens (ORR-04/ORR-05, UI-SPEC seeds)", () => {
  it("seeds starPalette with gold #F2C14E at index 0 and >= 6 ordered colours", () => {
    // This #F2C14E literal is check:colors-exempt (the test lives under /theme/).
    const palette = resolvePalette(DEFAULT_PRESET_ID, "dark");
    expect(palette.starPalette.length).toBeGreaterThanOrEqual(6);
    expect(palette.starPalette[0]).toBe("#F2C14E");
  });

  it("M6 + C2-5: every starPalette entry passes the REAL self_sun_colour DAO validator", () => {
    // Import the exported DAO rule (SELF_SUN_COLOUR_RE + assertSelfSunColour) and
    // run every palette token through it — the SAME check updateAppSettings runs
    // when a swatch is tapped. A non-6-hex seed (8-digit/3-digit/hsl()) fails here
    // before it can throw on-device. NO re-inlined /^#[0-9A-Fa-f]{6}$/ regex.
    for (const preset of Object.values(THEME_PRESETS)) {
      for (const star of preset.dark.starPalette) {
        expect(SELF_SUN_COLOUR_RE.test(star)).toBe(true);
        // The actual write-path guard must not throw for any seeded token.
        expect(() => assertSelfSunColour("selfSunColour", star)).not.toThrow();
      }
    }
  });

  it("exposes the muted morph endpoints and the extinguished-rogue body fill", () => {
    for (const preset of Object.values(THEME_PRESETS)) {
      for (const token of [
        "mutedStable",
        "mutedWobble",
        "mutedDecay",
        "rogueExtinguished",
      ] as const) {
        expect(typeof preset.dark[token]).toBe("string");
        expect(preset.dark[token].length).toBeGreaterThan(0);
      }
    }
  });
});
