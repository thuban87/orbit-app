import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardQueryState } from "@/logic/dashboard-query-logic";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { PopulationPanelContent } from "./PopulationPanelContent";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  View: "View",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: THEME_PRESETS.galaxy.dark,
    mode: "dark",
    package: "galaxy",
  }),
}));

interface Node {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: readonly Node[];
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

function render(populations: DashboardQueryState["populations"]) {
  const onTogglePopulation = vi.fn();
  const tree = resolve(
    <PopulationPanelContent
      state={{ viewMode: "list", populations, filters: {}, sort: "default" }}
      onTogglePopulation={onTogglePopulation}
    />,
  );
  const options = all(tree).filter(
    (node) =>
      node.type === "Pressable" &&
      String(node.props.testID).startsWith("dashboard-population-option-"),
  );
  return { options, onTogglePopulation };
}

describe("PopulationPanelContent (D-23)", () => {
  it("lists Active Contacts first, then the five populations in order", () => {
    const { options } = render([]);
    expect(options.map((node) => node.props.testID)).toEqual([
      "dashboard-population-option-active",
      "dashboard-population-option-all-contacts",
      "dashboard-population-option-favourites",
      "dashboard-population-option-birthdays",
      "dashboard-population-option-not-contacted",
      "dashboard-population-option-snoozed",
    ]);
    expect(options[0]?.props.accessibilityLabel).toBe("Active Contacts");
  });

  it("selects Active Contacts when populations is []", () => {
    const { options } = render([]);
    const states = options.map(
      (node) =>
        (node.props.accessibilityState as { selected: boolean }).selected,
    );
    expect(states).toEqual([true, false, false, false, false, false]);
  });

  it("does not select Active Contacts when another population is stored", () => {
    const { options } = render(["favourites", "birthdays"]);
    const states = options.map(
      (node) =>
        (node.props.accessibilityState as { selected: boolean }).selected,
    );
    expect(states).toEqual([false, false, true, true, false, false]);
  });

  it("passes the panel-only active key to the toggle handler", () => {
    const { options, onTogglePopulation } = render(["favourites"]);
    const onPress = options[0]?.props.onPress as (() => void) | undefined;
    expect(onPress).toBeDefined();
    onPress?.();
    expect(onTogglePopulation).toHaveBeenCalledWith("active");
  });
});
