import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * 38.12-14 render test for Settings → Notifications (D-77, D-78, D-83, D-119,
 * D-130). The screen is called as a function with its hooks mocked; the shared
 * row and card are host strings so their props can be read.
 *
 * `useState` is answered in call order: settings, degraded, activePicker,
 * saveError, permission.
 */
const mocks = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
}));

vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useState: () => {
    const value = mocks.states[mocks.cursor % mocks.states.length];
    mocks.cursor += 1;
    return [value, vi.fn()];
  },
}));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: vi.fn() }));
vi.mock("@react-native-community/datetimepicker", () => ({
  default: "DateTimePicker",
}));
vi.mock("react-native", () => ({
  Linking: { openSettings: vi.fn() },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  OrbitSwitch: "OrbitSwitch",
  SettingsRow: "SettingsRow",
  SettingsSectionCard: "SettingsSectionCard",
}));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 0,
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => ({ id: "exec" }),
  localDateTime: () => "2026-10-17 12:00:00",
}));
vi.mock("@/db/app-settings-dao", () => ({
  getAppSettings: vi.fn(),
  updateAppSettings: vi.fn(),
}));
vi.mock("@/services/notifications/digest-schedule", () => ({
  reconcileDigestSchedule: vi.fn(),
}));
vi.mock("@/services/notifications/notification-schedule", () => ({
  reconcileSchedule: vi.fn(),
}));
vi.mock("@/services/notifications/permission", () => ({
  getNotificationPermission: vi.fn(),
  requestNotificationPermission: vi.fn(),
}));
vi.mock("@/stores/confirm-store", () => ({ notice: vi.fn() }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { SettingsNotificationsScreen } = await import(
  "./SettingsNotificationsScreen"
);

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

interface SettingsShape {
  notificationsEnabled: 0 | 1;
  decayEnabled: 0 | 1;
  birthdayEnabled: 0 | 1;
  birthdayUnboundEnabled: 0 | 1;
  digestEnabled: 0 | 1;
  lockscreenPublic: 0 | 1;
  deliveryHour: number;
  quietStartHour: number;
  quietEndHour: number;
}

const BASE_SETTINGS: SettingsShape = {
  notificationsEnabled: 1,
  decayEnabled: 1,
  birthdayEnabled: 1,
  birthdayUnboundEnabled: 1,
  digestEnabled: 1,
  lockscreenPublic: 0,
  deliveryHour: 9,
  quietStartHour: 21,
  quietEndHour: 8,
};

function render(
  overrides: Partial<SettingsShape> = {},
  degraded = false,
): TestElement[] {
  mocks.states = [
    { ...BASE_SETTINGS, ...overrides },
    degraded,
    null,
    null,
    { granted: true },
  ];
  mocks.cursor = 0;
  return nodes(SettingsNotificationsScreen());
}

function row(tree: TestElement[], title: string): TestElement {
  const found = tree.find(
    (n) => n.type === "SettingsRow" && n.props.title === title,
  );
  if (!found) throw new Error(`Missing row "${title}"`);
  return found;
}

function rowSwitch(element: TestElement): TestElement {
  return element.props.trailing as TestElement;
}

function texts(tree: TestElement[]): string[] {
  return tree.flatMap((n) =>
    typeof n.props.children === "string" ? [n.props.children] : [],
  );
}

const CHILD_ROWS = [
  "Check-in reminders",
  "Birthday alerts",
  "Birthday alerts for Unbound contacts",
  "Weekly digest",
  "Show names on lock screen",
] as const;

describe("SettingsNotificationsScreen (38.12-14)", () => {
  beforeEach(() => {
    mocks.cursor = 0;
  });

  it("master off: one paused line, every child row and switch disabled (D-77, D-06)", () => {
    const tree = render({ notificationsEnabled: 0 });
    const paused = tree.filter(
      (n) => n.props.testID === "settings-notifications-paused",
    );
    expect(paused).toHaveLength(1);
    expect(paused[0].props.children).toBe(
      "Notifications are paused. Turn on Allow notifications to get reminders.",
    );
    for (const title of CHILD_ROWS) {
      const r = row(tree, title);
      expect(r.props.disabled, title).toBe(true);
      expect(rowSwitch(r).props.disabled, title).toBe(true);
    }
    for (const title of [
      "Reminder time",
      "Quiet hours start",
      "Quiet hours end",
    ]) {
      expect(row(tree, title).props.disabled, title).toBe(true);
    }
  });

  it("master on: no paused line, child rows enabled", () => {
    const tree = render();
    expect(
      tree.some((n) => n.props.testID === "settings-notifications-paused"),
    ).toBe(false);
    for (const title of CHILD_ROWS) {
      expect(row(tree, title).props.disabled, title).toBe(false);
    }
  });

  it("the master description is the same text in both states (D-77)", () => {
    const off = row(render({ notificationsEnabled: 0 }), "Allow notifications");
    const on = row(render(), "Allow notifications");
    expect(off.props.subtitle).toBeTruthy();
    expect(off.props.subtitle).toBe(on.props.subtitle);
  });

  it("the degraded note replaces the paused line, never both", () => {
    const tree = render({ notificationsEnabled: 0 }, true);
    expect(
      tree.some((n) => n.props.testID === "settings-notifications-degraded"),
    ).toBe(true);
    expect(
      tree.some((n) => n.props.testID === "settings-notifications-paused"),
    ).toBe(false);
  });

  it("the Unbound birthday row is disabled until Birthday alerts is on (D-77, D-83)", () => {
    const off = row(
      render({ birthdayEnabled: 0 }),
      "Birthday alerts for Unbound contacts",
    );
    expect(off.props.disabled).toBe(true);
    expect(rowSwitch(off).props.disabled).toBe(true);
    expect(rowSwitch(off).props.accessibilityLabel).toBe(
      "Birthday alerts for Unbound contacts",
    );
    const on = row(render(), "Birthday alerts for Unbound contacts");
    expect(on.props.disabled).toBe(false);
    expect(rowSwitch(on).props.disabled).toBe(false);
    expect(rowSwitch(on).props.testID).toBe(
      "settings-notifications-birthday-unbound",
    );
  });

  it("the decay switch reads Check-in reminders and keeps its testID (D-130)", () => {
    const tree = render();
    const r = row(tree, "Check-in reminders");
    expect(rowSwitch(r).props.accessibilityLabel).toBe("Check-in reminders");
    expect(rowSwitch(r).props.testID).toBe("settings-notifications-decay");
    const all = [
      ...texts(tree),
      ...tree.map((n) => String(n.props.title ?? "")),
    ];
    expect(all.join("\n")).not.toContain("Decay reminders");
  });

  it("a reminder time inside quiet hours shows the real arrival time (D-78)", () => {
    const inside = row(
      render({ deliveryHour: 6, quietStartHour: 21, quietEndHour: 8 }),
      "Reminder time",
    );
    expect(inside.props.subtitle).toBe(
      "Reminders will arrive at 8:00 AM, after quiet hours end.",
    );
    expect(inside.props.testID).toBe("settings-notifications-time");
    const outside = row(render(), "Reminder time");
    expect(outside.props.subtitle).toBeNull();
    expect(outside.props.value).toBe("9:00 AM");
  });

  it("an evening reminder time in an overnight window warns about birthday alerts", () => {
    const evening = row(
      render({ deliveryHour: 22, quietStartHour: 21, quietEndHour: 8 }),
      "Reminder time",
    );
    expect(evening.props.subtitle).toBe(
      "Reminders will arrive at 8:00 AM, after quiet hours end. Birthday alerts can't move to the next day, so they won't be sent.",
    );
  });

  it("the quiet-hours helper describes what the scheduler does (D-78)", () => {
    const helper = render().find(
      (n) => n.props.testID === "settings-notifications-quiet-helper",
    );
    expect(helper?.props.children).toBe(
      "Reminders that fall inside quiet hours wait until quiet hours end. The weekly digest comes at your reminder time.",
    );
  });

  it("every section is a shared card and keeps its testIDs (D-119)", () => {
    const tree = render();
    expect(
      tree
        .filter((n) => n.type === "SettingsSectionCard")
        .map((n) => n.props.title),
    ).toEqual([
      "Notifications",
      "Relationship reminders",
      "Birthdays",
      "Weekly digest",
      "Delivery time",
      "Notification display",
    ]);
    const ids = new Set([
      ...tree.map((n) => n.props.testID),
      ...tree
        .filter((n) => n.type === "SettingsRow" && n.props.trailing)
        .map((n) => rowSwitch(n).props.testID),
    ]);
    for (const id of [
      "settings-notifications-section",
      "settings-notifications-master",
      "settings-notifications-permission",
      "settings-notifications-decay",
      "settings-notifications-birthday",
      "settings-notifications-birthday-unbound",
      "settings-notifications-digest",
      "settings-notifications-time",
      "settings-notifications-quiet-start",
      "settings-notifications-quiet-end",
      "settings-notifications-lockscreen",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});
