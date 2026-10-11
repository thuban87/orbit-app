import { describe, expect, it } from "vitest";
import { AA_LARGE, contrastRatio } from "@/theme/contrast";
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

describe("snackbarPresentation (owner ruling D-72; review WR-06)", () => {
  it("an error has a danger outline, a warning glyph and an assertive alert", () => {
    expect(snackbarPresentation("error")).toEqual({
      borderTone: "danger",
      warningGlyph: true,
      liveRegion: "assertive",
      accessibilityRole: "alert",
    });
  });

  it("success keeps the neutral pill and a polite announcement", () => {
    expect(snackbarPresentation("success")).toEqual({
      borderTone: "border",
      warningGlyph: false,
      liveRegion: "polite",
      accessibilityRole: undefined,
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
});
