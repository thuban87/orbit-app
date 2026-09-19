import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

vi.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));

const { DigestDayDetail } = await import("./DigestDayDetail");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

describe("DigestDayDetail", () => {
  it("renders a multi-participant group event once and names interaction contacts", () => {
    const tree = nodes(
      DigestDayDetail({
        date: "2026-09-18",
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
  });
});
