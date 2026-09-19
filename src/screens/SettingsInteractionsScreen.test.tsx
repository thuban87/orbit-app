import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

const mocks = vi.hoisted(() => ({
  focusEffect: null as null | (() => void | (() => void)),
  getAppSettings: vi.fn(),
  updateAppSettings: vi.fn(),
  setSettings: vi.fn(),
}));

vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useState: () => [
    {
      defaultMessageMode: "remember",
      dashboardRightSwipeAction: "quick-log",
      defaultInteractionChannel: "remember",
      interactionAssistEnabled: 1,
      yourWeekPeriod: "rolling7",
    },
    mocks.setSettings,
  ],
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    mocks.focusEffect = effect;
  },
}));
vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Switch: "Switch",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui", () => ({ AppText: "AppText" }));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 0,
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => ({ id: "exec" }),
  localDateTime: () => "2026-09-19 12:00:00",
}));
vi.mock("@/db/app-settings-dao", async (original) => ({
  ...(await original<typeof import("@/db/app-settings-dao")>()),
  getAppSettings: mocks.getAppSettings,
  updateAppSettings: mocks.updateAppSettings,
  setInteractionAssistEnabled: vi.fn(),
}));
vi.mock("@/services/notifications/digest-schedule", () => ({
  reconcileDigestSchedule: vi.fn(),
}));
vi.mock("@/services/notifications/notification-schedule", () => ({
  reconcileSchedule: vi.fn(),
}));
vi.mock("@/stores/assist-store", () => ({
  useAssistBanner: { getState: () => ({ refresh: vi.fn() }) },
}));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { SettingsInteractionsScreen } = await import(
  "./SettingsInteractionsScreen"
);

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

describe("SettingsInteractionsScreen Your Week preference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.focusEffect = null;
    mocks.getAppSettings.mockResolvedValue({ yourWeekPeriod: "calendar_week" });
    mocks.updateAppSettings.mockResolvedValue(undefined);
  });

  it("renders the current period and persists the shared key", async () => {
    const tree = nodes(SettingsInteractionsScreen({ onBack: vi.fn() }));
    const rolling = tree.find(
      (node) => node.props.testID === "settings-your-week-period-section-rolling7",
    );
    const calendar = tree.find(
      (node) =>
        node.props.testID === "settings-your-week-period-section-calendar_week",
    );
    expect(rolling?.props.accessibilityState).toMatchObject({ selected: true });
    expect(calendar?.props.accessibilityState).toMatchObject({ selected: false });
    await (calendar?.props.onPress as () => Promise<void>)();
    expect(mocks.updateAppSettings).toHaveBeenCalledWith(
      { id: "exec" },
      { yourWeekPeriod: "calendar_week" },
      "2026-09-19 12:00:00",
    );
  });

  it("re-reads the shared preference whenever the screen gains focus", async () => {
    SettingsInteractionsScreen({ onBack: vi.fn() });
    expect(mocks.focusEffect).toBeTypeOf("function");
    mocks.focusEffect?.();
    await Promise.resolve();
    expect(mocks.getAppSettings).toHaveBeenCalledWith({ id: "exec" });
    expect(mocks.setSettings).toHaveBeenCalledWith({
      yourWeekPeriod: "calendar_week",
    });
  });
});
