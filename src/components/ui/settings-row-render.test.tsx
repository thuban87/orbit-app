import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("./AppText", () => ({ AppText: "AppText" }));
vi.mock("./GlassSurface", () => ({ GlassSurface: "GlassSurface" }));
vi.mock("./button-roles", () => ({ MIN_TOUCH_TARGET: 44 }));

const { SettingsRow, SETTINGS_ROW_DISABLED_OPACITY } = await import(
  "./SettingsRow"
);
const { SettingsSectionCard } = await import("./SettingsSectionCard");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}
function flatStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flatStyle));
  }
  return style && typeof style === "object"
    ? (style as Record<string, unknown>)
    : {};
}
const chevrons = (tree: TestElement[]) =>
  tree.filter((n) => n.type === "Icon" && n.props.name === "forward");

describe("SettingsRow (38.12 D-119)", () => {
  it("a row that opens something is a button with the chevron", () => {
    const onPress = vi.fn();
    const root = SettingsRow({
      title: "Custom fields",
      subtitle: "Add your own fields",
      onPress,
      testID: "row-open",
    }) as TestElement;
    const tree = nodes(root);
    expect(root.type).toBe("Pressable");
    expect(root.props.testID).toBe("row-open");
    expect(root.props.accessibilityRole).toBe("button");
    expect(root.props.accessibilityLabel).toBe("Custom fields");
    expect(chevrons(tree)).toHaveLength(1);
    (root.props.onPress as () => void)();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("an info-only row is a plain View: no chevron, no button role, no pressed state", () => {
    const root = SettingsRow({
      title: "Version",
      value: "1.0.0",
      testID: "row-info",
    }) as TestElement;
    const tree = nodes(root);
    expect(root.type).toBe("View");
    expect(root.props.testID).toBe("row-info");
    expect(tree.some((n) => n.props.accessibilityRole === "button")).toBe(
      false,
    );
    expect(tree.some((n) => n.type === "Pressable")).toBe(false);
    expect(chevrons(tree)).toHaveLength(0);
    expect(typeof root.props.style).not.toBe("function");
    // Spoken as one element: title then value.
    expect(root.props.accessible).toBe(true);
    expect(root.props.accessibilityLabel).toBe("Version, 1.0.0");
  });

  it("a trailing control replaces the chevron", () => {
    const root = SettingsRow({
      title: "Interaction Assist",
      onPress: vi.fn(),
      trailing: "SWITCH",
    }) as TestElement;
    const tree = nodes(root);
    expect(chevrons(tree)).toHaveLength(0);
    const main = tree.find((n) => Array.isArray(n.props.children));
    expect(JSON.stringify(main?.props.children)).toContain("SWITCH");
  });

  it("a trailing control on an info row keeps the row ungrouped so the control stays reachable", () => {
    const root = SettingsRow({
      title: "Relationship Satellites",
      trailing: "SWITCH",
    }) as TestElement;
    expect(root.type).toBe("View");
    expect(root.props.accessible).toBeUndefined();
    expect(chevrons(nodes(root))).toHaveLength(0);
  });

  it("passes testID through unchanged and speaks an explicit label instead of the value", () => {
    const root = SettingsRow({
      title: "Phone number region",
      value: "Device region (US)",
      onPress: vi.fn(),
      testID: "settings-contacts-phone-region",
      accessibilityLabel: "Phone number region, Device region (US)",
    }) as TestElement;
    expect(root.props.testID).toBe("settings-contacts-phone-region");
    expect(root.props.accessibilityLabel).toBe(
      "Phone number region, Device region (US)",
    );
    expect(root.props.accessibilityValue).toBeUndefined();
  });

  it("speaks the value as the a11y value when no label is given", () => {
    const root = SettingsRow({
      title: "Phone number region",
      value: "Germany",
      onPress: vi.fn(),
    }) as TestElement;
    expect(root.props.accessibilityValue).toEqual({ text: "Germany" });
  });

  it("disabled dims the row, ignores presses and reports it (D-06)", () => {
    const root = SettingsRow({
      title: "Phone number region",
      onPress: vi.fn(),
      disabled: true,
    }) as TestElement;
    expect(root.props.disabled).toBe(true);
    expect(root.props.accessibilityState).toEqual({ disabled: true });
    const style = (root.props.style as (s: { pressed: boolean }) => unknown)({
      pressed: false,
    });
    expect(flatStyle(style).opacity).toBe(SETTINGS_ROW_DISABLED_OPACITY);

    const info = SettingsRow({
      title: "Version",
      disabled: true,
    }) as TestElement;
    expect(flatStyle(info.props.style).opacity).toBe(
      SETTINGS_ROW_DISABLED_OPACITY,
    );
  });

  it("an enabled row is full strength at rest and shows a pressed state", () => {
    const root = SettingsRow({
      title: "Systems",
      onPress: vi.fn(),
    }) as TestElement;
    const style = root.props.style as (s: { pressed: boolean }) => unknown;
    expect(flatStyle(style({ pressed: false })).opacity).toBeUndefined();
    expect(flatStyle(style({ pressed: true })).opacity).toBeLessThan(1);
  });

  it("renders children under the title line and never groups them", () => {
    const root = SettingsRow({
      title: "Contacts access",
      subtitle: "Contacts access is off.",
      subtitleTestID: "row-status",
      children: "BUTTONS",
    }) as TestElement;
    const tree = nodes(root);
    expect(root.props.accessible).toBeUndefined();
    expect(
      tree.find((n) => n.props.testID === "row-status")?.props.children,
    ).toBe("Contacts access is off.");
    expect(JSON.stringify(root.props.children)).toContain("BUTTONS");
  });
});

describe("SettingsSectionCard (38.12 D-119)", () => {
  it("draws an uppercase header and one card with a divider between rows", () => {
    const root = SettingsSectionCard({
      title: "Contact sources",
      testID: "section",
      children: ["A", null, "B", "C"],
    }) as TestElement;
    expect(root.props.testID).toBe("section");
    const tree = nodes(root);
    const header = tree.find((n) => n.props.accessibilityRole === "header");
    expect(header?.props.children).toBe("Contact sources");
    expect(flatStyle(header?.props.style).textTransform).toBe("uppercase");
    const card = tree.find(
      (n) => flatStyle(n.props.style).borderRadius !== undefined,
    );
    expect(card).toBeDefined();
    const kids = card?.props.children as unknown[];
    // null slots are dropped: A, divider, B, divider, C.
    expect(kids).toHaveLength(5);
    expect(kids.filter((k) => typeof k === "string")).toEqual(["A", "B", "C"]);
    const dividers = kids.filter(
      (k): k is TestElement => typeof k === "object" && k !== null,
    );
    expect(dividers).toHaveLength(2);
    expect(flatStyle(dividers[0]?.props.style).backgroundColor).toBe(
      THEME_PRESETS.galaxy.dark.border,
    );
  });

  it("draws no header without a title", () => {
    const root = SettingsSectionCard({ children: "A" }) as TestElement;
    expect(
      nodes(root).some((n) => n.props.accessibilityRole === "header"),
    ).toBe(false);
  });

  it("the plain card uses the surface and border tokens", () => {
    const root = SettingsSectionCard({ children: "A" }) as TestElement;
    const card = nodes(root).find(
      (n) => flatStyle(n.props.style).borderRadius !== undefined,
    );
    const style = flatStyle(card?.props.style);
    expect(style.backgroundColor).toBe(THEME_PRESETS.galaxy.dark.surface);
    expect(style.borderColor).toBe(THEME_PRESETS.galaxy.dark.border);
  });

  it("the glass card renders the shared GlassSurface", () => {
    const root = SettingsSectionCard({
      surface: "glass",
      children: ["A", "B"],
    }) as TestElement;
    const glass = nodes(root).find((n) => n.type === "GlassSurface");
    expect(glass).toBeDefined();
    expect((glass?.props.children as unknown[] | undefined)?.length).toBe(3);
  });
});
