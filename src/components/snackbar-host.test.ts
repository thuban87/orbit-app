import { describe, expect, it } from "vitest";
import { applyAccent, resolveAccent } from "@/theme/accents";
import { AA_LARGE, AA_NORMAL, contrastRatio } from "@/theme/contrast";
import { ACCENT_IDS } from "@/theme/theme-option-ids";
import { resolvePalette } from "@/theme/theme-presets";
import type { ResolvedMode, ThemePackage } from "@/theme/theme-types";
import { SPACING } from "@/theme/tokens/spacing";
import {
  ROOT_SNACKBAR_HOST,
  resolveSnackbarHostVisible,
  snackbarBottomPadding,
  snackbarPresentation,
} from "./snackbar-host";

describe("resolveSnackbarHostVisible (D-40)", () => {
  it("renders the root host only when no overlay is open", () => {
    expect(resolveSnackbarHostVisible(ROOT_SNACKBAR_HOST, null)).toBe(true);
    expect(resolveSnackbarHostVisible(ROOT_SNACKBAR_HOST, "x")).toBe(false);
  });

  it("renders an overlay host only when it is the topmost overlay", () => {
    expect(resolveSnackbarHostVisible("x", "x")).toBe(true);
    expect(resolveSnackbarHostVisible("x", "y")).toBe(false);
    expect(resolveSnackbarHostVisible("x", null)).toBe(false);
  });

  it("exactly one host renders for any top", () => {
    const hosts = [ROOT_SNACKBAR_HOST, "a", "b"];
    for (const top of [null, "a", "b"]) {
      expect(
        hosts.filter((host) => resolveSnackbarHostVisible(host, top)),
      ).toHaveLength(1);
    }
  });
});

describe("snackbarBottomPadding (D-51)", () => {
  it("keeps the root host's tab-bar/+ clearance", () => {
    expect(snackbarBottomPadding(ROOT_SNACKBAR_HOST, 0)).toBe(112);
    expect(snackbarBottomPadding(ROOT_SNACKBAR_HOST, 48)).toBe(112);
  });

  it("sits just above the system navigation bar inside an overlay", () => {
    expect(snackbarBottomPadding("x", 48)).toBe(48 + SPACING.base);
    expect(snackbarBottomPadding("x", 0)).toBe(SPACING.base);
  });
});

describe("snackbarPresentation (38.9 D-72; 38.10 D-132)", () => {
  it("a notice is an accent pill with onAccent text and action, polite", () => {
    expect(snackbarPresentation("success")).toEqual({
      fillTone: "accent",
      labelTone: "onAccent",
      actionTone: "onAccent",
      borderTone: "accent",
      glyph: null,
      liveRegion: "polite",
      accessibilityRole: undefined,
    });
  });

  it("a destructive result is the inverted warning pill with the warning glyph, polite", () => {
    expect(snackbarPresentation("warning")).toEqual({
      fillTone: "textPrimary",
      labelTone: "background",
      actionTone: "background",
      borderTone: "textPrimary",
      glyph: { tone: "background" },
      liveRegion: "polite",
      accessibilityRole: undefined,
    });
  });

  it("an error has a danger outline, a danger glyph and an assertive alert", () => {
    expect(snackbarPresentation("error")).toEqual({
      fillTone: "surface",
      labelTone: "textSecondary",
      actionTone: "accentText",
      borderTone: "danger",
      glyph: { tone: "danger" },
      liveRegion: "assertive",
      accessibilityRole: "alert",
    });
  });

  // The outline and glyph are non-text graphics: >= 3:1 against the pill's
  // `surface` fill (WCAG 1.4.11; AA_LARGE is the same 3.0) in every package x
  // mode. Never weakened; a failing pair is an owner decision.
  const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
  const MODES: ResolvedMode[] = ["dark", "light"];
  for (const pkg of PACKAGES) {
    for (const mode of MODES) {
      it(`${pkg}/${mode}: danger outline and glyph read against the surface`, () => {
        const palette = resolvePalette(pkg, mode);
        expect(
          contrastRatio(palette.danger, palette.surface),
        ).toBeGreaterThanOrEqual(AA_LARGE);
      });
    }
  }

  // D-132: each kind's text on its fill is AA (4.5:1) in all four package x
  // mode palettes, for every curated accent; the action reads the label tone
  // and the glyph (when present) is >= 3:1 on the fill (WCAG 1.4.11).
  for (const kind of ["success", "warning"] as const) {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        it(`${kind} @ ${pkg}/${mode}: label on fill is AA for every accent`, () => {
          const look = snackbarPresentation(kind);
          expect(look.actionTone).toBe(look.labelTone);
          for (const id of ACCENT_IDS) {
            const palette = applyAccent(
              resolvePalette(pkg, mode),
              resolveAccent(id, pkg, mode),
            );
            const fill = palette[look.fillTone];
            expect(
              contrastRatio(palette[look.labelTone], fill),
              `${id}`,
            ).toBeGreaterThanOrEqual(AA_NORMAL);
            if (look.glyph) {
              expect(
                contrastRatio(palette[look.glyph.tone], fill),
              ).toBeGreaterThanOrEqual(AA_LARGE);
            }
          }
        });
      }
    }
  }
});
