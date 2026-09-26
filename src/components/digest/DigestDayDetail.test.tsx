import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));

const { DigestDayDetail } = await import("./DigestDayDetail");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

function text(tree: TestElement[]): string {
  return tree
    .flatMap((node) => {
      const children = node.props.children;
      if (typeof children === "string") return [children];
      if (Array.isArray(children)) {
        return children.filter((c): c is string => typeof c === "string");
      }
      return [];
    })
    .join("\n");
}

const DATE = "2026-09-18";

describe("DigestDayDetail", () => {
  it("renders a multi-participant group event once and names interaction contacts", () => {
    const tree = nodes(
      DigestDayDetail({
        date: DATE,
        state: {
          status: "loaded",
          date: DATE,
          rows: [
            {
              kind: "group_event",
              id: 7,
              occurredAt: "2026-09-18 19:00:00",
              title: "Dinner with Ada and Grace",
              contactId: null,
              contactName: null,
            },
            {
              kind: "interaction",
              id: 8,
              occurredAt: "2026-09-18 12:00:00",
              title: null,
              contactId: 2,
              contactName: "Lin",
            },
          ],
        },
        onRetry: vi.fn(),
      }),
    );
    expect(
      tree.filter((node) =>
        String(node.props.testID).includes("group-event-7"),
      ),
    ).toHaveLength(1);
    expect(
      tree.find(
        (node) => node.props.testID === "digest-day-detail-interaction-8",
      )?.props.accessibilityLabel,
    ).toContain("Lin");
    expect(tree.find((node) => node.type === "Avatar")?.props.name).toBe("Lin");
    expect(text(tree)).not.toContain("No activity");
  });

  it("shows 'No activity on this date.' only after a successful empty read", () => {
    const tree = nodes(
      DigestDayDetail({
        date: DATE,
        state: { status: "loaded", date: DATE, rows: [] },
        onRetry: vi.fn(),
      }),
    );
    expect(text(tree)).toContain("No activity on this date.");
    expect(tree.some((node) => node.type === "ActivityIndicator")).toBe(false);
  });

  it("a pending read shows an inline indicator, never 'No activity'", () => {
    const tree = nodes(
      DigestDayDetail({
        date: DATE,
        state: { status: "loading", date: DATE, token: 1 },
        onRetry: vi.fn(),
      }),
    );
    const indicator = tree.find((node) => node.type === "ActivityIndicator");
    expect(indicator?.props.accessibilityLabel).toBe(
      `Loading activity for ${DATE}`,
    );
    expect(indicator?.props.color).toBe(THEME_PRESETS.galaxy.dark.accent);
    expect(text(tree)).toContain(DATE);
    expect(text(tree)).not.toContain("No activity");
    expect(tree.some((node) => node.type === "Button")).toBe(false);
  });

  it("a failed read shows \"Couldn't load this day\" with Retry, never 'No activity'", () => {
    const onRetry = vi.fn();
    const tree = nodes(
      DigestDayDetail({
        date: DATE,
        state: { status: "error", date: DATE },
        onRetry,
      }),
    );
    expect(text(tree)).toContain("Couldn't load this day");
    expect(text(tree)).not.toContain("No activity");
    const retry = tree.find((node) => node.type === "Button");
    expect(retry?.props.role).toBe("tertiary");
    expect(retry?.props.label).toBe("Retry");
    expect(retry?.props.accessibilityLabel).toBe("Retry loading this day");
    const onPress = retry?.props.onPress as (() => void) | undefined;
    onPress?.();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(tree.some((node) => node.type === "ActivityIndicator")).toBe(false);
  });
});
