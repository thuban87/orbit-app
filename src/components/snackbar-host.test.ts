import { describe, expect, it } from "vitest";
import { FAB_SIDE_INSET, FAB_SIZE } from "@/navigation/use-bottom-clearance";
import { applyAccent, resolveAccent } from "@/theme/accents";
import { AA_LARGE, AA_NORMAL, contrastRatio } from "@/theme/contrast";
import { ACCENT_IDS } from "@/theme/theme-option-ids";
import { resolvePalette } from "@/theme/theme-presets";
import type { ResolvedMode, ThemePackage } from "@/theme/theme-types";
import { SPACING } from "@/theme/tokens/spacing";
import {
  ROOT_SNACKBAR_HOST,
  resolveSnackbarHostVisible,
  SNACKBAR_FAB_GAP,
  SNACKBAR_WIDTH_ONE_FAB,
  SNACKBAR_WIDTH_WITH_SECTION_FAB,
  snackbarBottomPadding,
  snackbarLayout,
  snackbarPadding,
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
      glyphTone: null,
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
      glyphTone: "background",
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
      glyphTone: "danger",
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
            if (look.glyphTone) {
              expect(
                contrastRatio(palette[look.glyphTone], fill),
              ).toBeGreaterThanOrEqual(AA_LARGE);
            }
          }
        });
      }
    }
  }
});

describe("snackbarLayout (38.10 D-132; O2 per D-138)", () => {
  const RESERVE = FAB_SIDE_INSET + FAB_SIZE + SNACKBAR_FAB_GAP;

  it("pins D-132's targets and the gap token", () => {
    expect(SNACKBAR_WIDTH_ONE_FAB).toBe(0.8);
    expect(SNACKBAR_WIDTH_WITH_SECTION_FAB).toBe(0.6);
    expect(SNACKBAR_FAB_GAP).toBe(SPACING.sm);
  });

  it("only the universal FAB: left-aligned at ~80%, clamped off the right lane", () => {
    for (const W of [320, 393, 600]) {
      expect(
        snackbarLayout({
          host: ROOT_SNACKBAR_HOST,
          windowWidth: W,
          universalFab: true,
          sectionFab: false,
        }),
      ).toEqual({
        alignItems: "flex-start",
        width: Math.min(Math.round(0.8 * W), W - SPACING.base - RESERVE),
      });
    }
  });

  it("a section FAB (with or without the universal FAB): centred at ~60%, clamped off both lanes", () => {
    for (const W of [320, 393, 600]) {
      for (const universalFab of [true, false]) {
        expect(
          snackbarLayout({
            host: ROOT_SNACKBAR_HOST,
            windowWidth: W,
            universalFab,
            sectionFab: true,
          }),
        ).toEqual({
          alignItems: "center",
          width: Math.min(Math.round(0.6 * W), W - 2 * RESERVE),
        });
      }
    }
  });

  it("no FAB, or any overlay host: today's geometry (centred, content-sized)", () => {
    const today = { alignItems: "center", width: undefined };
    expect(
      snackbarLayout({
        host: ROOT_SNACKBAR_HOST,
        windowWidth: 393,
        universalFab: false,
        sectionFab: false,
      }),
    ).toEqual(today);
    for (const universalFab of [true, false]) {
      for (const sectionFab of [true, false]) {
        expect(
          snackbarLayout({
            host: "sheet-1",
            windowWidth: 393,
            universalFab,
            sectionFab,
          }),
        ).toEqual(today);
      }
    }
  });

  // The pill's horizontal span inside the overlay, which pads each side by
  // SPACING.base: left-aligned starts at SPACING.base, centred sits on W/2.
  function span(W: number, universalFab: boolean, sectionFab: boolean) {
    const layout = snackbarLayout({
      host: ROOT_SNACKBAR_HOST,
      windowWidth: W,
      universalFab,
      sectionFab,
    });
    const width = layout.width as number;
    const left =
      layout.alignItems === "flex-start" ? SPACING.base : (W - width) / 2;
    return { left, right: left + width };
  }
  const overlaps = (
    a: { left: number; right: number },
    lane: [number, number],
  ) => a.left < lane[1] && a.right > lane[0];

  for (const W of [320, 360, 393, 412, 480]) {
    const rightLane: [number, number] = [
      W - FAB_SIDE_INSET - FAB_SIZE,
      W - FAB_SIDE_INSET,
    ];
    const leftLane: [number, number] = [
      FAB_SIDE_INSET,
      FAB_SIDE_INSET + FAB_SIZE,
    ];
    it(`W=${W}: the pill never reaches a present FAB's lane`, () => {
      for (const [universalFab, sectionFab] of [
        [true, false],
        [true, true],
        [false, true],
      ] as const) {
        const pill = span(W, universalFab, sectionFab);
        expect(pill.left).toBeGreaterThanOrEqual(SPACING.base);
        expect(pill.right).toBeLessThanOrEqual(W - SPACING.base);
        if (universalFab) expect(overlaps(pill, rightLane)).toBe(false);
        if (sectionFab) expect(overlaps(pill, leftLane)).toBe(false);
      }
    });
  }
});

describe("snackbarPadding (O5, D-132)", () => {
  it("closes the right side with SPACING.base when there is no action", () => {
    expect(snackbarPadding(false)).toEqual({
      paddingLeft: SPACING.base,
      paddingRight: SPACING.base,
    });
  });

  it("leaves the right side to the action's own padding", () => {
    expect(snackbarPadding(true)).toEqual({
      paddingLeft: SPACING.base,
      paddingRight: 0,
    });
  });
});
