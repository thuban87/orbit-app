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
  /** How many state setters ran. */
  setters: 0,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: () => {},
  useImperativeHandle: () => {},
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => {
    const slot = hooks.index++;
    return [
      slot in hooks.seeds ? hooks.seeds[slot] : value,
      () => {
        hooks.setters += 1;
      },
    ];
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

import type { RelationshipRow } from "@/db/relationships-read";
import { initialDraft, RelationshipEditor } from "./RelationshipEditor";

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

const handlers = { onEdit: vi.fn(), onDelete: vi.fn() };
const render = (busy?: boolean, items: RelationshipRow[] = []) => {
  hooks.index = 0;
  hooks.setters = 0;
  handlers.onEdit = vi.fn();
  handlers.onDelete = vi.fn();
  return nodes(
    RelationshipEditor({
      contactId: 1,
      items,
      onAdd: vi.fn(),
      onEdit: handlers.onEdit,
      onDelete: handlers.onDelete,
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

describe("RelationshipEditor busy holds the list's controls (third fix pass WR-02)", () => {
  const hiddenRow = {
    id: 7,
    person_name: "Alex",
    relation_type: "Sister",
    linked_contact_id: null,
    linked_contact_name: null,
    note: null,
    pinned: 0,
    hidden: 1,
  } as unknown as RelationshipRow;
  const listLabels = ["Edit", "Delete", "Show on Profile"];
  const press = (tree: TestElement[], label: string) => {
    const handler = button(tree, label)?.props.onPress;
    if (typeof handler !== "function") throw new Error(`missing ${label}`);
    handler();
  };

  beforeEach(() => {
    hooks.seeds = {};
  });

  it("leaves Edit, Delete, Show on Profile and Add key person live when idle", () => {
    const tree = render(false, [hiddenRow]);
    for (const label of [...listLabels, "Add key person"]) {
      expect(button(tree, label)?.props.disabled, label).toBe(false);
    }
    press(tree, "Delete");
    expect(handlers.onDelete).toHaveBeenCalledWith(7);
    press(tree, "Show on Profile");
    expect(handlers.onEdit).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ hidden: 0 }),
    );
  });

  it("draws them disabled while busy, and a press changes nothing", () => {
    const tree = render(true, [hiddenRow]);
    for (const label of [...listLabels, "Add key person"]) {
      expect(button(tree, label)?.props.disabled, label).toBe(true);
      press(tree, label);
    }
    expect(handlers.onDelete).not.toHaveBeenCalled();
    expect(handlers.onEdit).not.toHaveBeenCalled();
    // Edit and Add key person would swap the open draft.
    expect(hooks.setters).toBe(0);
  });
});
