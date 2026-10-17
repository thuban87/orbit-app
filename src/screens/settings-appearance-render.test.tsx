import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * 38.12-14 render test for Settings → Appearance (D-80, D-81, D-82, D-119).
 * The screen is called as a function with its hooks mocked (each `useState`
 * returns its initial value); the shared UI primitives are host strings so
 * their props can be read.
 */
const mocks = vi.hoisted(() => ({
  centering: { onFieldFocus: vi.fn(), onFieldBlur: vi.fn() },
  showSnackbar: vi.fn(),
}));

vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useRef: (value: unknown) => ({ current: value }),
  useState: (init: unknown) => [
    typeof init === "function" ? (init as () => unknown)() : init,
    vi.fn(),
  ],
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: vi.fn(),
  useNavigation: () => ({ navigate: vi.fn() }),
}));
vi.mock("react-native", () => ({
  Image: "Image",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  useWindowDimensions: () => ({ fontScale: 1 }),
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark, mode: "dark" }),
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ContactPicker", () => ({
  ContactPickerList: "ContactPickerList",
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/PhotoSourcePicker", () => ({
  PhotoSourcePicker: "PhotoSourcePicker",
}));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  KeyboardCenteringProvider: "KeyboardCenteringProvider",
  OptionSheet: "OptionSheet",
  SettingsRow: "SettingsRow",
  SettingsSectionCard: "SettingsSectionCard",
  Sheet: "Sheet",
  useKeyboardCentering: () => ({
    centering: mocks.centering,
    bottomSpacer: "bottom-spacer",
  }),
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
vi.mock("@/db/contact-read", () => ({ getContactHeader: vi.fn() }));
vi.mock("@/db/profile-dao", () => ({
  getProfile: vi.fn(),
  setProfileName: vi.fn(),
}));
vi.mock("@/db/profile-presentation-read", () => ({
  listProfileBackgroundTemplates: vi.fn(),
  listProfileLayoutTemplates: vi.fn(),
}));
vi.mock("@/db/sun-picker-read", () => ({ listSunCandidates: vi.fn() }));
vi.mock("@/stores/snackbar-store", () => ({
  showSnackbar: mocks.showSnackbar,
}));
vi.mock("@/stores/theme-store", () => {
  const state = {
    package: "galaxy",
    galaxyMode: "dark",
    standardMode: "light",
    galaxyAccent: null,
    standardAccent: null,
    galaxyBackground: "galaxy-quiet",
    standardBackground: "standard-dawn",
    setPackage: vi.fn(),
    setModeForActivePackage: vi.fn(),
    setAccentForActivePackage: vi.fn(),
    setBackgroundForActivePackage: vi.fn(),
    hydrate: vi.fn(),
  };
  const useThemeStore = (select: (s: typeof state) => unknown) => select(state);
  useThemeStore.getState = () => state;
  return { useThemeStore, themeSelectionFromSettings: vi.fn() };
});
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

// React Native's dev flag; the dev-only harness row is not under test.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const { SettingsAppearanceScreen } = await import("./SettingsAppearanceScreen");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

function render(): TestElement[] {
  return nodes(SettingsAppearanceScreen());
}

/** Every user-visible string the tree carries (text children and copy props). */
function visibleCopy(tree: TestElement[]): string[] {
  return tree.flatMap((n) =>
    [
      typeof n.props.children === "string" ? n.props.children : null,
      n.props.title,
      n.props.subtitle,
      n.props.value,
      n.props.label,
      n.props.accessibilityLabel,
      n.props.placeholder,
    ].filter((text): text is string => typeof text === "string"),
  );
}

describe("SettingsAppearanceScreen (38.12-14)", () => {
  it("the owner section reads You, not Your profile (D-80)", () => {
    const tree = render();
    const section = tree.find(
      (n) => n.props.testID === "settings-owner-profile-section",
    );
    expect(section?.type).toBe("SettingsSectionCard");
    expect(section?.props.title).toBe("You");
    expect(visibleCopy(tree)).not.toContain("Your profile");
  });

  it("Orbit Center, Your star and Your name stay on Appearance (D-80, D-25)", () => {
    const titles = render()
      .filter((n) => n.type === "SettingsRow")
      .map((n) => n.props.title);
    expect(titles).toEqual(
      expect.arrayContaining(["Your name", "Your star", "Orbit Center"]),
    );
  });

  it("spells Center one way in every user-visible string (D-80)", () => {
    const copy = visibleCopy(render()).join("\n");
    expect(copy).not.toMatch(/centre/i);
    expect(copy).toContain("Orbit Center");
    expect(copy).toMatch(/at the center of your orbit/);
  });

  it("the default-layout picker is the titled option sheet (D-81)", () => {
    const sheets = render().filter((n) => n.type === "OptionSheet");
    expect(sheets).toHaveLength(1);
    expect(sheets[0].props.title).toBe("Default Profile layout");
    const options = sheets[0].props.options as Array<{
      value: string | null;
      label: string;
    }>;
    expect(options[0]).toEqual({ value: null, label: "Default / None" });
    expect(sheets[0].props.visible).toBe(false);
  });

  it("Orbit Center picks through the shared contact picker with You first and Cancel (D-81)", () => {
    const tree = render();
    const sheet = tree.find((n) => n.type === "Sheet");
    expect(sheet).toBeDefined();
    const inside = nodes(sheet?.props.children as ReactNode);
    const picker = inside.find((n) => n.type === "ContactPickerList");
    expect(picker?.props.mode).toBe("single");
    expect(picker?.props.allowArchivedSearch).toBe(false);
    expect(
      inside.find((n) => n.props.testID === "settings-sun-option-me")?.props
        .accessibilityLabel,
    ).toBe("You");
    const cancel = inside.find((n) => n.type === "Button");
    expect(cancel?.props.label).toBe("Cancel");
    // No bespoke list remains.
    expect(tree.some((n) => n.type === "FlatList")).toBe(false);
  });

  it("Your name joins the keyboard-centering host (D-82)", () => {
    const tree = render();
    const provider = tree.find((n) => n.type === "KeyboardCenteringProvider");
    expect(provider?.props.value).toBe(mocks.centering);
    const input = tree.find(
      (n) => n.props.testID === "settings-self-name-input",
    );
    if (!input) throw new Error("Missing the name input");
    (input.props.onFocus as () => void)();
    expect(mocks.centering.onFieldFocus).toHaveBeenCalledWith(input.props.ref);
    (input.props.onBlur as () => void)();
    expect(mocks.centering.onFieldBlur).toHaveBeenCalledWith(input.props.ref);
    // The spacer is the provider's last child.
    const children = provider?.props.children as ReactNode[];
    expect(children[children.length - 1]).toBe("bottom-spacer");
  });

  it("a successful name save shows the saved cue (D-82)", () => {
    const source = readFileSync(
      join(__dirname, "SettingsAppearanceScreen.tsx"),
      "utf8",
    );
    const commit = source.slice(
      source.indexOf("const onCommitSelfName"),
      source.indexOf("const onSelectGlobalLayout"),
    );
    const save = commit.indexOf("await setProfileName(");
    const cue = commit.indexOf(
      'showSnackbar({ kind: "success", label: "Saved your name" })',
    );
    const failure = commit.indexOf("catch (err)");
    expect(save).toBeGreaterThan(-1);
    expect(cue).toBeGreaterThan(save);
    expect(cue).toBeLessThan(failure);
  });

  it("every section is a shared card and the row testIDs are kept (D-119)", () => {
    const tree = render();
    expect(
      tree
        .filter((n) => n.type === "SettingsSectionCard")
        .map((n) => n.props.testID),
    ).toEqual(
      expect.arrayContaining([
        "settings-appearance-section",
        "settings-owner-profile-section",
        "settings-orbit-appearance-section",
        "settings-profile-defaults-section",
      ]),
    );
    const rowIds = tree
      .filter((n) => n.type === "SettingsRow")
      .map((n) => n.props.testID);
    for (const id of [
      "settings-theme-package-row",
      "settings-theme-mode-row",
      "settings-theme-accent-row",
      "settings-theme-background-row",
      "settings-self-name-row",
      "settings-your-photo-row",
      "settings-your-star-row",
      "settings-sun-centre-row",
    ]) {
      expect(rowIds, id).toContain(id);
    }
  });
});
