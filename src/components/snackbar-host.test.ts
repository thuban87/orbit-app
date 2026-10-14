import { describe, expect, it } from "vitest";
import {
  FAB_EDGE_GAP,
  FAB_SIDE_INSET,
  FAB_SIZE,
} from "@/navigation/use-bottom-clearance";
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

  it("an error takes the warning pill and keeps its assertive alert (D-140; 38.9 D-72)", () => {
    expect(snackbarPresentation("error")).toEqual({
      fillTone: "textPrimary",
      labelTone: "background",
      actionTone: "background",
      borderTone: "textPrimary",
      glyphTone: "background",
      liveRegion: "assertive",
      accessibilityRole: "alert",
    });
  });

  it("there are two looks in total: notice and warning (D-140)", () => {
    const paint = (kind: "success" | "warning" | "error") => {
      const {
        liveRegion: _l,
        accessibilityRole: _r,
        ...rest
      } = snackbarPresentation(kind);
      return rest;
    };
    expect(paint("error")).toEqual(paint("warning"));
    expect(paint("success")).not.toEqual(paint("warning"));
  });

  const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
  const MODES: ResolvedMode[] = ["dark", "light"];

  // D-132: each kind's text on its fill is AA (4.5:1) in all four package x
  // mode palettes, for every curated accent; the action reads the label tone
  // and the glyph (when present) is >= 3:1 on the fill (WCAG 1.4.11; AA_LARGE
  // is the same 3.0). Never weakened; a failing pair is an owner decision.
  for (const kind of ["success", "warning", "error"] as const) {
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

describe("snackbarLayout (38.10 D-143, amending D-132's widths)", () => {
  const TAB_BAR = 80;
  const INSET = 24;
  const layoutFor = (
    W: number,
    universalFab: boolean,
    sectionFab: boolean,
    host = ROOT_SNACKBAR_HOST,
  ) =>
    snackbarLayout({
      host,
      windowWidth: W,
      universalFab,
      sectionFab,
      tabBarHeight: TAB_BAR,
      insetBottom: INSET,
    });

  it("pins the gap token", () => {
    expect(SNACKBAR_FAB_GAP).toBe(SPACING.sm);
  });

  it("any FAB on screen: full width inside the side margins", () => {
    for (const W of [320, 393, 600]) {
      for (const [universalFab, sectionFab] of [
        [true, false],
        [true, true],
        [false, true],
      ] as const) {
        const layout = layoutFor(W, universalFab, sectionFab);
        expect(layout.alignItems).toBe("center");
        expect(layout.width).toBe(W - 2 * SPACING.base);
      }
    }
  });

  it("the universal + (alone or with a section button on its baseline): just above the + row", () => {
    for (const sectionFab of [true, false]) {
      expect(layoutFor(393, true, sectionFab).paddingBottom).toBe(
        TAB_BAR + FAB_EDGE_GAP + FAB_SIZE + SNACKBAR_FAB_GAP,
      );
    }
  });

  it("a section button alone (focused route, no tab bar): just above it, off the safe-area inset", () => {
    expect(layoutFor(393, false, true).paddingBottom).toBe(
      INSET + FAB_EDGE_GAP + FAB_SIZE + SNACKBAR_FAB_GAP,
    );
  });

  it("no FAB, or any overlay host: today's geometry (centred, content-sized)", () => {
    expect(layoutFor(393, false, false)).toEqual({
      alignItems: "center",
      width: undefined,
      paddingBottom: snackbarBottomPadding(ROOT_SNACKBAR_HOST, INSET),
    });
    for (const universalFab of [true, false]) {
      for (const sectionFab of [true, false]) {
        expect(layoutFor(393, universalFab, sectionFab, "sheet-1")).toEqual({
          alignItems: "center",
          width: undefined,
          paddingBottom: snackbarBottomPadding("sheet-1", INSET),
        });
      }
    }
  });

  // The pill's span inside the overlay, which pads each side by SPACING.base;
  // a centred pill sits on W/2. Vertically it ends above the FAB row's top.
  for (const W of [320, 360, 393, 412, 480]) {
    it(`W=${W}: the full-width pill keeps its margins and stays clear of every FAB`, () => {
      for (const [universalFab, sectionFab] of [
        [true, false],
        [true, true],
        [false, true],
      ] as const) {
        const layout = layoutFor(W, universalFab, sectionFab);
        const width = layout.width as number;
        const left = (W - width) / 2;
        expect(left).toBe(SPACING.base);
        expect(left + width).toBe(W - SPACING.base);
        // Both FAB lanes lie under the pill horizontally, so it must sit
        // wholly above the FAB row's top edge.
        const fabRowTop =
          (universalFab ? TAB_BAR : INSET) + FAB_EDGE_GAP + FAB_SIZE;
        expect(layout.paddingBottom).toBeGreaterThan(fabRowTop);
        expect(layout.paddingBottom - fabRowTop).toBe(SNACKBAR_FAB_GAP);
        expect(left).toBeLessThan(FAB_SIDE_INSET + FAB_SIZE);
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
