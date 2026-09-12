import { describe, expect, it } from "vitest";
import {
  classifyCycleBlock,
  classifyHeatmapCell,
} from "@/components/history/heatmap-cell";
import type { WindowCell } from "@/services/history/window";

const real = (date: string): Pick<WindowCell, "date" | "isPlaceholder"> => ({
  date,
  isPlaceholder: false,
});
const placeholder: Pick<WindowCell, "date" | "isPlaceholder"> = {
  date: null,
  isPlaceholder: true,
};

describe("classifyHeatmapCell — structural blank vs real zero-count (review Plan-05 MEDIUM)", () => {
  it("classifies a structural placeholder as blank regardless of any count", () => {
    expect(classifyHeatmapCell(placeholder, 0, "month")).toEqual({
      kind: "blank",
    });
    // Even a nonsense positive count on a placeholder never becomes a scale level.
    expect(classifyHeatmapCell(placeholder, 5, "month")).toEqual({
      kind: "blank",
    });
  });

  it("classifies a REAL zero-count day as scale level 0 — NOT a blank", () => {
    const fill = classifyHeatmapCell(real("2026-03-04"), 0, "month");
    expect(fill).toEqual({ kind: "scale", level: 0 });
    // The two must be distinguishable so heatmapScale[0] never collides with
    // heatmapCellEmpty.
    expect(fill).not.toEqual({ kind: "blank" });
  });

  it("buckets rising day-lens counts to levels 1..3 (caps at 3)", () => {
    expect(classifyHeatmapCell(real("2026-03-05"), 1, "7days")).toEqual({
      kind: "scale",
      level: 1,
    });
    expect(classifyHeatmapCell(real("2026-03-06"), 2, "7days")).toEqual({
      kind: "scale",
      level: 2,
    });
    expect(classifyHeatmapCell(real("2026-03-07"), 9, "year")).toEqual({
      kind: "scale",
      level: 3,
    });
  });
});

describe("classifyCycleBlock — full 0..4 cycle ramp", () => {
  it("uses the cycle threshold table (caps at level 4)", () => {
    expect(classifyCycleBlock(0)).toEqual({ kind: "scale", level: 0 });
    expect(classifyCycleBlock(3)).toEqual({ kind: "scale", level: 3 });
    expect(classifyCycleBlock(12)).toEqual({ kind: "scale", level: 4 });
  });
});
