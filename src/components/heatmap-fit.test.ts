import { describe, expect, it } from "vitest";
import { cellHitSlop, fitHeatmapCell } from "@/components/heatmap-fit";
import { SPACING } from "@/theme/tokens/spacing";

const GAP = SPACING.xs;

function rowWidth(cell: number, columns: number, gap: number): number {
  return columns * cell + (columns - 1) * gap;
}

describe("fitHeatmapCell (RG-033 ui-accessibility/AUD-UIA-010, D-13)", () => {
  it("returns maxCell exactly at the width where 7·max + 6·gap fits, one less a dp narrower", () => {
    expect(
      fitHeatmapCell({
        availableWidth: 7 * 56 + 6 * 4,
        columns: 7,
        gap: 4,
        maxCell: 56,
      }),
    ).toBe(56);
    expect(
      fitHeatmapCell({
        availableWidth: 7 * 56 + 6 * 4 - 1,
        columns: 7,
        gap: 4,
        maxCell: 56,
      }),
    ).toBe(55);
  });

  it("caps wide screens at maxCell", () => {
    expect(
      fitHeatmapCell({ availableWidth: 800, columns: 7, gap: 4, maxCell: 56 }),
    ).toBe(56);
  });

  it("fits a 320dp screen's Your Week width at or above the design floor", () => {
    // Your Week's available width at a 320dp window: DigestScreen
    // `styles.content.padding` (SPACING.base per side) is the only horizontal
    // inset — the Digest ScrollView body and YourWeekSection container add no
    // horizontal padding. 320 − 2·16 = 288.
    const available = 320 - 2 * SPACING.base;
    expect(available).toBe(288);
    const cell = fitHeatmapCell({
      availableWidth: available,
      columns: 7,
      gap: GAP,
      maxCell: 56,
    });
    expect(cell).not.toBeNull();
    // YourWeekHeatmap's MIN_CELL design floor (36).
    expect(cell as number).toBeGreaterThanOrEqual(36);
    expect(rowWidth(cell as number, 7, GAP)).toBeLessThanOrEqual(available);
  });

  it("renders nothing for a zero, negative or non-finite width", () => {
    for (const availableWidth of [0, -1, -400, Number.NaN]) {
      expect(
        fitHeatmapCell({ availableWidth, columns: 7, gap: GAP, maxCell: 56 }),
      ).toBeNull();
    }
  });

  it("never overflows: every integer width 200–900 keeps 7 cells + 6 gaps inside", () => {
    for (let width = 200; width <= 900; width += 1) {
      const cell = fitHeatmapCell({
        availableWidth: width,
        columns: 7,
        gap: GAP,
        maxCell: 56,
      });
      expect(cell).not.toBeNull();
      expect(Number.isInteger(cell)).toBe(true);
      expect(cell as number).toBeLessThanOrEqual(56);
      expect(rowWidth(cell as number, 7, GAP)).toBeLessThanOrEqual(width);
    }
  });

  it("uses fractional widths without overflowing (whole-dp floor)", () => {
    const cell = fitHeatmapCell({
      availableWidth: 300.7,
      columns: 7,
      gap: GAP,
      maxCell: 56,
    });
    expect(cell).toBe(39);
    expect(rowWidth(cell as number, 7, GAP)).toBeLessThanOrEqual(300.7);
  });
});

describe("fitHeatmapCell — ActivityHeatmap lens shapes (RG-033, D-13)", () => {
  // Profile History's available width at a 320dp window: ContactProfileScreen
  // content padding (16/side) + ProfileSection sectionBody padding (16/side) +
  // GlassSurface border (1/side) = 320 − 66 = 254.
  const PROFILE_320 = 320 - 66;

  it("day lens (7 columns, cap 38) fits a 320dp Profile and never overflows 200–900", () => {
    const at320 = fitHeatmapCell({
      availableWidth: PROFILE_320,
      columns: 7,
      gap: GAP,
      maxCell: 38,
    }) as number;
    expect(at320).toBe(32);
    expect(rowWidth(at320, 7, GAP)).toBeLessThanOrEqual(PROFILE_320);
    for (let width = 200; width <= 900; width += 1) {
      const cell = fitHeatmapCell({
        availableWidth: width,
        columns: 7,
        gap: GAP,
        maxCell: 38,
      }) as number;
      expect(cell).toBeLessThanOrEqual(38);
      expect(rowWidth(cell, 7, GAP)).toBeLessThanOrEqual(width);
    }
  });

  it("cycle lens (5 columns, 4 gaps, cap 52) fits a 320dp Profile and never overflows 200–900", () => {
    const at320 = fitHeatmapCell({
      availableWidth: PROFILE_320,
      columns: 5,
      gap: GAP,
      maxCell: 52,
    }) as number;
    expect(at320).toBe(47);
    expect(rowWidth(at320, 5, GAP)).toBeLessThanOrEqual(PROFILE_320);
    for (let width = 200; width <= 900; width += 1) {
      const cell = fitHeatmapCell({
        availableWidth: width,
        columns: 5,
        gap: GAP,
        maxCell: 52,
      }) as number;
      expect(cell).toBeLessThanOrEqual(52);
      expect(rowWidth(cell, 5, GAP)).toBeLessThanOrEqual(width);
    }
  });
});

describe("cellHitSlop — heatmap tap zones never overlap (D-42 B)", () => {
  const even = (gap: number) => ({
    left: gap,
    right: gap,
    top: gap,
    bottom: gap,
  });

  it("grows each side toward the 44dp target but never past half the gap", () => {
    // 13dp Year cell: wants 16dp per side; 4dp gaps allow 2, an 8dp gap 4.
    expect(
      cellHitSlop({
        edge: 13,
        gaps: { left: 4, right: 8, top: 4, bottom: 4 },
      }),
    ).toEqual({ left: 2, right: 4, top: 2, bottom: 2 });
    // A 42dp cell needs only 1dp per side to reach 44dp.
    expect(cellHitSlop({ edge: 42, gaps: even(8) })).toEqual(even(1));
    // An odd shortfall rounds up so the zone reaches the target.
    expect(cellHitSlop({ edge: 41, gaps: even(8) })).toEqual(even(2));
  });

  it("adds nothing to a cell already at or above the target", () => {
    expect(cellHitSlop({ edge: 44, gaps: even(4) })).toEqual(even(0));
    expect(cellHitSlop({ edge: 52, gaps: even(4) })).toEqual(even(0));
  });

  it("never returns a negative inset, even for a zero or odd gap", () => {
    expect(cellHitSlop({ edge: 10, gaps: even(0) })).toEqual(even(0));
    expect(cellHitSlop({ edge: 10, gaps: even(5) })).toEqual(even(2));
    expect(cellHitSlop({ edge: 10, gaps: even(-3) })).toEqual(even(0));
  });

  it("honours an explicit target", () => {
    expect(cellHitSlop({ edge: 20, gaps: even(40), target: 30 })).toEqual(
      even(5),
    );
  });

  it("keeps facing insets within every gap for every fitted day/cycle edge, 200–900dp", () => {
    for (const { columns, maxCell } of [
      { columns: 7, maxCell: 38 },
      { columns: 5, maxCell: 52 },
    ]) {
      for (let width = 200; width <= 900; width += 1) {
        const edge = fitHeatmapCell({
          availableWidth: width,
          columns,
          gap: GAP,
          maxCell,
        });
        if (edge === null) throw new Error("unmeasured");
        const slop = cellHitSlop({ edge, gaps: even(GAP) });
        // Horizontal neighbours: my right + their left; vertical likewise.
        expect(slop.right + slop.left).toBeLessThanOrEqual(GAP);
        expect(slop.bottom + slop.top).toBeLessThanOrEqual(GAP);
        // As large as the gap allows toward 44dp.
        const want = Math.ceil(Math.max(0, 44 - edge) / 2);
        expect(slop.left).toBe(Math.min(want, Math.floor(GAP / 2)));
      }
    }
  });

  it("keeps the Year week-boundary zones apart across the wider 8dp gap", () => {
    const weekGap = SPACING.sm;
    const lastOfWeek = cellHitSlop({
      edge: 13,
      gaps: { left: GAP, right: weekGap, top: GAP, bottom: GAP },
    });
    const firstOfNext = cellHitSlop({
      edge: 13,
      gaps: { left: weekGap, right: GAP, top: GAP, bottom: GAP },
    });
    expect(lastOfWeek.right + firstOfNext.left).toBeLessThanOrEqual(weekGap);
    expect(lastOfWeek.right).toBe(weekGap / 2);
  });
});
