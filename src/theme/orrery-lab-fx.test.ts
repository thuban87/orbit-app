import { describe, expect, it } from "vitest";
import {
  LAB_FX_PROFILES,
  labColor,
  resolveLabFxProfile,
} from "./orrery-lab-fx";
import { THEME_PRESETS } from "./theme-presets";

describe("Lab B effect profiles (LAB-ONLY tokens)", () => {
  it("resolves all four package × mode combinations to palette tokens", () => {
    for (const pkg of ["galaxy", "standard"] as const)
      for (const mode of ["dark", "light"] as const) {
        const profile = resolveLabFxProfile(pkg, mode);
        expect(profile).toBe(LAB_FX_PROFILES[pkg][mode]);
        const palette = THEME_PRESETS[pkg][mode];
        for (const token of [
          ...Object.values(profile.roles),
          profile.hud.plate,
          profile.hud.text,
          profile.hud.graph,
          profile.hud.warn,
          profile.hud.bad,
        ])
          expect(typeof labColor(palette, token)).toBe("string");
      }
  });

  it("uses additive physics on dark, multiply on light, and mutes Standard Light most", () => {
    expect(resolveLabFxProfile("galaxy", "dark").blend).toBe("additive");
    expect(resolveLabFxProfile("standard", "light").blend).toBe("multiply");
    const all = Object.values(LAB_FX_PROFILES).flatMap((p) =>
      Object.values(p).map((x) => x.intensity),
    );
    expect(resolveLabFxProfile("standard", "light").intensity).toBe(
      Math.min(...all),
    );
    expect(resolveLabFxProfile("galaxy", "dark").intensity).toBe(
      Math.max(...all),
    );
  });

  it("gives every variant an L0 environment, with Standard Light the quietest", () => {
    const effective = (pkg: "galaxy" | "standard", mode: "dark" | "light") => {
      const p = resolveLabFxProfile(pkg, mode);
      return {
        nebula: (p.env.strengthA + p.env.strengthB) * p.intensity,
        stars: p.env.starAlpha * p.env.starDensity * p.intensity,
      };
    };
    for (const pkg of ["galaxy", "standard"] as const)
      for (const mode of ["dark", "light"] as const) {
        const profile = resolveLabFxProfile(pkg, mode);
        const palette = THEME_PRESETS[pkg][mode];
        expect(typeof labColor(palette, profile.env.lobeA)).toBe("string");
        expect(typeof labColor(palette, profile.env.starTone)).toBe("string");
        for (const i of [
          profile.env.lobeBStar,
          profile.env.emberStar,
          ...profile.env.starTintStars,
        ])
          expect(palette.starPalette[i]).toBeTypeOf("string");
        // Light themes have no emission and no additive stars.
        if (mode === "light") {
          expect(profile.env.glow).toBe(0);
          expect(profile.env.starAdditive).toBe(false);
        }
      }
    const sl = effective("standard", "light");
    for (const [pkg, mode] of [
      ["galaxy", "dark"],
      ["galaxy", "light"],
      ["standard", "dark"],
    ] as const) {
      expect(sl.nebula).toBeLessThan(effective(pkg, mode).nebula);
      expect(sl.stars).toBeLessThan(effective(pkg, mode).stars);
    }
  });

  it("falls back to Galaxy Dark for unknown inputs", () => {
    expect(resolveLabFxProfile(undefined, undefined)).toBe(
      LAB_FX_PROFILES.galaxy.dark,
    );
  });
});
