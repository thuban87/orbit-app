/**
 * "Make this a group interaction" title prompt at large text (38.4 D-72,
 * Plan 17 G1-f). At font_scale 2.0 on the Pixel 3a the Cancel / Create row
 * did not wrap, pushing Cancel off the left edge as an unlabelled sliver, and
 * the field had no keyboard submit. The prompt now uses the shared
 * ConfirmDialog actions (a row when both fit, stacked full-width when they do
 * not) and the keyboard's Done key creates the event.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ title: "" }));

vi.mock("react", () => ({
  useEffect: () => undefined,
  useState: <T,>(_initial: T) => [state.title, vi.fn()],
}));
vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  Sheet: "Sheet",
}));
vi.mock("@/components/ui/ConfirmDialog", () => ({
  ConfirmActions: "ConfirmActions",
}));
vi.mock("@/theme", () => ({ useUnscopedTheme: () => ({ colors: {} }) }));

const { GroupTitlePromptSheet } = await import("./GroupTitlePromptSheet");

interface Element {
  type?: unknown;
  props?: Record<string, unknown> & { children?: unknown };
}

function find(node: unknown, type: unknown): Element[] {
  if (!node || typeof node !== "object") return [];
  const element = node as Element;
  const own = element.type === type ? [element] : [];
  const children = element.props?.children;
  const nested = Array.isArray(children)
    ? children.flatMap((child) => find(child, type))
    : find(children, type);
  return [...own, ...nested];
}

function call(element: Element | undefined, prop: string): void {
  const handler = element?.props?.[prop];
  if (typeof handler !== "function") throw new Error(`missing ${prop}`);
  handler();
}

function render(onConfirm = vi.fn(), onRequestClose = vi.fn()) {
  const tree = GroupTitlePromptSheet({
    visible: true,
    onRequestClose,
    onConfirm,
  });
  return { tree, onConfirm, onRequestClose };
}

describe("GroupTitlePromptSheet (D-72)", () => {
  beforeEach(() => {
    state.title = "";
  });

  it("uses the shared stacking actions, never a fixed row", () => {
    state.title = "Trip";
    const { tree, onConfirm, onRequestClose } = render();
    expect(find(tree, "Button")).toHaveLength(0);
    const [actions] = find(tree, "ConfirmActions");
    expect(actions?.props).toMatchObject({
      cancelLabel: "Cancel",
      confirmLabel: "Create group event",
      destructive: false,
      confirmDisabled: false,
    });
    call(actions, "onCancel");
    expect(onRequestClose).toHaveBeenCalled();
    call(actions, "onConfirm");
    expect(onConfirm).toHaveBeenCalledWith("Trip");
  });

  it("keeps Create disabled for a blank title", () => {
    const [actions] = find(render().tree, "ConfirmActions");
    expect(actions?.props?.confirmDisabled).toBe(true);
  });

  it("creates the event from the keyboard's Done key with the trimmed title", () => {
    state.title = "  Book club  ";
    const { tree, onConfirm } = render();
    const [input] = find(tree, "TextInput");
    expect(input?.props?.returnKeyType).toBe("done");
    call(input, "onSubmitEditing");
    expect(onConfirm).toHaveBeenCalledWith("Book club");
  });

  it("ignores the Done key for a blank title", () => {
    state.title = "   ";
    const { tree, onConfirm } = render();
    const [input] = find(tree, "TextInput");
    call(input, "onSubmitEditing");
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("the Profile host lets the prompt's buttons take the first tap (D-72)", () => {
  it("sets keyboardShouldPersistTaps on the Profile ScrollView that the Modal sheet descends from", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const profile = readFileSync(
      join(__dirname, "../../screens/ContactProfileScreen.tsx"),
      "utf8",
    );
    const open = profile.indexOf("<ScrollView\n          ref={scrollRef}");
    expect(open).toBeGreaterThan(-1);
    const opener = profile.slice(open, profile.indexOf(">", open) + 1);
    expect(opener).toContain('keyboardShouldPersistTaps="handled"');
  });
});
