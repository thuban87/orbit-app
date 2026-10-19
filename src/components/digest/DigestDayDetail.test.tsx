import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { formatDisplayDate } from "@/utils/dates";

vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
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

const { DigestDayDetail, groupEventRowLabel } = await import(
  "./DigestDayDetail"
);

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  // Expand local function components (the row shell); mocked primitives are
  // strings and stay leaves.
  if (typeof element.type === "function") {
    return nodes(
      (element.type as (props: Record<string, unknown>) => ReactNode)(
        element.props,
      ),
    );
  }
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
// 38.9 D-48: the day shows in the weekday display form ("Fri, Sep 18"; the
// year appears only outside the current year, so it is computed here).
const DAY_TEXT = formatDisplayDate(DATE, { weekday: true });

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
              contactPhoto: null,
            },
            {
              kind: "interaction",
              id: 8,
              occurredAt: "2026-09-18 12:00:00",
              title: null,
              contactId: 2,
              contactName: "Lin",
              contactPhoto: "avatars/contact-2.jpg",
            },
            {
              kind: "interaction",
              id: 9,
              occurredAt: "2026-09-18 10:00:00",
              title: null,
              contactId: 3,
              contactName: "Noor",
              contactPhoto: null,
            },
          ],
        },
        onRetry: vi.fn(),
        onOpenProfile: vi.fn(),
        onOpenEvent: vi.fn(),
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
    const avatars = tree.filter((node) => node.type === "Avatar");
    expect(avatars).toHaveLength(2);
    expect(avatars[0]?.props.name).toBe("Lin");
    expect(text(tree)).not.toContain("No activity");
  });

  it("passes each interaction contact's stored photo to its Avatar; null keeps initials (38.6 D-02/D-14)", () => {
    const tree = nodes(
      DigestDayDetail({
        date: DATE,
        state: {
          status: "loaded",
          date: DATE,
          rows: [
            {
              kind: "interaction",
              id: 8,
              occurredAt: "2026-09-18 12:00:00",
              title: null,
              contactId: 2,
              contactName: "Lin",
              contactPhoto: "avatars/contact-2.jpg",
            },
            {
              kind: "interaction",
              id: 9,
              occurredAt: "2026-09-18 10:00:00",
              title: null,
              contactId: 3,
              contactName: "Noor",
              contactPhoto: null,
            },
          ],
        },
        onRetry: vi.fn(),
        onOpenProfile: vi.fn(),
        onOpenEvent: vi.fn(),
      }),
    );
    const avatars = tree.filter((node) => node.type === "Avatar");
    expect(
      avatars.map((node) => [
        node.props.name,
        node.props.contactId,
        node.props.photo,
      ]),
    ).toEqual([
      ["Lin", 2, "avatars/contact-2.jpg"],
      ["Noor", 3, null],
    ]);
  });

  it("shows 'No activity on this date.' only after a successful empty read", () => {
    const tree = nodes(
      DigestDayDetail({
        date: DATE,
        state: { status: "loaded", date: DATE, rows: [] },
        onRetry: vi.fn(),
        onOpenProfile: vi.fn(),
        onOpenEvent: vi.fn(),
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
        onOpenProfile: vi.fn(),
        onOpenEvent: vi.fn(),
      }),
    );
    const indicator = tree.find((node) => node.type === "ActivityIndicator");
    expect(indicator?.props.accessibilityLabel).toBe(
      `Loading activity for ${DAY_TEXT}`,
    );
    expect(indicator?.props.color).toBe(THEME_PRESETS.galaxy.dark.accentText);
    expect(DAY_TEXT.startsWith("Fri, Sep 18")).toBe(true);
    expect(text(tree)).toContain(DAY_TEXT);
    expect(text(tree)).not.toContain(DATE);
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
        onOpenProfile: vi.fn(),
        onOpenEvent: vi.fn(),
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

  it("renders row times at minute precision in 12-hour AM/PM, in text and labels (RG-038)", () => {
    const row = (id: number, occurredAt: string) => ({
      kind: "interaction" as const,
      id,
      occurredAt,
      title: null,
      contactId: id,
      contactName: `C${id}`,
      contactPhoto: null,
    });
    const tree = nodes(
      DigestDayDetail({
        date: DATE,
        state: {
          status: "loaded",
          date: DATE,
          rows: [
            row(1, "2026-09-18 00:00:00"),
            row(2, "2026-09-18 12:00:00"),
            row(3, "2026-09-18 23:59:59"),
            row(4, "2026-09-18 09:05:59"),
            row(5, "2026-09-18 09:06:00"),
            row(6, "garbage"),
          ],
        },
        onRetry: vi.fn(),
        onOpenProfile: vi.fn(),
        onOpenEvent: vi.fn(),
      }),
    );
    const expected: Record<number, string> = {
      1: "12:00 AM",
      2: "12:00 PM",
      3: "11:59 PM",
      4: "9:05 AM",
      5: "9:06 AM",
      6: "Unknown time",
    };
    const body = text(tree);
    for (const [id, clock] of Object.entries(expected)) {
      expect(body).toContain(clock);
      expect(
        tree.find(
          (node) => node.props.testID === `digest-day-detail-interaction-${id}`,
        )?.props.accessibilityLabel,
      ).toBe(`Interaction with C${id}, ${clock}`);
    }
    expect(body).not.toMatch(/\b(00|23|09):\d{2}\b/);
    expect(body).not.toContain("garbage");
  });
});

describe("day-detail rows open their destination (38.13 D-46)", () => {
  function renderRows() {
    const onOpenProfile = vi.fn();
    const onOpenEvent = vi.fn();
    const tree = nodes(
      DigestDayDetail({
        date: DATE,
        state: {
          status: "loaded",
          date: DATE,
          rows: [
            {
              kind: "group_event",
              id: 3,
              occurredAt: "2026-09-18 19:00:00",
              title: "Book club",
              contactId: null,
              contactName: null,
              contactPhoto: null,
            },
            {
              kind: "interaction",
              id: 8,
              occurredAt: "2026-09-18 12:00:00",
              title: null,
              contactId: 7,
              contactName: "Lin",
              contactPhoto: null,
            },
            {
              kind: "interaction",
              id: 9,
              occurredAt: "2026-09-18 10:00:00",
              title: null,
              contactId: null,
              contactName: null,
              contactPhoto: null,
            },
          ],
        },
        onRetry: vi.fn(),
        onOpenProfile,
        onOpenEvent,
      }),
    );
    const row = (id: string) => {
      const found = tree.find(
        (node) => node.props.testID === `digest-day-detail-${id}`,
      );
      if (!found) throw new Error(`Missing row ${id}`);
      return found;
    };
    return { tree, row, onOpenProfile, onOpenEvent };
  }

  it("an interaction row with a contact is a button that opens that person's Profile", () => {
    const { row, onOpenProfile, onOpenEvent } = renderRows();
    const interaction = row("interaction-8");
    expect(interaction.type).toBe("Pressable");
    expect(interaction.props.accessibilityRole).toBe("button");
    expect(interaction.props.accessibilityLabel).toBe(
      "Interaction with Lin, 12:00 PM",
    );
    (interaction.props.onPress as () => void)();
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
    expect(onOpenProfile).toHaveBeenCalledWith(7);
    expect(onOpenEvent).not.toHaveBeenCalled();
  });

  it("a group-event row is a button that opens that event", () => {
    const { row, onOpenProfile, onOpenEvent } = renderRows();
    const event = row("group-event-3");
    expect(event.type).toBe("Pressable");
    expect(event.props.accessibilityRole).toBe("button");
    expect(event.props.accessibilityLabel).toBe("Event, Book club, 7:00 PM");
    (event.props.onPress as () => void)();
    expect(onOpenEvent).toHaveBeenCalledTimes(1);
    expect(onOpenEvent).toHaveBeenCalledWith(3);
    expect(onOpenProfile).not.toHaveBeenCalled();
  });

  it("an interaction row with no contact stays an inert View", () => {
    const { row } = renderRows();
    const orphan = row("interaction-9");
    expect(orphan.type).toBe("View");
    expect(orphan.props.onPress).toBeUndefined();
    expect(orphan.props.accessibilityRole).toBeUndefined();
    expect(orphan.props.accessibilityLabel).toBe(
      "Interaction with Unknown contact, 10:00 AM",
    );
  });
});

describe("event row TalkBack label (38.9 review WR-05)", () => {
  it("names a titled event once with its title", () => {
    expect(groupEventRowLabel("Book club", "7:30 PM")).toBe(
      "Event, Book club, 7:30 PM",
    );
  });

  it("never repeats the noun for an untitled event", () => {
    expect(groupEventRowLabel(null, "7:30 PM")).toBe("Event, 7:30 PM");
    expect(groupEventRowLabel("", "7:30 PM")).toBe("Event, 7:30 PM");
  });
});
