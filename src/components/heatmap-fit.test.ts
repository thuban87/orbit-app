import { describe, expect, it } from "vitest";
import { fitHeatmapCell } from "@/components/heatmap-fit";
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
