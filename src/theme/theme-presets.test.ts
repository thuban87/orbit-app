import { describe, expect, it } from "vitest";
// C2-5: import the ACTUAL DAO validator, not a re-inlined regex, so the palette
// lock and the write path can never desync (loosening the DAO rule would fail
// this suite too).
import { assertSelfSunColour, SELF_SUN_COLOUR_RE } from "@/db/app-settings-dao";
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
  it("returns the requested package + mode's palette", () => {
    expect(resolvePalette(DEFAULT_PRESET_ID, "dark")).toBe(
      THEME_PRESETS[DEFAULT_PRESET_ID].dark,
    );
    expect(resolvePalette("galaxy", "dark")).toBe(THEME_PRESETS.galaxy.dark);
    expect(resolvePalette("standard", "dark")).toBe(
      THEME_PRESETS.standard.dark,
    );
  });

  it("resolves galaxy and standard to DISTINCT package palettes (the package axis)", () => {
    const galaxy = resolvePalette("galaxy", "dark");
    const standard = resolvePalette("standard", "dark");
    expect(galaxy).not.toBe(standard);
    // At minimum the base background differs so the axis is observable at render.
    expect(galaxy.background).not.toBe(standard.background);
  });

  it("DEFAULT_PRESET_ID is the galaxy package (= the former space-dark palette)", () => {
    expect(DEFAULT_PRESET_ID).toBe("galaxy");
    expect(resolvePalette(DEFAULT_PRESET_ID, "dark")).toBe(
      THEME_PRESETS.galaxy.dark,
    );
  });

  it("resolves 'light' to the AUTHORED light palette (dark-fallback retired, Plan 03)", () => {
    // Plan 03 authored all four palettes and made `light` required, so "light"
    // now returns the package's OWN light palette — never the dark fallback.
    expect(resolvePalette(DEFAULT_PRESET_ID, "light")).toBe(
      THEME_PRESETS[DEFAULT_PRESET_ID].light,
    );
    expect(resolvePalette(DEFAULT_PRESET_ID, "light")).not.toBe(
      THEME_PRESETS[DEFAULT_PRESET_ID].dark,
    );
    expect(resolvePalette("standard", "light")).toBe(
      THEME_PRESETS.standard.light,
    );
    expect(resolvePalette("standard", "light")).not.toBe(
      THEME_PRESETS.standard.dark,
    );
  });

  it("exposes every base palette token as a string", () => {
    const palette = resolvePalette(DEFAULT_PRESET_ID, "dark");
    for (const token of [
      "background",
      "surface",
      "surfaceElevated",
      "profileBackgroundScrim",
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

  it("resolvePalette surfaces both avatar tokens for galaxy/dark", () => {
    const palette = resolvePalette("galaxy", "dark");
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

  it("resolvePalette surfaces both status/gravity tokens for galaxy/dark", () => {
    const palette = resolvePalette("galaxy", "dark");
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

describe("four authored palettes — light required, all distinct + complete (Plan 03)", () => {
  // Every SCALAR string token a complete ThemePalette must carry (arrays are
  // asserted separately below). Includes the accent overlay trio
  // (accent/onAccent/accentText, seeded per palette) and the destructive pair
  // (danger/onDanger) added in Plan 03.
  const SCALAR_TOKENS = [
    "background",
    "surface",
    "surfaceElevated",
    "accent",
    "onAccent",
    "accentText",
    "textPrimary",
    "textSecondary",
    "border",
    "borderStrong",
    "danger",
    "onDanger",
    "avatarSwatchText",
    "rogue",
    "statusStable",
    "statusWobble",
    "statusDecay",
    "mutedStable",
    "mutedWobble",
    "mutedDecay",
    "rogueExtinguished",
  ] as const;
  const ARRAY_TOKENS = [
    "avatarSwatches",
    "gravityTiers",
    "starPalette",
  ] as const;

  const combos = [
    ["galaxy", "dark"],
    ["galaxy", "light"],
    ["standard", "dark"],
    ["standard", "light"],
  ] as const;

  it("resolves all four (package, mode) combos to DISTINCT palette objects", () => {
    const resolved = combos.map(([pkg, mode]) => resolvePalette(pkg, mode));
    // Every pair is a distinct object reference (no two combos share a palette).
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        expect(resolved[i]).not.toBe(resolved[j]);
      }
    }
    // And galaxy vs standard at the SAME mode never collapse to one palette.
    expect(resolvePalette("galaxy", "dark")).not.toBe(
      resolvePalette("standard", "dark"),
    );
    expect(resolvePalette("galaxy", "light")).not.toBe(
      resolvePalette("standard", "light"),
    );
  });

  it("light is REQUIRED and returns the authored light palette, NOT the dark fallback", () => {
    for (const preset of Object.values(THEME_PRESETS)) {
      expect(preset.light).toBeDefined();
      // The retired dark-fallback: light must be its OWN palette, not dark.
      expect(preset.light).not.toBe(preset.dark);
      expect(preset.light.background).not.toBe(preset.dark.background);
    }
    // resolvePalette(pkg, "light") now returns the light palette, never dark.
    expect(resolvePalette("galaxy", "light")).toBe(THEME_PRESETS.galaxy.light);
    expect(resolvePalette("standard", "light")).toBe(
      THEME_PRESETS.standard.light,
    );
  });

  it("every one of the four palettes carries the COMPLETE token set (incl. onDanger)", () => {
    for (const [pkg, mode] of combos) {
      const palette = resolvePalette(pkg, mode);
      for (const token of SCALAR_TOKENS) {
        expect(typeof palette[token]).toBe("string");
        expect((palette[token] as string).length).toBeGreaterThan(0);
      }
      for (const token of ARRAY_TOKENS) {
        expect(Array.isArray(palette[token])).toBe(true);
        expect((palette[token] as readonly string[]).length).toBeGreaterThan(0);
      }
      // onDanger is the net-new destructive foreground — assert it explicitly so
      // a palette omitting it fails loudly (not just via the loop above).
      expect(typeof palette.onDanger).toBe("string");
      expect(palette.onDanger.length).toBeGreaterThan(0);
    }
  });

  it("galaxy-dark keeps its owner-approved danger fill and the former accent fill", () => {
    const gd = resolvePalette("galaxy", "dark");
    // Owner-approved destructive hue (2026-08-14) is untouched by Plan 03.
    expect(gd.danger).toBe("#E5484D");
    // accent(=fill) stays the former single accent so consumers see no regression.
    expect(gd.accent).toBe("#6C8CFF");
  });
});
