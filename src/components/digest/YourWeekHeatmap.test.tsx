import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";
import type { HistoryWindow } from "@/services/history/window";

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
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
      expect.arrayContaining([
        expect.objectContaining({ borderWidth: 2 }),
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
