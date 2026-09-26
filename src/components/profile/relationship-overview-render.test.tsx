import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ProfileSnapshot } from "@/db/profile-read";
import type { ProfileLayoutDocument } from "@/profile/types";
import { RelationshipOverview } from "./RelationshipOverview";

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: <T,>(factory: () => T) => factory(),
  useState: <T,>(value: T) => [value, vi.fn()] as const,
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: "View",
  useWindowDimensions: () => ({ fontScale: 1 }),
}));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/GlassSurface", () => ({
  GlassSurface: "GlassSurface",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: { gravityTiers: [], borderStrong: "token" } }),
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

function all(nodes: readonly Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

const snapshot = {
  identity: { intervalDays: 30, trackingEnabled: 1, snoozeUntil: null },
  metrics: {
    status: { label: "Steady", context: "6 of 30 days" },
    gravity: { available: false, label: "Unknown", context: "No history" },
    intensity: { label: "Quiet", window: { label: "This month" } },
  },
  history: { status: "ready", data: { summary: { text: "2 days ago" } } },
} as unknown as ProfileSnapshot;

const modules = [
  { id: "orbit-status", visible: true, expanded: false, size: "2x1" },
  { id: "last-interaction", visible: true, expanded: false, size: "2x1" },
] as unknown as ProfileLayoutDocument["overview"];

function tile(onOpenHistory?: () => void): Node | undefined {
  return all(
    resolve(
      RelationshipOverview({
        snapshot,
        modules,
        onOpenSheet: vi.fn(),
        onOpenHistory,
      }),
    ),
  ).find((node) => node.props.testID === "profile-overview-last-interaction");
}

// 38.3 RG-021 (D-10, D-11): the Last Interaction tile is an action only when
// the Profile can reveal its History section; otherwise it is information.
describe("RelationshipOverview Last Interaction tile", () => {
  it("is a button that reveals History when History is available", () => {
    const onOpenHistory = vi.fn();
    const node = tile(onOpenHistory);
    expect(node?.type).toBe("Pressable");
    expect(node?.props.accessibilityRole).toBe("button");
    expect(node?.props.onPress).toBe(onOpenHistory);
  });

  it("is informational only when the layout hides History (D-11)", () => {
    const node = tile(undefined);
    expect(node?.type).toBe("View");
    expect(node?.props.accessibilityRole).toBeUndefined();
    expect(node?.props.onPress).toBeUndefined();
    expect(node?.props.accessibilityLabel).toBe("Last Interaction. 2 days ago");
  });

  it("keeps the other tiles as sheet buttons either way", () => {
    const status = all(
      resolve(
        RelationshipOverview({ snapshot, modules, onOpenSheet: vi.fn() }),
      ),
    ).find((node) => node.props.testID === "profile-overview-orbit-status");
    expect(status?.type).toBe("Pressable");
    expect(status?.props.accessibilityRole).toBe("button");
  });
});
