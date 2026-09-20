import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { ActivityHeatmap } from "./ActivityHeatmap";

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: <T,>(factory: () => T) => factory(),
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

describe("ActivityHeatmap Year render", () => {
  it("uses a vertical week-row stack instead of a horizontal ScrollView", () => {
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
  });
});
