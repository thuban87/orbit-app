import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of the banner / pending-list answer controls (38.14 D-80,
 * D-73; D-09 answer sets). The answers sit in a `ConfirmActions`
 * measure-and-stack row (D-11, ADR-174 :38), which draws cancel, then the
 * optional secondary, then confirm — so "Yes" is the last, right-hand answer.
 */

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({ current: value }),
  useEffect: () => {},
  useState: (value: unknown) => [
    typeof value === "function" ? (value as () => unknown)() : value,
    () => {},
  ],
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/ui/ConfirmDialog", () => ({
  ConfirmActions: "ConfirmActions",
}));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { AssistConfirmation } = await import("./AssistConfirmation");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

function actionsFor(
  channel: "call" | "text" | "email",
  pending = false,
  handlers = { onConfirm: vi.fn(), onDismiss: vi.fn() },
): TestElement {
  const tree = nodes(AssistConfirmation({ channel, pending, ...handlers }));
  const actions = tree.filter((node) => node.type === "ConfirmActions");
  expect(actions).toHaveLength(1);
  return actions[0];
}

/** The answers in the order ConfirmActions draws them, left to right. */
function drawnOrder(actions: TestElement): string[] {
  const { cancelLabel, secondaryLabel, onSecondary, confirmLabel } =
    actions.props;
  return [
    cancelLabel as string,
    ...(secondaryLabel !== undefined && onSecondary !== undefined
      ? [secondaryLabel as string]
      : []),
    confirmLabel as string,
  ];
}

describe("AssistConfirmation answers (38.14 D-80, D-73, D-09)", () => {
  it("Call offers Don't log, No answer, Yes — Yes on the right", () => {
    expect(drawnOrder(actionsFor("call"))).toEqual([
      "Don't log",
      "No answer",
      "Yes",
    ]);
  });

  it.each(["text", "email"] as const)(
    "%s offers only Don't log and Yes — Yes on the right",
    (channel) => {
      const actions = actionsFor(channel);
      expect(drawnOrder(actions)).toEqual(["Don't log", "Yes"]);
      expect(actions.props.secondaryLabel).toBeUndefined();
    },
  );

  it("is a non-destructive measure-and-stack row, with no plain wrapping row", () => {
    const actions = actionsFor("call");
    expect(actions.props.destructive).toBe(false);
  });

  it("wires Yes → confirm(1), No answer → confirm(0), Don't log → dismiss", async () => {
    const handlers = { onConfirm: vi.fn(), onDismiss: vi.fn() };
    const actions = actionsFor("call", false, handlers);
    await (actions.props.onConfirm as () => Promise<void>)();
    await (actions.props.onSecondary as () => Promise<void>)();
    await (actions.props.onCancel as () => Promise<void>)();
    expect(
      handlers.onConfirm.mock.calls.map(([connected]) => connected),
    ).toEqual([1, 0]);
    expect(handlers.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("disables every answer, Call's No answer included, while pending", () => {
    const actions = actionsFor("call", true);
    expect(actions.props.cancelDisabled).toBe(true);
    expect(actions.props.secondaryDisabled).toBe(true);
    expect(actions.props.confirmDisabled).toBe(true);
    const idle = actionsFor("call", false);
    expect(idle.props.cancelDisabled).toBe(false);
    expect(idle.props.secondaryDisabled).toBe(false);
    expect(idle.props.confirmDisabled).toBe(false);
  });
});
