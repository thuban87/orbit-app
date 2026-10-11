/**
 * chipTone — the two selected-chip tiers (38.9 D-05).
 */
import { describe, expect, it } from "vitest";
import { AA_LARGE, contrastRatio } from "@/theme/contrast";
import { resolvePalette } from "@/theme/theme-presets";
import type { ResolvedMode, ThemePackage } from "@/theme/theme-types";
import { chipTone } from "./chip-tone";

const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
const MODES: ResolvedMode[] = ["dark", "light"];

describe("chipTone (D-05)", () => {
  it("primary: selected is a solid accent fill with an onAccent label", () => {
    expect(chipTone("primary", true)).toEqual({
      fill: "accent",
      border: "accent",
      label: "onAccent",
    });
  });

  it("primary: unselected keeps the surface fill, the border and textPrimary", () => {
    expect(chipTone("primary", false)).toEqual({
      fill: "surface",
      border: "border",
      label: "textPrimary",
    });
  });

  it("sub: selected is an accent outline with an accentText label and no fill", () => {
    expect(chipTone("sub", true)).toEqual({
      fill: null,
      border: "accent",
      label: "accentText",
    });
  });

  it("sub: unselected is a border outline with textPrimary and no fill", () => {
    expect(chipTone("sub", false)).toEqual({
      fill: null,
      border: "border",
      label: "textPrimary",
    });
  });

  it("never labels a chip with the accent fill (ADR-084)", () => {
    for (const tier of ["primary", "sub"] as const) {
      for (const selected of [true, false]) {
        expect(chipTone(tier, selected).label).not.toBe("accent");
      }
    }
  });

  for (const pkg of PACKAGES) {
    for (const mode of MODES) {
      it(`${pkg}/${mode}: every selected label reads against its chip`, () => {
        const p = resolvePalette(pkg, mode);
        // primary: label on the accent fill.
        expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(
          AA_LARGE,
        );
        // sub: label on the surface the outline chip sits on.
        expect(contrastRatio(p.accentText, p.surface)).toBeGreaterThanOrEqual(
          AA_LARGE,
        );
      });
    }
  }
});
