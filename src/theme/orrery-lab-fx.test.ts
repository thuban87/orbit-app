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

  it("falls back to Galaxy Dark for unknown inputs", () => {
    expect(resolveLabFxProfile(undefined, undefined)).toBe(
      LAB_FX_PROFILES.galaxy.dark,
    );
  });
});
