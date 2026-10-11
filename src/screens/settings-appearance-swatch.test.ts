/**
 * Selected colour swatch (38.9 D-60, K-28; cycle-5 C5-L9). AA is never
 * weakened; a star colour that cannot reach AA_LARGE is an owner report, not a
 * new token.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCENTS, applyAccent, resolveAccent } from "@/theme/accents";
import { AA_LARGE, contrastRatio } from "@/theme/contrast";
import { ACCENT_IDS } from "@/theme/theme-option-ids";
import { resolvePalette } from "@/theme/theme-presets";
import type { ResolvedMode, ThemePackage } from "@/theme/theme-types";
import {
  SWATCH_GAP_TOKEN,
  SWATCH_RING_TOKEN,
  starSwatchCheckTone,
} from "./settings-appearance-swatch";

const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
const MODES: ResolvedMode[] = ["dark", "light"];

describe("selected swatch ring (D-60)", () => {
  it("uses a textPrimary ring and a surface gap, never the accent", () => {
    expect(SWATCH_RING_TOKEN).toBe("textPrimary");
    expect(SWATCH_GAP_TOKEN).toBe("surface");
  });

  for (const pkg of PACKAGES) {
    for (const mode of MODES) {
      it(`${pkg}/${mode}: the textPrimary ring contrasts >= AA_LARGE with the surface`, () => {
        const p = resolvePalette(pkg, mode);
        expect(contrastRatio(p.textPrimary, p.surface)).toBeGreaterThanOrEqual(
          AA_LARGE,
        );
      });
    }
  }
});

describe("starSwatchCheckTone (C5-L9)", () => {
  it("picks the higher-contrast candidate", () => {
    const palette = { textPrimary: "#FFFFFF", background: "#000000" };
    expect(starSwatchCheckTone("#F2C14E", palette)).toBe("background");
    expect(starSwatchCheckTone("#1A1F33", palette)).toBe("textPrimary");
  });

  for (const pkg of PACKAGES) {
    for (const mode of MODES) {
      const p = resolvePalette(pkg, mode);
      for (const star of p.starPalette) {
        it(`${pkg}/${mode}: the check on ${star} contrasts >= AA_LARGE`, () => {
          const tone = starSwatchCheckTone(star, p);
          expect(contrastRatio(p[tone], star)).toBeGreaterThanOrEqual(AA_LARGE);
        });
      }
    }
  }
});

describe("accent swatch check = that accent's onAccent", () => {
  for (const id of ACCENT_IDS) {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        it(`${id} @ ${pkg}/${mode}: the active palette's onAccent is ACCENTS[id][mode].onAccent and reads on the fill`, () => {
          // The selected accent swatch is the active accent, so the screen's
          // `colors.onAccent` (Icon tone="onAccent") is this accent's onAccent.
          const active = applyAccent(
            resolvePalette(pkg, mode),
            resolveAccent(id, pkg, mode),
          );
          expect(active.onAccent).toBe(ACCENTS[id][mode].onAccent);
          expect(
            contrastRatio(ACCENTS[id][mode].onAccent, ACCENTS[id][mode].fill),
          ).toBeGreaterThanOrEqual(AA_LARGE);
        });
      }
    }
  }
});

describe("SettingsAppearanceScreen swatch source (K-28)", () => {
  const source = readFileSync(
    join(__dirname, "SettingsAppearanceScreen.tsx"),
    "utf8",
  );

  it("no swatch ring paints the accent", () => {
    expect(source).not.toMatch(
      /borderColor: (selected|isSelected)\s*\?\s*colors\.accent/,
    );
  });

  it("both swatch rows render the shared selectable swatch with a check tone", () => {
    expect(source.match(/<ColourSwatch\b/g)?.length).toBe(2);
    expect(source).toContain("starSwatchCheckTone(token, colors)");
    expect(source).toContain('checkTone="onAccent"');
  });
});
