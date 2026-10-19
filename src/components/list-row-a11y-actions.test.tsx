/**
 * List row accessibility actions (38.13 D-26; phase-06 :270; 39 D-100).
 *
 * A List row exposes "Quick Log", "Log Interaction" and "Edit Contact" as
 * TalkBack actions, as Card view's cards do, and each action runs only the
 * handler it is named for. The right swipe keeps following the swipe
 * preference in the host; these actions do not.
 */
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { ListRow } from "./ListRow";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
  Text: "Text",
  View: "View",
}));
vi.mock("react-native-reanimated", () => ({
  default: { View: "AnimatedView" },
  useAnimatedStyle: (fn: () => unknown) => fn(),
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/contact-card-ring", () => ({
  ringVisual: () => ({ color: "ring", opacity: 1, width: 1 }),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/icons/StatusGlyph", () => ({
  StatusGlyph: "StatusGlyph",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: THEME_PRESETS.galaxy.dark,
    mode: "dark",
    package: "galaxy",
  }),
  useUnscopedTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
  GlassForegroundScope: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("@/theme/use-art-treatment", () => ({ useArtTreatment: () => null }));

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

function rowRoot(props: Partial<Parameters<typeof ListRow>[0]>): Node {
  const root = all(
    resolve(
      ListRow({
        contactId: 7,
        name: "Alex",
        photo: null,
        categoryLabel: null,
        lastContact: "2026-09-19 12:00:00",
        snoozeUntil: null,
        status: "stable",
        now: "2026-09-20",
        onPress: vi.fn(),
        ...props,
      }),
    ),
  ).find((node) => node.props.testID === "dashboard-list-row-7");
  if (!root) throw new Error("List row root not found");
  return root;
}

function handlers() {
  return {
    onQuickLog: vi.fn(),
    onLogInteraction: vi.fn(),
    onEditContact: vi.fn(),
  };
}

function fire(root: Node, actionName: string): void {
  (
    root.props.onAccessibilityAction as (event: {
      nativeEvent: { actionName: string };
    }) => void
  )({ nativeEvent: { actionName } });
}

describe("List row accessibility actions (38.13 D-26)", () => {
  it("exposes Quick Log, Log Interaction and Edit Contact when the host passes them", () => {
    const root = rowRoot(handlers());
    expect(root.props.accessibilityActions).toEqual([
      { name: "quick-log", label: "Quick Log" },
      { name: "log-interaction", label: "Log Interaction" },
      { name: "edit-contact", label: "Edit Contact" },
    ]);
  });

  it.each([
    ["quick-log", "onQuickLog"],
    ["log-interaction", "onLogInteraction"],
    ["edit-contact", "onEditContact"],
  ] as const)("%s calls only %s", (actionName, handlerName) => {
    const spies = handlers();
    fire(rowRoot(spies), actionName);
    for (const [name, spy] of Object.entries(spies)) {
      expect(spy, name).toHaveBeenCalledTimes(name === handlerName ? 1 : 0);
    }
  });

  it("offers only the actions whose handlers are present", () => {
    const root = rowRoot({ onEditContact: vi.fn() });
    expect(root.props.accessibilityActions).toEqual([
      { name: "edit-contact", label: "Edit Contact" },
    ]);
    expect(rowRoot({}).props.accessibilityActions).toBeUndefined();
  });

  it("an unknown action runs nothing", () => {
    const spies = handlers();
    fire(rowRoot(spies), "activate");
    for (const spy of Object.values(spies)) expect(spy).not.toHaveBeenCalled();
  });
});
