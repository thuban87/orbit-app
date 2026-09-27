import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryWindow } from "@/services/history/window";
import { THEME_PRESETS } from "@/theme/theme-presets";

// The heatmap measures its width via onLayout into state (RG-033, D-13). The
// function is called directly here, so `useState` returns the test-controlled
// measured width.
let measuredWidth = 0;
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
  useState: () => [measuredWidth, vi.fn()],
}));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));

const { YourWeekHeatmap } = await import("./YourWeekHeatmap");

type TestElement = ReactElement<Record<string, unknown>>;

function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

const window: HistoryWindow = {
  lens: "7days",
  ref: "2026-09-19",
  start: "2026-09-13",
  end: "2026-09-19",
  cells: [
    { date: "2026-09-18", isPlaceholder: false, isFuture: false },
    { date: "2026-09-20", isPlaceholder: false, isFuture: true },
    { date: null, isPlaceholder: true, isFuture: false },
  ],
};

describe("YourWeekHeatmap", () => {
  beforeEach(() => {
    measuredWidth = 379;
  });

  it("renders no grid until the available width is measured (no jump)", () => {
    measuredWidth = 0;
    const tree = nodes(
      YourWeekHeatmap({
        window,
        counts: new Map(),
        selectedDate: null,
        onSelectDay: vi.fn(),
      }),
    );
    const wrapper = tree.find(
      (node) => node.props.testID === "your-week-heatmap",
    );
    expect(typeof wrapper?.props.onLayout).toBe("function");
    expect(
      tree.some((node) =>
        String(node.props.testID ?? "").startsWith("your-week-heatmap-cell-"),
      ),
    ).toBe(false);
    expect(
      tree.some((node) => node.props.testID === "your-week-heatmap-grid"),
    ).toBe(false);
  });

  it("sizes every cell from the measured width and centers the grid", () => {
    // 411dp window − 2·16 Digest padding = 379 → floor((379 − 24) / 7) = 50.
    measuredWidth = 379;
    const tree = nodes(
      YourWeekHeatmap({
        window,
        counts: new Map([["2026-09-18", 1]]),
        selectedDate: null,
        onSelectDay: vi.fn(),
      }),
    );
    const grid = tree.find(
      (node) => node.props.testID === "your-week-heatmap-grid",
    );
    expect(grid?.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ alignSelf: "center" }),
      ]),
    );
    const real = tree.find(
      (node) => node.props.testID === "your-week-heatmap-cell-2026-09-18",
    );
    expect(real?.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 50, height: 50 }),
      ]),
    );
    const blanks = tree.filter(
      (node) => node.props.importantForAccessibility === "no-hide-descendants",
    );
    for (const blank of blanks) {
      expect(blank.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ width: 50, height: 50 }),
        ]),
      );
    }
  });

  it("caps cells at MAX_CELL on wide screens", () => {
    measuredWidth = 900;
    const tree = nodes(
      YourWeekHeatmap({
        window,
        counts: new Map(),
        selectedDate: null,
        onSelectDay: vi.fn(),
      }),
    );
    const real = tree.find(
      (node) => node.props.testID === "your-week-heatmap-cell-2026-09-18",
    );
    expect(real?.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 56, height: 56 }),
      ]),
    );
  });

  it("marks the selected real day structurally and accessibly", () => {
    const tree = nodes(
      YourWeekHeatmap({
        window,
        counts: new Map([["2026-09-18", 2]]),
        selectedDate: "2026-09-18",
        onSelectDay: vi.fn(),
      }),
    );
    const selected = tree.find(
      (node) => node.props.testID === "your-week-heatmap-cell-2026-09-18",
    );
    expect(selected?.props.accessibilityState).toEqual({ selected: true });
    expect(selected?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ borderWidth: 2 })]),
    );
  });

  it("renders future and placeholder cells as non-interactive blanks", () => {
    const tree = nodes(
      YourWeekHeatmap({
        window,
        counts: new Map(),
        selectedDate: null,
        onSelectDay: vi.fn(),
      }),
    );
    const hidden = tree.filter(
      (node) => node.props.importantForAccessibility === "no-hide-descendants",
    );
    expect(hidden).toHaveLength(2);
    for (const cell of hidden) {
      expect(cell.type).toBe("View");
      expect(cell.props.accessibilityRole).toBeUndefined();
      expect(cell.props.onPress).toBeUndefined();
      expect(cell.props.onSelectDay).toBeUndefined();
    }
  });
});
