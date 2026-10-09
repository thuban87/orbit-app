import { readFileSync } from "node:fs";
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
      today: "2026-10-08",
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
    today: "2026-10-08",
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

describe("ActivityHeatmap tap zones never overlap (D-42 B)", () => {
  const even = (n: number) => ({ left: n, right: n, top: n, bottom: n });

  it("caps day-lens cell hitSlop at half the 4dp gap", () => {
    measuredWidth = 254; // 32dp cells
    const nodes = all(resolve(ActivityHeatmap(props({}))));
    const cell = nodes.find(
      (node) => node.props.testID === "activity-heatmap-cell-2026-01-01",
    );
    expect(cell?.props.hitSlop).toEqual(even(2));
  });

  it("gives Cycles cells no slop at 44dp+ and a capped slop when narrow", () => {
    measuredWidth = 254; // 47dp cells
    const wide = all(
      resolve(
        ActivityHeatmap(
          props({ lens: "cycles", window: null, cycles: CYCLES }),
        ),
      ),
    );
    expect(
      wide.find((node) => node.props.testID === "activity-heatmap-cycle-0")
        ?.props.hitSlop,
    ).toEqual(even(0));
    measuredWidth = 200; // floor((200 − 16) / 5) = 36dp cells
    const narrow = all(
      resolve(
        ActivityHeatmap(
          props({ lens: "cycles", window: null, cycles: CYCLES }),
        ),
      ),
    );
    expect(
      narrow.find((node) => node.props.testID === "activity-heatmap-cycle-0")
        ?.props.hitSlop,
    ).toEqual(even(2));
  });

  it("widens only the Year week-boundary sides to half the 8dp week gap", () => {
    const cells = [
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
      "2026-01-09",
      "2026-01-10",
      "2026-01-11",
      "2026-01-12",
      "2026-01-13",
      "2026-01-14",
    ].map((date) => ({ date, isPlaceholder: false, isFuture: false }));
    const nodes = all(
      resolve(
        ActivityHeatmap(
          props({
            lens: "year",
            window: { ...DAY_WINDOW, lens: "year", cells },
          }),
        ),
      ),
    );
    const slopOf = (date: string) =>
      nodes.find(
        (node) => node.props.testID === `activity-heatmap-cell-${date}`,
      )?.props.hitSlop;
    expect(slopOf("2026-01-01")).toEqual(even(2));
    expect(slopOf("2026-01-07")).toEqual({
      left: 2,
      right: 4,
      top: 2,
      bottom: 2,
    });
    expect(slopOf("2026-01-08")).toEqual({
      left: 4,
      right: 2,
      top: 2,
      bottom: 2,
    });
    expect(slopOf("2026-01-14")).toEqual(even(2));
  });

  it("derives every cell slop from cellHitSlop, not the old symmetric rule", () => {
    const source = readFileSync(
      new URL("./ActivityHeatmap.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("hitSlopFor");
    expect(source).not.toMatch(/\(44 - edge\) \/ 2/);
    expect(source.match(/cellHitSlop\(/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

// 38.8 D-72 (G1): the grid renders only once the width is measured, so the
// heatmap reports "laid out" only from a layout seen with a measured width —
// never the first, grid-less one. An expanding History reveal settles on it.
describe("ActivityHeatmap reports its measured layout (D-72)", () => {
  const layoutEvent = { nativeEvent: { layout: { width: 254 } } };
  const rootLayout = (onLaidOut: () => void) => {
    const nodes = all(resolve(ActivityHeatmap(props({ onLaidOut }))));
    const root = nodes.find((node) => node.props.testID === "activity-heatmap");
    return root?.props.onLayout as (event: unknown) => void;
  };

  it("does not report the first, unmeasured layout", () => {
    measuredWidth = 0;
    const onLaidOut = vi.fn();
    rootLayout(onLaidOut)(layoutEvent);
    expect(onLaidOut).not.toHaveBeenCalled();
  });

  it("reports a layout once the grid has its measured width", () => {
    measuredWidth = 254;
    const onLaidOut = vi.fn();
    rootLayout(onLaidOut)(layoutEvent);
    expect(onLaidOut).toHaveBeenCalledTimes(1);
  });
});

describe("ActivityHeatmap cell labels pluralise the count (review WR-02)", () => {
  const label = (nodes: Node[], id: string) =>
    nodes.find((node) => node.props.testID === id)?.props.accessibilityLabel;

  it("reads 1 interaction, never 1 interactions, on a day cell", () => {
    measuredWidth = 254;
    const nodes = all(
      resolve(
        ActivityHeatmap(
          props({
            counts: new Map([
              ["2026-01-01", 1],
              ["2026-01-02", 2],
            ]),
          }),
        ),
      ),
    );
    expect(label(nodes, "activity-heatmap-cell-2026-01-01")).toBe(
      "Jan 1, 1 interaction",
    );
    expect(label(nodes, "activity-heatmap-cell-2026-01-02")).toBe(
      "Jan 2, 2 interactions",
    );
    expect(label(nodes, "activity-heatmap-cell-2026-01-03")).toBe(
      "Jan 3, 0 interactions",
    );
  });

  it("reads 1 interaction, never 1 interactions, on a cycle cell", () => {
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
    expect(label(nodes, "activity-heatmap-cycle-1")).toBe(
      "Feb 1 – Feb 10, 1 interaction",
    );
    expect(label(nodes, "activity-heatmap-cycle-0")).toBe(
      "Jan 1 – Jan 10, 0 interactions",
    );
    expect(label(nodes, "activity-heatmap-cycle-4")).toBe(
      "May 1 – May 10, 4 interactions, Current cycle",
    );
  });
});

describe("ActivityHeatmap Cycles dates carry the year off the current year (D-70)", () => {
  const label = (nodes: Node[], id: string) =>
    nodes.find((node) => node.props.testID === id)?.props.accessibilityLabel;
  const titled = (nodes: Node[], text: string) =>
    nodes.some(
      (node) => node.type === "AppText" && node.props.children === text,
    );
  // A page from 2025 into 2026: blocks 0-2 wholly in 2025, block 3 crosses
  // the new year, block 4 wholly in 2026 (the current year).
  const SPANNING = {
    available: true as const,
    blocks: [
      { index: 0, start: "2025-09-01", end: "2025-09-30", isCurrent: false },
      { index: 1, start: "2025-10-01", end: "2025-10-30", isCurrent: false },
      { index: 2, start: "2025-10-31", end: "2025-11-29", isCurrent: false },
      { index: 3, start: "2025-12-20", end: "2026-01-18", isCurrent: false },
      { index: 4, start: "2026-01-19", end: "2026-02-17", isCurrent: true },
    ],
  };
  const render = (cycles: typeof SPANNING, today = "2026-10-08") =>
    all(
      resolve(
        ActivityHeatmap(
          props({
            lens: "cycles",
            window: null,
            cycles,
            cycleCounts: [0, 1, 2, 3, 4],
            today,
          }),
        ),
      ),
    );

  it("titles a page that is not wholly in the current year with both years", () => {
    expect(titled(render(SPANNING), "Sep 1, 2025 – Feb 17, 2026")).toBe(true);
  });

  it("labels each cycle cell with years unless its own span is wholly current-year", () => {
    const nodes = render(SPANNING);
    expect(label(nodes, "activity-heatmap-cycle-0")).toBe(
      "Sep 1, 2025 – Sep 30, 2025, 0 interactions",
    );
    expect(label(nodes, "activity-heatmap-cycle-3")).toBe(
      "Dec 20, 2025 – Jan 18, 2026, 3 interactions",
    );
    expect(label(nodes, "activity-heatmap-cycle-4")).toBe(
      "Jan 19 – Feb 17, 4 interactions, Current cycle",
    );
  });

  it("keeps month-day only when the whole page is in the current year", () => {
    const nodes = render(CYCLES);
    expect(titled(nodes, "Jan 1 – May 10")).toBe(true);
    expect(label(nodes, "activity-heatmap-cycle-1")).toBe(
      "Feb 1 – Feb 10, 1 interaction",
    );
  });

  it("decides the current year from the today prop", () => {
    const nodes = render(SPANNING, "2025-11-30");
    expect(label(nodes, "activity-heatmap-cycle-0")).toBe(
      "Sep 1 – Sep 30, 0 interactions",
    );
    expect(titled(nodes, "Sep 1, 2025 – Feb 17, 2026")).toBe(true);
  });
});

describe("ActivityHeatmap Cycles paging row (38.8 D-25)", () => {
  const find = (nodes: Node[], id: string) =>
    nodes.find((node) => node.props.testID === id);

  it("renders prev/next for available cycles, titled with the page span", () => {
    const nodes = all(
      resolve(
        ActivityHeatmap(
          props({
            lens: "cycles",
            window: null,
            cycles: CYCLES,
            canGoNext: true,
          }),
        ),
      ),
    );
    const prev = find(nodes, "activity-heatmap-prev");
    const next = find(nodes, "activity-heatmap-next");
    expect(prev?.props.accessibilityLabel).toBe("Previous cycles");
    expect(next?.props.accessibilityLabel).toBe("Next cycles");
    expect(next?.props.accessibilityState).toEqual({ disabled: false });
    const title = nodes.find(
      (node) =>
        node.type === "AppText" && node.props.children === "Jan 1 – May 10",
    );
    expect(title).toBeDefined();
  });

  it("disables next on the page that ends today", () => {
    const nodes = all(
      resolve(
        ActivityHeatmap(
          props({
            lens: "cycles",
            window: null,
            cycles: CYCLES,
            canGoNext: false,
          }),
        ),
      ),
    );
    const next = find(nodes, "activity-heatmap-next");
    expect(next?.props.accessibilityState).toEqual({ disabled: true });
    expect(next?.props.disabled).toBe(true);
  });

  it("has no nav row for unavailable cycles and shows the unavailable caption", () => {
    const nodes = all(
      resolve(
        ActivityHeatmap(
          props({
            lens: "cycles",
            window: null,
            cycles: { available: false },
          }),
        ),
      ),
    );
    expect(find(nodes, "activity-heatmap-prev")).toBeUndefined();
    expect(find(nodes, "activity-heatmap-next")).toBeUndefined();
    expect(find(nodes, "activity-heatmap-cycles-unavailable")).toBeDefined();
  });

  it("keeps the day-lens labels", () => {
    const nodes = all(resolve(ActivityHeatmap(props({}))));
    expect(find(nodes, "activity-heatmap-prev")?.props.accessibilityLabel).toBe(
      "Previous period",
    );
    expect(find(nodes, "activity-heatmap-next")?.props.accessibilityLabel).toBe(
      "Next period",
    );
  });
});

describe("ActivityHeatmap no-cadence fallback note (38.8 D-27)", () => {
  const NOTE_ID = "activity-heatmap-fallback-note";

  it("renders the note as a caption directly under the lens control", () => {
    const root = resolve(
      ActivityHeatmap(
        props({ lens: "month", fallbackNote: "Showing Month because." }),
      ),
    )[0];
    const lensIndex = root.children.findIndex(
      (node) => node.props.testID === "activity-heatmap-lens",
    );
    const note = root.children[lensIndex + 1];
    expect(note?.props.testID).toBe(NOTE_ID);
    expect(note?.type).toBe("AppText");
    expect(note?.props.role).toBe("caption");
    expect(note?.props.children).toBe("Showing Month because.");
  });

  it("renders no note when none is given", () => {
    for (const fallbackNote of [undefined, null]) {
      const nodes = all(resolve(ActivityHeatmap(props({ fallbackNote }))));
      expect(nodes.some((node) => node.props.testID === NOTE_ID)).toBe(false);
    }
  });
});

describe("ActivityHeatmap lens labels read in full (38.8 D-24)", () => {
  it("uses the compact density on the lens control only", () => {
    const nodes = all(
      resolve(
        ActivityHeatmap(
          props({ lens: "cycles", window: null, cycles: CYCLES }),
        ),
      ),
    );
    const lens = nodes.find(
      (node) => node.props.testID === "activity-heatmap-lens",
    );
    const preset = nodes.find(
      (node) => node.props.testID === "activity-heatmap-preset",
    );
    expect(lens?.type).toBe("SegmentedControl");
    expect(lens?.props.density).toBe("compact");
    expect(preset?.type).toBe("SegmentedControl");
    expect(preset?.props.density).toBeUndefined();
  });
});
