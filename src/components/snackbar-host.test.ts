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
  heldSnackbarLayout,
  latchSnackbarLayout,
  ROOT_SNACKBAR_HOST,
  resolveSnackbarHostVisible,
  SNACKBAR_FAB_GAP,
  type SnackbarScreenContext,
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

describe("held root pill layout (38.10 D-151)", () => {
  const TAB_BAR = 80;
  const W = 393;
  /** A focused section editor: no tab bar, no +, a section FAB mounted. */
  const focusedSectionEditor = (
    insetBottom: number,
  ): SnackbarScreenContext => ({
    host: ROOT_SNACKBAR_HOST,
    windowWidth: W,
    tabBarHeight: TAB_BAR,
    insetBottom,
    universalFabMayShow: false,
    sectionFabMayShow: true,
  });
  /** A tab page (a history page carries a section FAB on the + baseline). */
  const tabPage = (sectionFabMayShow: boolean): SnackbarScreenContext => ({
    host: ROOT_SNACKBAR_HOST,
    windowWidth: W,
    tabBarHeight: TAB_BAR,
    insetBottom: 24,
    universalFabMayShow: true,
    sectionFabMayShow,
  });
  const sectionRowTop = (inset: number) => inset + FAB_EDGE_GAP + FAB_SIZE;
  const plusRowTop = TAB_BAR + FAB_EDGE_GAP + FAB_SIZE;

  it("a focused section editor, FAB hidden at the start: never below the section FAB row (3-button nav and gesture nav)", () => {
    for (const inset of [0, 24, 48, 64]) {
      const held = heldSnackbarLayout({
        ...focusedSectionEditor(inset),
        universalFab: false,
        sectionFab: false,
      });
      // Content-sized and centred (no FAB shows yet), at today's 112 or
      // higher when the section FAB's row reaches above it.
      expect(held.width).toBeUndefined();
      expect(held.paddingBottom).toBe(
        Math.max(
          snackbarBottomPadding(ROOT_SNACKBAR_HOST, inset),
          sectionRowTop(inset) + SNACKBAR_FAB_GAP,
        ),
      );
      expect(held.paddingBottom - sectionRowTop(inset)).toBeGreaterThanOrEqual(
        SNACKBAR_FAB_GAP,
      );
    }
    // The case IN-04 names: 3-button navigation (inset 48) puts the section
    // FAB's top at 120, above the old 112; the held pill clears it.
    expect(
      heldSnackbarLayout({
        ...focusedSectionEditor(48),
        universalFab: false,
        sectionFab: false,
      }).paddingBottom,
    ).toBe(128);
  });

  it("a focused section editor, FAB showing at the start: D-143's place, unchanged", () => {
    for (const inset of [0, 24, 48]) {
      const ctx = focusedSectionEditor(inset);
      expect(
        heldSnackbarLayout({ ...ctx, universalFab: false, sectionFab: true }),
      ).toEqual(
        snackbarLayout({ ...ctx, universalFab: false, sectionFab: true }),
      );
    }
  });

  it("a tab page with the + hidden for the keyboard: above the + row it comes back to", () => {
    for (const sectionFabMayShow of [true, false]) {
      const held = heldSnackbarLayout({
        ...tabPage(sectionFabMayShow),
        universalFab: false,
        sectionFab: false,
      });
      expect(held.width).toBeUndefined();
      expect(held.paddingBottom).toBe(plusRowTop + SNACKBAR_FAB_GAP);
    }
  });

  it("a tab page with the + showing: D-143's place, the section FAB on its baseline", () => {
    for (const sectionFab of [true, false]) {
      const ctx = tabPage(true);
      expect(
        heldSnackbarLayout({ ...ctx, universalFab: true, sectionFab }),
      ).toEqual(snackbarLayout({ ...ctx, universalFab: true, sectionFab }));
    }
  });

  it("a screen with no FAB that can appear (a focused form without a section FAB): today's place", () => {
    const ctx: SnackbarScreenContext = {
      ...focusedSectionEditor(48),
      sectionFabMayShow: false,
    };
    expect(
      heldSnackbarLayout({ ...ctx, universalFab: false, sectionFab: false }),
    ).toEqual({
      alignItems: "center",
      width: undefined,
      paddingBottom: snackbarBottomPadding(ROOT_SNACKBAR_HOST, 48),
    });
  });

  it("an overlay host is unchanged (no FAB there, D-51)", () => {
    const ctx = { ...tabPage(true), host: "sheet-1" };
    expect(
      heldSnackbarLayout({ ...ctx, universalFab: true, sectionFab: true }),
    ).toEqual(snackbarLayout({ ...ctx, universalFab: true, sectionFab: true }));
  });

  // Exhaustive: whatever showed when the message appeared, every FAB that can
  // show on that screen afterwards stays wholly below the held pill.
  for (const inset of [0, 24, 48]) {
    for (const universalFabMayShow of [true, false]) {
      for (const sectionFabMayShow of [true, false]) {
        it(`never over a FAB that shows later (inset ${inset}, + ${universalFabMayShow}, section ${sectionFabMayShow})`, () => {
          const ctx: SnackbarScreenContext = {
            host: ROOT_SNACKBAR_HOST,
            windowWidth: W,
            tabBarHeight: TAB_BAR,
            insetBottom: inset,
            universalFabMayShow,
            sectionFabMayShow,
          };
          for (const startPlus of universalFabMayShow
            ? [true, false]
            : [false]) {
            for (const startSection of sectionFabMayShow
              ? [true, false]
              : [false]) {
              const held = heldSnackbarLayout({
                ...ctx,
                universalFab: startPlus,
                sectionFab: startSection,
              });
              const rowsThatCanShow: number[] = [];
              if (universalFabMayShow) rowsThatCanShow.push(plusRowTop);
              if (sectionFabMayShow) {
                rowsThatCanShow.push(
                  universalFabMayShow ? plusRowTop : sectionRowTop(inset),
                );
              }
              for (const top of rowsThatCanShow) {
                expect(held.paddingBottom - top).toBeGreaterThanOrEqual(
                  SNACKBAR_FAB_GAP,
                );
              }
            }
          }
        });
      }
    }
  }

  it("holds the layout for one message while the section FAB morphs in and out", () => {
    const message = { kind: "warning", label: "Deleted" };
    const ctx = focusedSectionEditor(48);
    const first = latchSnackbarLayout(null, message, {
      ...ctx,
      universalFab: false,
      sectionFab: false,
    });
    const scrolled = latchSnackbarLayout(first, message, {
      ...ctx,
      universalFab: false,
      sectionFab: true,
    });
    const back = latchSnackbarLayout(scrolled, message, {
      ...ctx,
      universalFab: false,
      sectionFab: false,
    });
    expect(scrolled).toBe(first);
    expect(back).toBe(first);
    expect(scrolled.layout.paddingBottom).toBe(128);
  });

  it("holds it while the + hides for the keyboard and comes back", () => {
    const message = { kind: "success", label: "Saved" };
    const ctx = tabPage(false);
    const first = latchSnackbarLayout(null, message, {
      ...ctx,
      universalFab: true,
      sectionFab: false,
    });
    expect(
      latchSnackbarLayout(first, message, {
        ...ctx,
        universalFab: false,
        sectionFab: false,
      }),
    ).toBe(first);
  });

  it("lays out a new or replacing message afresh", () => {
    const ctx = focusedSectionEditor(48);
    const first = latchSnackbarLayout(
      null,
      { kind: "warning", label: "Deleted" },
      { ...ctx, universalFab: false, sectionFab: false },
    );
    const next = latchSnackbarLayout(
      first,
      { kind: "success", label: "Restored" },
      { ...ctx, universalFab: false, sectionFab: true },
    );
    expect(next).not.toBe(first);
    expect(next.layout.width).toBe(W - 2 * SPACING.base);
  });

  it("lays out afresh when the message outlives its screen (Save, then Back to a page with the +)", () => {
    const message = { kind: "success", label: "Saved" };
    const editor = latchSnackbarLayout(null, message, {
      ...focusedSectionEditor(24),
      universalFab: false,
      sectionFab: false,
    });
    const profile = latchSnackbarLayout(editor, message, {
      ...tabPage(false),
      universalFab: true,
      sectionFab: false,
    });
    expect(profile).not.toBe(editor);
    expect(profile.layout.paddingBottom).toBe(plusRowTop + SNACKBAR_FAB_GAP);
  });
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
