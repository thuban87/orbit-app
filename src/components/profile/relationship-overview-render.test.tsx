import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ProfileSnapshot } from "@/db/profile-read";
import { INDEFINITE_SNOOZE_UNTIL } from "@/db/snooze-dao";
import type { ProfileLayoutDocument } from "@/profile/types";
import { formatDisplayDateOrFallback } from "@/utils/dates";
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

// 38.12 D-37, D-96: the Snooze tile reads the EFFECTIVE (unexpired) snooze and
// words an indefinite snooze without a date.
describe("RelationshipOverview Snooze tile (38.12 D-37, D-96)", () => {
  const snoozeModule = [
    { id: "snooze", visible: true, expanded: false, size: "1x1" },
  ] as unknown as ProfileLayoutDocument["overview"];
  const TODAY = "2026-10-17";

  function snoozeTile(snoozeUntil: string | null): Node | undefined {
    return all(
      resolve(
        RelationshipOverview({
          snapshot: {
            ...snapshot,
            identity: { ...snapshot.identity, snoozeUntil },
          } as ProfileSnapshot,
          modules: snoozeModule,
          onOpenSheet: vi.fn(),
          todayLocal: TODAY,
        }),
      ),
    ).find((node) => node.props.testID === "profile-overview-snooze");
  }

  it("shows Snoozed · until you turn it off for an indefinite snooze", () => {
    expect(snoozeTile(INDEFINITE_SNOOZE_UNTIL)?.props.accessibilityLabel).toBe(
      "Snooze. Snoozed · until you turn it off",
    );
  });

  it("keeps the dated wording for a future snooze", () => {
    expect(snoozeTile("2026-11-01")?.props.accessibilityLabel).toBe(
      `Snooze. Snoozed until ${formatDisplayDateOrFallback("2026-11-01")}`,
    );
  });

  it("shows an expired snooze as not snoozed", () => {
    for (const until of ["2026-10-17", "2026-10-01"]) {
      expect(snoozeTile(until)?.props.accessibilityLabel, until).toBe(
        "Snooze. Not snoozed",
      );
    }
  });
});

// 38.12 D-94: no Snooze tile while Unbound or in the Bin; it returns on Bind.
// The stored snooze is left as data.
describe("RelationshipOverview Snooze tile by participation (38.12 D-94)", () => {
  const snoozeModule = [
    { id: "snooze", visible: true, expanded: false, size: "1x1" },
    { id: "orbit-status", visible: true, expanded: false, size: "2x1" },
  ] as unknown as ProfileLayoutDocument["overview"];

  function tiles(identity: {
    trackingEnabled: number;
    archivedAt: string | null;
  }): string[] {
    return all(
      resolve(
        RelationshipOverview({
          snapshot: {
            ...snapshot,
            identity: {
              ...snapshot.identity,
              ...identity,
              snoozeUntil: "2099-01-01",
            },
          } as ProfileSnapshot,
          modules: snoozeModule,
          onOpenSheet: vi.fn(),
          todayLocal: "2026-10-17",
        }),
      ),
    )
      .map((node) => String(node.props.testID ?? ""))
      .filter((id) => id.startsWith("profile-overview-"));
  }

  it("hides the tile for an Unbound contact, even with a stored snooze", () => {
    expect(tiles({ trackingEnabled: 0, archivedAt: null })).toEqual([
      "profile-overview-orbit-status",
    ]);
  });

  it("hides the tile for a binned contact, Bound or Unbound", () => {
    for (const trackingEnabled of [1, 0]) {
      expect(
        tiles({ trackingEnabled, archivedAt: "2026-10-01 09:00:00" }),
      ).not.toContain("profile-overview-snooze");
    }
  });

  it("shows the tile for a live Bound contact", () => {
    expect(tiles({ trackingEnabled: 1, archivedAt: null })).toContain(
      "profile-overview-snooze",
    );
  });
});
