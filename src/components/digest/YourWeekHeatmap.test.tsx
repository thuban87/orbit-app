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
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));

const { YourWeekHeatmap, weekdayColumnLabels } = await import(
  "./YourWeekHeatmap"
);
const COLORS = THEME_PRESETS.galaxy.dark;

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

/** A real Sunday-to-Saturday week (Sep 13–19, 2026). */
const SEPT_WEEK: HistoryWindow = {
  lens: "7days",
  ref: "2026-09-19",
  start: "2026-09-13",
  end: "2026-09-19",
  cells: [13, 14, 15, 16, 17, 18, 19].map((day) => ({
    date: `2026-09-${day}`,
    isPlaceholder: false,
    isFuture: false,
  })),
};

/** The weekday label texts in column order. */
function labelTexts(tree: TestElement[]): TestElement[] {
  const row = tree.find(
    (node) => node.props.testID === "your-week-heatmap-labels",
  );
  return nodes(row?.props.children as ReactNode).filter(
    (node) => node.type === "AppText",
  );
}

const cell = (date: string | null, isPlaceholder = false) => ({
  date,
  isPlaceholder,
  isFuture: false,
});

describe("weekdayColumnLabels (38.13 D-47)", () => {
  it("labels each column with the weekday of its first real date", () => {
    expect(
      weekdayColumnLabels([
        [
          "2026-10-14",
          "2026-10-15",
          "2026-10-16",
          "2026-10-17",
          "2026-10-18",
          "2026-10-19",
          "2026-10-20",
        ].map((date) => cell(date)),
      ]),
    ).toEqual(["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"]);
  });

  it("names a placeholder column from the neighbouring real date", () => {
    // Oct 1, 2026 is a Thursday; the two leading placeholders are Tue and Wed.
    const first = [
      cell(null, true),
      cell(null, true),
      cell("2026-10-01"),
      cell("2026-10-02"),
      cell("2026-10-03"),
      cell("2026-10-04"),
      cell("2026-10-05"),
    ];
    expect(weekdayColumnLabels([first])).toEqual([
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
      "Mon",
    ]);
  });

  it("takes a column's weekday from a later row when its first row is a placeholder", () => {
    // Oct 31, 2026 is a Saturday; trailing placeholders follow in row one.
    const rows = [
      [
        cell("2026-10-25"),
        cell("2026-10-26"),
        cell("2026-10-27"),
        cell("2026-10-28"),
        cell("2026-10-29"),
        cell("2026-10-30"),
        cell("2026-10-31"),
      ],
      [
        cell(null, true),
        cell(null, true),
        cell(null, true),
        cell(null, true),
        cell(null, true),
        cell(null, true),
        cell(null, true),
      ],
    ];
    expect(weekdayColumnLabels(rows)).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
  });

  it("returns blank labels when no column has a real date", () => {
    expect(weekdayColumnLabels([[cell(null, true)]])).toEqual([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  });
});

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
      expect.objectContaining({ alignSelf: "center" }),
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

  it("marks the selected real day by border, accessibility state and a bold underlined weekday label (38.13 D-47)", () => {
    const tree = nodes(
      YourWeekHeatmap({
        window: SEPT_WEEK,
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
    // The non-colour cue: Friday's column label is bold (label role) with a
    // 2dp underline bar; every other label is a regular caption with no bar.
    const labels = labelTexts(tree);
    expect(labels.map((label) => label.props.role)).toEqual([
      "caption",
      "caption",
      "caption",
      "caption",
      "caption",
      "label",
      "caption",
    ]);
    const bars = tree.filter(
      (node) => node.props.testID === "your-week-heatmap-label-selected",
    );
    expect(bars).toHaveLength(1);
    expect(bars[0].props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ height: 2 }),
        expect.objectContaining({ backgroundColor: COLORS.textPrimary }),
      ]),
    );
    const fridayColumn = tree.find(
      (node) => node.props.testID === "your-week-heatmap-label-5",
    );
    expect(
      nodes(fridayColumn?.props.children as ReactNode).some(
        (node) => node.props.testID === "your-week-heatmap-label-selected",
      ),
    ).toBe(true);
  });

  it("an unselected heatmap has no bold label and no underline bar", () => {
    const tree = nodes(
      YourWeekHeatmap({
        window: SEPT_WEEK,
        counts: new Map(),
        selectedDate: null,
        onSelectDay: vi.fn(),
      }),
    );
    expect(
      labelTexts(tree).every((label) => label.props.role === "caption"),
    ).toBe(true);
    expect(
      tree.some(
        (node) => node.props.testID === "your-week-heatmap-label-selected",
      ),
    ).toBe(false);
  });

  it("renders one hidden weekday label row over the columns without resizing cells (D-47, ADR-174)", () => {
    measuredWidth = 379;
    const tree = nodes(
      YourWeekHeatmap({
        window: SEPT_WEEK,
        counts: new Map(),
        selectedDate: null,
        onSelectDay: vi.fn(),
      }),
    );
    const rows = tree.filter(
      (node) => node.props.testID === "your-week-heatmap-labels",
    );
    expect(rows).toHaveLength(1);
    const labelRow = rows[0];
    expect(labelRow.props.accessibilityElementsHidden).toBe(true);
    expect(labelRow.props.importantForAccessibility).toBe(
      "no-hide-descendants",
    );
    const grid = tree.find(
      (node) => node.props.testID === "your-week-heatmap-grid",
    );
    // The label row is the grid's first child, so it shares the grid's
    // centring and the row gap.
    const gridChildren = grid?.props.children as unknown[];
    expect((gridChildren[0] as TestElement).props.testID).toBe(
      "your-week-heatmap-labels",
    );
    expect(labelTexts(tree).map((label) => label.props.children)).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    for (const label of labelTexts(tree)) {
      expect(label.props.style).toEqual(
        expect.objectContaining({ color: COLORS.textSecondary }),
      );
    }
    for (let column = 0; column < 7; column += 1) {
      const slot = tree.find(
        (node) => node.props.testID === `your-week-heatmap-label-${column}`,
      );
      expect(slot?.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ width: 50 })]),
      );
    }
    const cell = tree.find(
      (node) => node.props.testID === "your-week-heatmap-cell-2026-09-13",
    );
    expect(cell?.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 50, height: 50 }),
      ]),
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
