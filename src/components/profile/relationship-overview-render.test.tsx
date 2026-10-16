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
    gravity: {
      available: false,
      label: "No interactions yet",
      context: "Gravity builds as you log interactions.",
    },
    intensity: { label: "Quiet", window: { label: "This month" } },
  },
  history: {
    status: "ready",
    data: { summary: { text: "Sep 1, 2026, 9:00 AM" } },
  },
} as unknown as ProfileSnapshot;

const modules = [
  { id: "orbit-status", visible: true, expanded: false, size: "2x1" },
  { id: "last-interaction", visible: true, expanded: false, size: "2x1" },
  { id: "gravity", visible: true, expanded: false, size: "1x1" },
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
    // 38.11 D-75: the value is the date alone, never "Last interaction …".
    expect(node?.props.accessibilityLabel).toBe(
      "Last Interaction. Sep 1, 2026, 9:00 AM",
    );
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

describe("RelationshipOverview Gravity tile (38.11 D-74)", () => {
  it("reads No interactions yet with the plain context line", () => {
    const gravity = all(
      resolve(
        RelationshipOverview({ snapshot, modules, onOpenSheet: vi.fn() }),
      ),
    ).find((node) => node.props.testID === "profile-overview-gravity");
    expect(gravity?.props.accessibilityLabel).toBe(
      "Gravity. No interactions yet. Gravity builds as you log interactions.",
    );
  });
});

// 38.11 D-53/D-55: the Birthday tile shows the stored birthday through the
// 38.9 date standard, opens its sheet, and is absent (not a gap) when unset.
describe("RelationshipOverview Birthday tile (38.11 D-53, D-55)", () => {
  const withBirthdayModule = [
    { id: "contact-frequency", visible: true, expanded: false, size: "1x1" },
    { id: "birthday", visible: true, expanded: false, size: "1x1" },
    { id: "snooze", visible: true, expanded: false, size: "1x1" },
  ] as unknown as ProfileLayoutDocument["overview"];

  function render(birthday: string | null, onOpenSheet = vi.fn()) {
    return all(
      resolve(
        RelationshipOverview({
          snapshot: {
            ...snapshot,
            identity: { ...snapshot.identity, birthday },
          } as ProfileSnapshot,
          modules: withBirthdayModule,
          onOpenSheet,
        }),
      ),
    ).filter((node) =>
      String(node.props.testID ?? "").startsWith("profile-overview-"),
    );
  }

  it("shows the year when it is known and opens the Birthday sheet", () => {
    const onOpenSheet = vi.fn();
    const tiles = render("1990-05-03", onOpenSheet);
    const birthday = tiles.find(
      (node) => node.props.testID === "profile-overview-birthday",
    );
    expect(birthday?.type).toBe("Pressable");
    expect(birthday?.props.accessibilityLabel).toBe("Birthday. May 3, 1990");
    (birthday?.props.onPress as (() => void) | undefined)?.();
    expect(onOpenSheet).toHaveBeenCalledWith("birthday");
    // Factory order: after Contact Frequency, before Snooze (D-80).
    expect(tiles.map((node) => node.props.testID)).toEqual([
      "profile-overview-contact-frequency",
      "profile-overview-birthday",
      "profile-overview-snooze",
    ]);
  });

  it("shows the month and day alone when the year is unknown", () => {
    const birthday = render("12-31").find(
      (node) => node.props.testID === "profile-overview-birthday",
    );
    expect(birthday?.props.accessibilityLabel).toBe("Birthday. Dec 31");
  });

  it("renders no birthday tile when no birthday is set, and the grid repacks", () => {
    const tiles = render(null);
    expect(
      tiles.find((node) => node.props.testID === "profile-overview-birthday"),
    ).toBeUndefined();
    expect(tiles.map((node) => node.props.testID)).toEqual([
      "profile-overview-contact-frequency",
      "profile-overview-snooze",
    ]);
  });
});
