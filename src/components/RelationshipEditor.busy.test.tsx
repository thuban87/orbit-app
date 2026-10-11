import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RelationshipEditor's `busy` (38.9 WR-02 follow-up; D-13, D-14, D-26): while
 * the host's save is in flight the open form's Cancel and Save are held and
 * drawn disabled, so Cancel cannot close the form while the save commits.
 *
 * Hooks are stubbed so the editor renders as a plain function. `useState` is
 * a call-order slot harness; slot order in RelationshipEditor: editing, draft,
 * pickerOpen. The draft slot is seeded so the form is open.
 */
const DRAFT_SLOT = 1;

const hooks = vi.hoisted(() => ({
  seeds: {} as Record<number, unknown>,
  index: 0,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: () => {},
  useImperativeHandle: () => {},
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => {
    const slot = hooks.index++;
    return [slot in hooks.seeds ? hooks.seeds[slot] : value, () => {}];
  },
}));
vi.mock("react-native", () => ({
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/components/ContactPicker", () => ({
  ContactPicker: "ContactPicker",
}));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  OrbitSwitch: "OrbitSwitch",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

import { initialDraft, RelationshipEditor } from "./RelationshipEditor";

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

const render = (busy?: boolean) => {
  hooks.index = 0;
  return nodes(
    RelationshipEditor({
      contactId: 1,
      items: [],
      onAdd: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onRestore: vi.fn(),
      busy,
    }),
  );
};
const button = (tree: TestElement[], label: string) =>
  tree.find((n) => n.type === "Button" && n.props.label === label);

describe("RelationshipEditor busy holds the form's Cancel and Save (WR-02 follow-up)", () => {
  beforeEach(() => {
    hooks.seeds = { [DRAFT_SLOT]: { ...initialDraft(), personName: "Sam" } };
  });

  it("leaves Cancel and Save live by default", () => {
    const tree = render();
    expect(button(tree, "Cancel")?.props.disabled).toBe(false);
    expect(button(tree, "Save")?.props.disabled).toBe(false);
  });

  it("draws Cancel and Save disabled while busy", () => {
    const tree = render(true);
    expect(button(tree, "Cancel")?.props.disabled).toBe(true);
    expect(button(tree, "Save")?.props.disabled).toBe(true);
  });

  it("Save stays disabled without a name, busy or not", () => {
    hooks.seeds = { [DRAFT_SLOT]: initialDraft() };
    expect(button(render(false), "Save")?.props.disabled).toBe(true);
  });
});
