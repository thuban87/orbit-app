import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { ActivityHeatmap, type ActivityHeatmapProps } from "./ActivityHeatmap";

// The heatmap measures its width via onLayout into state (RG-033, D-13). The
// function is called directly here, so `useState` returns the test-controlled
// measured width.
let measuredWidth = 0;
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: <T,>(factory: () => T) => factory(),
  useState: () => [measuredWidth, vi.fn()],
}));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/SegmentedControl", () => ({
  SegmentedControl: "SegmentedControl",
}));

interface Node {
  type: string;
  props: Record<string, unknown>;
  children: Node[];
}

function resolve(node: ReactNode): Node[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(resolve);
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function") {
    return resolve(
      (element.type as (props: unknown) => ReactNode)(element.props),
    );
  }
  if (typeof element.type !== "string") return resolve(element.props.children);
  return [
    {
      type: element.type,
      props: element.props,
      children: resolve(element.props.children),
    },
  ];
}

function all(nodes: Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

beforeEach(() => {
  measuredWidth = 254;
});

describe("ActivityHeatmap Year render", () => {
  it("uses two whole weeks per vertical row instead of a horizontal ScrollView", () => {
    const tree = ActivityHeatmap({
      lens: "year",
      cycleCount: 10,
      window: {
        lens: "year",
        ref: "2026-01-01",
        start: "2026-01-01",
        end: "2026-01-03",
        cells: [
          { date: null, isPlaceholder: true, isFuture: false },
          { date: null, isPlaceholder: true, isFuture: false },
          { date: null, isPlaceholder: true, isFuture: false },
          { date: null, isPlaceholder: true, isFuture: false },
          { date: "2026-01-01", isPlaceholder: false, isFuture: false },
          { date: "2026-01-02", isPlaceholder: false, isFuture: false },
          { date: "2026-01-03", isPlaceholder: false, isFuture: false },
          { date: "2026-01-04", isPlaceholder: false, isFuture: false },
          { date: "2026-01-05", isPlaceholder: false, isFuture: false },
          { date: "2026-01-06", isPlaceholder: false, isFuture: false },
          { date: "2026-01-07", isPlaceholder: false, isFuture: false },
          { date: "2026-01-08", isPlaceholder: false, isFuture: false },
          { date: "2026-01-09", isPlaceholder: false, isFuture: false },
          { date: "2026-01-10", isPlaceholder: false, isFuture: false },
        ],
      },
      counts: new Map([["2026-01-01", 2]]),
      cycles: { available: false },
      cycleCounts: [],
      onLensChange: vi.fn(),
      onPresetChange: vi.fn(),
      onCellPress: vi.fn(),
      onPrev: vi.fn(),
      onNext: vi.fn(),
      canGoNext: false,
    });
    const nodes = all(resolve(tree));

    expect(
      nodes.find((node) => node.props.testID === "activity-heatmap-year-grid"),
    ).toBeDefined();
    expect(
      nodes.some(
        (node) => node.type === "ScrollView" && node.props.horizontal === true,
      ),
    ).toBe(false);
    expect(
      nodes.filter((node) =>
        String(node.props.testID).startsWith("activity-heatmap-year-week-0-"),
      ),
    ).toHaveLength(2);
  });
});

function flatStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map((entry) => flatStyle(entry)));
  }
  return (style ?? {}) as Record<string, unknown>;
}

const DAY_WINDOW = {
  lens: "7days" as const,
  ref: "2026-01-07",
  start: "2026-01-01",
  end: "2026-01-07",
  cells: [
    { date: "2026-01-01", isPlaceholder: false, isFuture: false },
    { date: "2026-01-02", isPlaceholder: false, isFuture: false },
    { date: "2026-01-03", isPlaceholder: false, isFuture: false },
    { date: "2026-01-04", isPlaceholder: false, isFuture: false },
    { date: "2026-01-05", isPlaceholder: false, isFuture: false },
    { date: "2026-01-06", isPlaceholder: false, isFuture: false },
    { date: null, isPlaceholder: true, isFuture: false },
  ],
};

function props(overrides: Partial<ActivityHeatmapProps>): ActivityHeatmapProps {
  return {
    lens: "7days",
    cycleCount: 5,
    window: DAY_WINDOW,
    counts: new Map(),
    cycles: { available: false },
    cycleCounts: [],
    onLensChange: vi.fn(),
    onPresetChange: vi.fn(),
    onCellPress: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    canGoNext: false,
    ...overrides,
  };
}

const CYCLES = {
  available: true as const,
  blocks: [0, 1, 2, 3, 4].map((index) => ({
    index,
    start: `2026-0${index + 1}-01`,
    end: `2026-0${index + 1}-10`,
    isCurrent: index === 4,
  })),
};

describe("ActivityHeatmap fit-to-width (RG-033 ui-accessibility/AUD-UIA-010, D-13)", () => {
  it("measures its width with onLayout and renders no day grid until measured", () => {
    measuredWidth = 0;
    const nodes = all(resolve(ActivityHeatmap(props({}))));
    const root = nodes.find((node) => node.props.testID === "activity-heatmap");
    expect(typeof root?.props.onLayout).toBe("function");
    expect(
      nodes.some((node) => node.props.testID === "activity-heatmap-day-grid"),
    ).toBe(false);
  });

  it("sizes day-lens cells from the measured width and centers the grid", () => {
    measuredWidth = 254; // 320dp window − 66dp Profile inset chain
    const nodes = all(resolve(ActivityHeatmap(props({}))));
    const grid = nodes.find(
      (node) => node.props.testID === "activity-heatmap-day-grid",
    );
    expect(flatStyle(grid?.props.style).alignSelf).toBe("center");
    const cell = nodes.find(
      (node) => node.props.testID === "activity-heatmap-cell-2026-01-01",
    );
    expect(flatStyle(cell?.props.style)).toMatchObject({
      width: 32,
      height: 32,
    });
  });

  it("caps day-lens cells at the lens MAX_CELL on wide screens", () => {
    measuredWidth = 900;
    const nodes = all(resolve(ActivityHeatmap(props({}))));
    const cell = nodes.find(
      (node) => node.props.testID === "activity-heatmap-cell-2026-01-01",
    );
    expect(flatStyle(cell?.props.style)).toMatchObject({
      width: 38,
      height: 38,
    });
  });

  it("sizes the 5-column cycle grid from the measured width and centers it", () => {
    measuredWidth = 254;
    const nodes = all(
      resolve(
        ActivityHeatmap(
          props({
            lens: "cycles",
            window: null,
            cycles: CYCLES,
            cycleCounts: [0, 1, 2, 3, 4],
          }),
        ),
      ),
    );
    const grid = nodes.find(
      (node) => node.props.testID === "activity-heatmap-cycles-grid",
    );
    const gridStyle = flatStyle(grid?.props.style);
    expect(gridStyle.alignSelf).toBe("center");
    // 5·47 + 4·4 = 251 ≤ 254 — exactly five per row, never overflowing.
    expect(gridStyle.width).toBe(251);
    const cell = nodes.find(
      (node) => node.props.testID === "activity-heatmap-cycle-0",
    );
    expect(flatStyle(cell?.props.style)).toMatchObject({
      width: 47,
      height: 47,
    });
  });

  it("renders no cycle grid until measured", () => {
    measuredWidth = 0;
    const nodes = all(
      resolve(
        ActivityHeatmap(
          props({ lens: "cycles", window: null, cycles: CYCLES }),
        ),
      ),
    );
    expect(
      nodes.some(
        (node) => node.props.testID === "activity-heatmap-cycles-grid",
      ),
    ).toBe(false);
  });

  it("leaves the dense Year lens at its fixed 13dp cell at any width", () => {
    for (const width of [0, 254, 900]) {
      measuredWidth = width;
      const nodes = all(
        resolve(
          ActivityHeatmap(
            props({ lens: "year", window: { ...DAY_WINDOW, lens: "year" } }),
          ),
        ),
      );
      const cell = nodes.find(
        (node) => node.props.testID === "activity-heatmap-cell-2026-01-01",
      );
      expect(flatStyle(cell?.props.style)).toMatchObject({
        width: 13,
        height: 13,
      });
    }
  });
});
