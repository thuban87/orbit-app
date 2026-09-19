import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [
    typeof value === "function" ? (value as () => unknown)() : value,
    vi.fn(),
  ],
}));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: vi.fn() }));
vi.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/SegmentedControl", () => ({
  SegmentedControl: "SegmentedControl",
}));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/digest/YourWeekHeatmap", () => ({
  YourWeekHeatmap: "YourWeekHeatmap",
}));
vi.mock("@/components/digest/DigestDayDetail", () => ({
  DigestDayDetail: "DigestDayDetail",
}));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: () => "2026-09-19 12:00:00",
}));
vi.mock("@/db/app-settings-dao", () => ({
  getAppSettings: vi.fn(),
  updateAppSettings: vi.fn(),
}));
vi.mock("@/db/your-week-read", () => ({
  readYourWeekMetrics: vi.fn(),
  readYourWeekDateCounts: vi.fn(),
  readYourWeekDay: vi.fn(),
}));
vi.mock("@/services/history/week-window", () => ({
  buildYourWeekWindow: vi.fn(),
  resolveFirstWeekday: vi.fn(),
}));
vi.mock("@/utils/dates", () => ({ formatLocalDate: () => "2026-09-19" }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { YourWeekSection } = await import("./YourWeekSection");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  if (typeof element.type === "function") {
    return nodes(
      (element.type as (props: Record<string, unknown>) => ReactNode)(
        element.props,
      ),
    );
  }
  return [element, ...nodes(element.props.children as ReactNode)];
}

describe("YourWeekSection", () => {
  it("renders informational metrics and the two-option period binding", () => {
    const tree = nodes(YourWeekSection());
    const toggle = tree.find((node) => node.type === "SegmentedControl");
    expect(toggle?.props.testID).toBe("your-week-period");
    expect(toggle?.props.value).toBe("rolling7");
    expect(toggle?.props.options).toEqual([
      { label: "Rolling 7 Days", value: "rolling7" },
      { label: "Calendar Week", value: "calendar_week" },
    ]);
    expect(typeof toggle?.props.onChange).toBe("function");
    expect(
      tree
        .map((node) => node.props.accessibilityLabel)
        .filter((label) => typeof label === "string"),
    ).toEqual(
      expect.arrayContaining([
        "People reached, 0",
        "Interactions, 0",
        "Events, 0",
      ]),
    );
  });
});
