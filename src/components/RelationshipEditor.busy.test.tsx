import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RelationshipEditor's `busy` (38.9 WR-02 follow-up; D-13, D-14, D-26): while
 * the host's save is in flight the open form's Cancel and Save are held and
 * drawn disabled, so Cancel cannot close the form while the save commits.
 *
 * Hooks are stubbed so the editor renders as a plain function. `useState` is
 * a call-order slot harness; slot order in RelationshipEditor: editing, draft,
 * pickerOpen, liveNames. The draft slot is seeded so the form is open. A
 * function initial value is called, as React calls a lazy initialiser.
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
      slot in hooks.seeds
        ? hooks.seeds[slot]
        : typeof value === "function"
          ? (value as () => unknown)()
          : value,
      () => {
        hooks.setters += 1;
      },
    ];
  },
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/components/ContactPicker", () => ({
  ContactPicker: "ContactPicker",
}));
// D-133: the pinned marker's pushpin pulls in @expo/vector-icons.
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  EntryTextField: "EntryTextField",
  OrbitSwitch: "OrbitSwitch",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
// The G-16 live-name read pulls in expo-sqlite through the database module.
vi.mock("@/db/database", () => ({ getExecutor: vi.fn() }));
vi.mock("@/db/picker-read", () => ({ listPickerContacts: vi.fn() }));

import type { RelationshipRow } from "@/db/relationships-read";
import { initialDraft, RelationshipEditor } from "./RelationshipEditor";

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

const handlers = { onAdd: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
const render = (
  busy?: boolean,
  items: RelationshipRow[] = [],
  initiallyEditingId?: number,
  cardEditMode?: boolean,
) => {
  hooks.index = 0;
  hooks.setters = 0;
  handlers.onAdd = vi.fn(async () => true);
  handlers.onEdit = vi.fn(async () => true);
  handlers.onDelete = vi.fn();
  return nodes(
    RelationshipEditor({
      contactId: 1,
      items,
      onAdd: handlers.onAdd,
      onEdit: handlers.onEdit,
      onDelete: handlers.onDelete,
      busy,
      initiallyEditingId,
      cardEditMode,
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
  // Delete is not on the row card (38.10-18): it sits in the open edit form.
  // Show on Profile is gone while Hide from Profile is switched off (D-134).
  const listLabels = ["Edit"];
  const press = (tree: TestElement[], label: string) => {
    const handler = button(tree, label)?.props.onPress;
    if (typeof handler !== "function") throw new Error(`missing ${label}`);
    handler();
  };

  beforeEach(() => {
    hooks.seeds = {};
  });

  it("leaves Edit and Add Key Person live when idle, with no Show on Profile", () => {
    const tree = render(false, [hiddenRow]);
    for (const label of [...listLabels, "Add Key Person"]) {
      expect(button(tree, label)?.props.disabled, label).toBe(false);
    }
    expect(button(tree, "Delete")).toBeUndefined();
    expect(button(tree, "Show on Profile")).toBeUndefined();
  });

  it("Edit opens the row's form and asks the host to reveal it; a held Edit asks nothing (38.10 verification)", () => {
    const onEditOpen = vi.fn();
    const renderWith = (busy: boolean) => {
      hooks.index = 0;
      hooks.setters = 0;
      return nodes(
        RelationshipEditor({
          contactId: 1,
          items: [hiddenRow],
          onAdd: vi.fn(),
          onEdit: vi.fn(),
          onDelete: vi.fn(),
          busy,
          onEditOpen,
        }),
      );
    };
    press(renderWith(false), "Edit");
    // openEdit: setEditing + setDraft.
    expect(hooks.setters).toBe(2);
    expect(onEditOpen).toHaveBeenCalledTimes(1);
    press(renderWith(true), "Edit");
    expect(hooks.setters).toBe(0);
    expect(onEditOpen).toHaveBeenCalledTimes(1);
    press(renderWith(false), "Add Key Person");
    expect(onEditOpen).toHaveBeenCalledTimes(1);
  });

  it("draws them disabled while busy, and a press changes nothing", () => {
    const tree = render(true, [hiddenRow]);
    for (const label of [...listLabels, "Add Key Person"]) {
      expect(button(tree, label)?.props.disabled, label).toBe(true);
      press(tree, label);
    }
    expect(handlers.onDelete).not.toHaveBeenCalled();
    expect(handlers.onEdit).not.toHaveBeenCalled();
    // Edit and Add Key Person would swap the open draft.
    expect(hooks.setters).toBe(0);
  });
});

describe("RelationshipEditor with Hide from Profile switched off (D-134) and the pushpin (D-133)", () => {
  const item = {
    id: 5,
    person_name: "Ria",
    relation_type: "Friend",
    linked_contact_id: null,
    linked_contact_name: null,
    note: null,
    pinned: 1,
    hidden: 1,
  } as unknown as RelationshipRow;
  const opacities = (tree: TestElement[]) =>
    tree.flatMap((n) => {
      const style = n.props.style;
      const list = Array.isArray(style) ? style : [style];
      return list
        .map((entry) => (entry as { opacity?: number } | null)?.opacity)
        .filter((value): value is number => value !== undefined);
    });
  const pins = (tree: TestElement[]) =>
    tree.filter((n) => n.type === "Icon" && n.props.name === "pin");

  beforeEach(() => {
    hooks.seeds = {};
  });

  it("does not dim a hidden row or offer Show on Profile, in either row layout", () => {
    for (const cardEditMode of [false, true]) {
      const tree = render(false, [item], undefined, cardEditMode);
      expect(opacities(tree)).not.toContain(0.68);
      expect(button(tree, "Show on Profile")).toBeUndefined();
    }
  });

  it("marks a pinned row with the pushpin in an accessible 'Pinned' marker, in either row layout", () => {
    for (const cardEditMode of [false, true]) {
      const tree = render(false, [item], undefined, cardEditMode);
      expect(pins(tree)).toHaveLength(1);
      expect(
        tree.some(
          (n) => n.props.accessibilityLabel === "Pinned" && n.props.accessible,
        ),
      ).toBe(true);
      const unpinned = render(
        false,
        [{ ...item, pinned: 0 }],
        undefined,
        cardEditMode,
      );
      expect(pins(unpinned)).toHaveLength(0);
    }
  });

  it("renders no Hide from Profile switch, caption or Use default visibility on the open form", () => {
    const tree = render(false, [item], 5);
    expect(
      tree.some((n) => n.props.accessibilityLabel === "Hide from Profile"),
    ).toBe(false);
    expect(
      tree.some(
        (n) => n.type === "AppText" && n.props.children === "Hide from Profile",
      ),
    ).toBe(false);
    expect(button(tree, "Use default visibility")).toBeUndefined();
    // The open form is really there.
    expect(
      tree.some((n) => n.props.accessibilityLabel === "Pin relationship"),
    ).toBe(true);
  });

  it("saving keeps the stored hidden (D-134)", async () => {
    const tree = render(false, [item], 5);
    const save = button(tree, "Save")?.props.onPress;
    if (typeof save !== "function") throw new Error("missing Save");
    save();
    await Promise.resolve();
    expect(handlers.onEdit).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ hidden: 1 }),
    );
  });
});

describe("RelationshipEditor note is the D-66 entry field (F-U1; D-114)", () => {
  beforeEach(() => {
    hooks.seeds = {
      [DRAFT_SLOT]: {
        ...initialDraft(),
        personName: "Sam",
        note: "Likes jazz",
      },
    };
  });

  it("renders the note as EntryTextField bound to draft.note, with its label and placeholder", () => {
    const tree = render();
    const note = tree.find((n) => n.type === "EntryTextField");
    expect(note?.props.accessibilityLabel).toBe("Relationship note optional");
    expect(note?.props.placeholder).toBe("Note (optional)");
    expect(note?.props.value).toBe("Likes jazz");
    expect(tree.some((n) => n.type === "TextInput" && n.props.multiline)).toBe(
      false,
    );
  });

  it("Enter (onSubmit) commits the form", async () => {
    const tree = render();
    const note = tree.find((n) => n.type === "EntryTextField");
    const submit = note?.props.onSubmit;
    if (typeof submit !== "function") throw new Error("missing onSubmit");
    submit();
    await Promise.resolve();
    expect(handlers.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ personName: "Sam", note: "Likes jazz" }),
    );
  });

  it("Enter while the host saves commits nothing", async () => {
    const tree = render(true);
    const submit = tree.find((n) => n.type === "EntryTextField")?.props
      .onSubmit;
    if (typeof submit !== "function") throw new Error("missing onSubmit");
    submit();
    await Promise.resolve();
    expect(handlers.onAdd).not.toHaveBeenCalled();
  });
});

describe("RelationshipEditor initiallyEditingId (D-107; convergence c6, Codex C-03)", () => {
  const item = {
    id: 5,
    person_name: "Ria",
    relation_type: "Friend",
    linked_contact_id: null,
    linked_contact_name: null,
    note: null,
    pinned: 0,
    hidden: null,
  } as unknown as RelationshipRow;

  beforeEach(() => {
    hooks.seeds = {};
  });

  it("an id present in items opens that row's edit form", () => {
    const tree = render(false, [item], 5);
    expect(
      tree.some(
        (n) => n.type === "AppText" && n.props.children === "Edit Key Person",
      ),
    ).toBe(true);
    const name = tree.find(
      (n) =>
        n.type === "TextInput" && n.props.accessibilityLabel === "Person name",
    );
    expect(name?.props.value).toBe("Ria");
    expect(button(tree, "Add Key Person")).toBeUndefined();
  });

  it("an id absent from items shows the rows with no form", () => {
    const tree = render(false, [item], 99);
    expect(button(tree, "Add Key Person")).toBeDefined();
    expect(tree.some((n) => n.type === "EntryTextField")).toBe(false);
  });
});

describe("RelationshipEditor Delete sits in the open edit form (38.9 D-30; 38.10-18)", () => {
  const item = {
    id: 5,
    person_name: "Ria",
    relation_type: "Friend",
    linked_contact_id: null,
    linked_contact_name: null,
    note: null,
    pinned: 0,
    hidden: null,
  } as unknown as RelationshipRow;
  const pressDelete = (tree: TestElement[]) => {
    const handler = button(tree, "Delete")?.props.onPress;
    if (typeof handler !== "function") throw new Error("missing Delete");
    handler();
  };

  beforeEach(() => {
    hooks.seeds = {};
  });

  it("the row card has no Delete; the open edit form has one", () => {
    expect(button(render(false, [item]), "Delete")).toBeUndefined();
    const tree = render(false, [item], 5);
    expect(button(tree, "Delete")?.props.role).toBe("tertiary");
    expect(button(tree, "Delete")?.props.disabled).toBe(false);
  });

  it("the add form has no Delete", () => {
    hooks.seeds = { [DRAFT_SLOT]: { ...initialDraft(), personName: "Sam" } };
    expect(button(render(false, [item]), "Delete")).toBeUndefined();
  });

  it("Delete calls the host with the open row's id and closes the form", () => {
    const tree = render(false, [item], 5);
    pressDelete(tree);
    expect(handlers.onDelete).toHaveBeenCalledWith(5);
    // close(): editing, draft and pickerOpen are reset.
    expect(hooks.setters).toBe(3);
  });

  it("a host that drops the delete (returns false) keeps the form open", () => {
    const tree = render(false, [item], 5);
    handlers.onDelete.mockReturnValue(false);
    pressDelete(tree);
    expect(handlers.onDelete).toHaveBeenCalledWith(5);
    expect(hooks.setters).toBe(0);
  });

  it("is held while the host saves: drawn disabled, a press does nothing", () => {
    const tree = render(true, [item], 5);
    expect(button(tree, "Delete")?.props.disabled).toBe(true);
    pressDelete(tree);
    expect(handlers.onDelete).not.toHaveBeenCalled();
    expect(hooks.setters).toBe(0);
  });
});

describe("RelationshipEditor card edit mode (D-130)", () => {
  const rowOf = (id: number, name: string) =>
    ({
      id,
      person_name: name,
      relation_type: null,
      linked_contact_id: null,
      linked_contact_name: null,
      note: null,
      pinned: 0,
      hidden: null,
    }) as unknown as RelationshipRow;
  const first = rowOf(1, "Ria");
  const second = rowOf(2, "Sam");

  beforeEach(() => {
    hooks.seeds = {};
  });

  it("opens the second row's form in its place, with a red Delete at its top", () => {
    hooks.index = 0;
    const root = RelationshipEditor({
      contactId: 1,
      items: [first, second],
      onAdd: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      initiallyEditingId: 2,
      cardEditMode: true,
    }) as TestElement;
    const slots = (root.props.children as ReactNode[])
      .flat()
      .filter(Boolean) as TestElement[];
    // Row 1, the form in row 2's place, the held Add, then the picker.
    expect(slots.map((n) => n.type)).toEqual([
      "Pressable",
      "View",
      "Button",
      "ContactPicker",
    ]);
    expect(slots[0]?.props.accessibilityLabel).toBe("Edit Ria");
    const tree = nodes(root);
    expect(tree.some((n) => n.props.accessibilityLabel === "Edit Sam")).toBe(
      false,
    );
    const form = nodes(slots[1]);
    const deletes = form.filter(
      (n) => n.type === "Button" && n.props.label === "Delete",
    );
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.props.role).toBe("destructive");
    // Before the form's fields: at its top.
    expect(form.indexOf(deletes[0] as TestElement)).toBeLessThan(
      form.findIndex((n) => n.props.accessibilityLabel === "Person name"),
    );
    // No "Edit" button, and no Move, anywhere; row 1 is held, as is the Add.
    expect(button(tree, "Edit")).toBeUndefined();
    expect(button(tree, "Move")).toBeUndefined();
    expect(slots[0]?.props.disabled).toBe(true);
    expect(slots[2]?.props.disabled).toBe(true);
  });

  it("a resting row has a pencil that opens its form, and no Edit button", () => {
    const tree = render(false, [first], undefined, true);
    expect(button(tree, "Edit")).toBeUndefined();
    const pencil = tree.find(
      (n) => n.type === "Button" && n.props.icon === "edit",
    );
    expect(pencil?.props.role).toBe("iconOnly");
    expect(pencil?.props.accessibilityLabel).toBe("Edit Ria");
    // The row's own tap edits under the same label: one screen-reader stop.
    expect(pencil?.props.hiddenFromAccessibility).toBe(true);
    expect(pencil?.props.disabled).toBe(false);
    const press = pencil?.props.onPress;
    if (typeof press !== "function") throw new Error("missing onPress");
    press();
    // openEdit: setEditing + setDraft.
    expect(hooks.setters).toBe(2);
  });

  it("Delete keeps the host contract in card edit mode", () => {
    const tree = render(false, [first], 1, true);
    const del = button(tree, "Delete");
    expect(del?.props.role).toBe("destructive");
    const press = del?.props.onPress;
    if (typeof press !== "function") throw new Error("missing Delete");
    press();
    expect(handlers.onDelete).toHaveBeenCalledWith(1);
    expect(hooks.setters).toBe(3);
  });
});

describe('RelationshipEditor addPlacement "top" (D-131: the host renders the Add)', () => {
  const rowOf = (id: number, name: string) =>
    ({
      id,
      person_name: name,
      relation_type: null,
      linked_contact_id: null,
      linked_contact_name: null,
      note: null,
      pinned: 0,
      hidden: null,
    }) as unknown as RelationshipRow;

  beforeEach(() => {
    hooks.seeds = {};
  });

  const renderTop = (initiallyEditingId?: number) => {
    hooks.index = 0;
    return RelationshipEditor({
      contactId: 1,
      items: [rowOf(1, "Ria"), rowOf(2, "Sam")],
      onAdd: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      initiallyEditingId,
      cardEditMode: true,
      addPlacement: "top",
    }) as TestElement;
  };
  const slotsOf = (root: TestElement) =>
    (root.props.children as ReactNode[])
      .flat()
      .filter(Boolean) as TestElement[];

  it("renders no Add Key Person Button of its own", () => {
    const root = renderTop();
    expect(button(nodes(root), "Add Key Person")).toBeUndefined();
    expect(slotsOf(root).map((n) => n.type)).toEqual([
      "Pressable",
      "Pressable",
      "ContactPicker",
    ]);
  });

  it("an open edit still renders in its row's place", () => {
    const root = renderTop(2);
    expect(slotsOf(root).map((n) => n.type)).toEqual([
      "Pressable",
      "View",
      "ContactPicker",
    ]);
    expect(button(nodes(root), "Add Key Person")).toBeUndefined();
  });

  it("a new key person's form opens first, above the rows", () => {
    hooks.seeds = { [DRAFT_SLOT]: { ...initialDraft(), personName: "Sam" } };
    const slots = slotsOf(renderTop());
    expect(slots.map((n) => n.type)).toEqual([
      "View",
      "Pressable",
      "Pressable",
      "ContactPicker",
    ]);
    expect(
      nodes(slots[0]).some(
        (n) => n.type === "AppText" && n.props.children === "Add Key Person",
      ),
    ).toBe(true);
  });
});
