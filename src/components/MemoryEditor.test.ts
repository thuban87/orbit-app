import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hooks are stubbed so the editor renders as a plain function (the
// photo-field-widget-render pattern): `useState` returns its initial value,
// or `true` for a `false` boolean while `forceOpenPickers` is set, so the
// native date picker can be reached; every setter is recorded.
// `draftOverride`, when set, stands in for every MemoryDraft-shaped state
// (the open draft and its baseline), so a case can render a draft the user
// has already edited (e.g. Allow AI toggled) and press Save.
const hooks = vi.hoisted(() => ({
  forceOpenPickers: false,
  draftOverride: null as unknown,
  setters: [] as unknown[],
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: () => {},
  useImperativeHandle: () => {},
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => {
    const initial =
      typeof value === "function" ? (value as () => unknown)() : value;
    const isDraft =
      initial !== null && typeof initial === "object" && "allowAi" in initial;
    if (isDraft && hooks.draftOverride !== null) {
      return [
        hooks.draftOverride,
        (next: unknown) => {
          hooks.setters.push(next);
        },
      ];
    }
    return [
      initial === false && hooks.forceOpenPickers ? true : initial,
      (next: unknown) => {
        hooks.setters.push(next);
      },
    ];
  },
}));
vi.mock("@react-native-community/datetimepicker", () => ({
  default: "DateTimePicker",
}));

// 38.9 D-24: raw RN Modal sites render through RegisteredModal; the window
// itself is unchanged, so the wrapper is the mocked RN Modal here.
vi.mock("@/components/ui/RegisteredModal", () => ({
  RegisteredModal: "Modal",
}));
vi.mock("react-native", () => ({
  FlatList: "FlatList",
  Modal: "Modal",
  Pressable: "Pressable",
  StyleSheet: {
    absoluteFill: {},
    create: <T>(styles: T) => styles,
    hairlineWidth: 1,
  },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("./icons/Icon", () => ({ Icon: "Icon" }));
const { openMemoryLink } = vi.hoisted(() => ({ openMemoryLink: vi.fn() }));
vi.mock("./MemoryCard", () => ({
  MemoryCard: "MemoryCard",
  memoryTypeLabel: (memory: { custom_label: string | null }) =>
    memory.custom_label ?? "Memory",
  openMemoryLink,
}));
vi.mock("./ui", () => ({
  AppText: "AppText",
  Button: "Button",
  EntryTextField: "EntryTextField",
  FieldError: "FieldError",
  OrbitSwitch: "OrbitSwitch",
}));

import type { MemoryRow } from "@/db/memories-read";
import {
  canSaveMemoryDraft,
  draftAfterTypeChange,
  initialDraft,
  initialEditorState,
  isMemoryDraftDirty,
  type MemoryDraft,
  MemoryEditor,
  type MemoryEditorProps,
  memoryDraftState,
  memoryEditorSlots,
  memoryLinkError,
  newMemoryDraft,
  normalizeMemoryDraft,
} from "./MemoryEditor";

describe("initialDraft", () => {
  it("keeps a new Memory's visibility inherited", () => {
    expect(initialDraft().hidden).toBeNull();
  });

  it("retains inherited visibility for an existing Memory", () => {
    const memory = { hidden: null } as MemoryRow;

    expect(initialDraft(memory).hidden).toBeNull();
  });
});

describe("initialEditorState (D-73: post-log Edit Memory opens its form)", () => {
  const memory = {
    id: 42,
    type: "general",
    value: "Likes kayaks",
  } as MemoryRow;

  it("opens the named memory's form with no tap on its card", () => {
    const state = initialEditorState([memory], 42);
    expect(state.editing).toBe(memory);
    expect(state.draft?.value).toBe("Likes kayaks");
  });

  it("stays closed without an id or when the id is not among the items", () => {
    expect(initialEditorState([memory])).toEqual({
      editing: null,
      draft: null,
      baseline: null,
    });
    expect(initialEditorState([memory], 7)).toEqual({
      editing: null,
      draft: null,
      baseline: null,
    });
  });
});

describe("memory draft dirty state (D-14, D-61; review C2-M1)", () => {
  const memory = {
    id: 3,
    type: "general",
    value: "Likes tea",
    note: null,
    pinned: 0,
    outdated: 0,
    hidden: null,
  } as unknown as MemoryRow;

  it("an unopened or untouched draft is clean", () => {
    expect(isMemoryDraftDirty(initialDraft(), initialDraft())).toBe(false);
    expect(isMemoryDraftDirty(initialDraft(memory), initialDraft(memory))).toBe(
      false,
    );
  });

  it("typing makes the draft dirty", () => {
    expect(
      isMemoryDraftDirty(initialDraft(), { ...initialDraft(), value: "a" }),
    ).toBe(true);
    expect(
      isMemoryDraftDirty(initialDraft(memory), {
        ...initialDraft(memory),
        note: "x",
      }),
    ).toBe(true);
    expect(
      isMemoryDraftDirty(initialDraft(), { ...initialDraft(), pinned: true }),
    ).toBe(true);
  });

  it("text typed and then erased reads as untouched", () => {
    expect(
      isMemoryDraftDirty(initialDraft(), { ...initialDraft(), value: "" }),
    ).toBe(false);
  });

  it("memoryDraftState reports open and dirty against the opened baseline", () => {
    expect(memoryDraftState(null, null)).toEqual({ open: false, dirty: false });
    expect(memoryDraftState(initialDraft(), initialDraft())).toEqual({
      open: true,
      dirty: false,
    });
    expect(
      memoryDraftState(initialDraft(memory), initialDraft(memory)),
    ).toEqual({
      open: true,
      dirty: false,
    });
    expect(
      memoryDraftState(initialDraft(), {
        ...initialDraft(),
        value: "Birthday",
      }),
    ).toEqual({ open: true, dirty: true });
  });

  it("an Allow AI change makes the draft dirty", () => {
    expect(
      isMemoryDraftDirty(initialDraft(memory), {
        ...initialDraft(memory),
        allowAi: 1,
      }),
    ).toBe(true);
  });
});

describe("meaningful date (D-65, D-67)", () => {
  type TestElement = ReactElement<Record<string, unknown>>;
  function nodes(node: ReactNode): TestElement[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    const element = node as TestElement;
    return [element, ...nodes(element.props.children as ReactNode)];
  }
  function texts(tree: TestElement[]): string[] {
    return tree.flatMap((node) => {
      const children = node.props.children;
      if (typeof children === "string") return [children];
      if (Array.isArray(children)) {
        return children.filter((c): c is string => typeof c === "string");
      }
      return [];
    });
  }
  const memory = (meaningfulDate: string | null) =>
    ({
      id: 5,
      type: "general",
      value: "Trip",
      note: null,
      url: null,
      meaningful_date: meaningfulDate,
      pinned: 0,
      outdated: 0,
      hidden: null,
      allow_ai: 0,
      provenance: "user",
      deleted_at: null,
    }) as unknown as MemoryRow;
  const render = (meaningfulDate: string | null) =>
    nodes(
      MemoryEditor({
        items: [memory(meaningfulDate)],
        initiallyEditingId: 5,
        onAdd: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        globalAiEnabled: true,
      }),
    );
  const row = (tree: TestElement[]) =>
    tree.find((n) => n.props.accessibilityLabel === "Meaningful date");

  beforeEach(() => {
    hooks.forceOpenPickers = false;
    hooks.setters = [];
  });

  it("has no free-text meaningful date input and a visible label (C6-L2)", () => {
    const tree = render(null);
    expect(
      tree.some(
        (n) =>
          n.type === "TextInput" &&
          n.props.accessibilityLabel === "Meaningful date optional",
      ),
    ).toBe(false);
    expect(texts(tree)).toContain("Meaningful date (optional)");
  });

  it("shows Pick a date and no Clear when empty", () => {
    const tree = render(null);
    expect(row(tree)?.props.accessibilityRole).toBe("button");
    expect(texts(nodes(row(tree)))).toContain("Pick a date");
    expect(
      tree.some((n) => n.props.accessibilityLabel === "Clear meaningful date"),
    ).toBe(false);
    expect(texts(tree)).not.toContain("Not a date");
  });

  it("shows a stored date in the display form with a Clear action", () => {
    const year = new Date().getFullYear();
    const tree = render(`${year}-10-20`);
    expect(texts(nodes(row(tree)))).toContain("Oct 20");
    expect(row(tree)?.props.accessibilityValue).toEqual({ text: "Oct 20" });
    expect(
      tree.some((n) => n.props.accessibilityLabel === "Clear meaningful date"),
    ).toBe(true);
    expect(texts(tree)).not.toContain("Not a date");
  });

  it("shows a legacy non-date raw with Not a date, and it can be cleared", () => {
    const tree = render("next spring");
    expect(texts(nodes(row(tree)))).toContain("next spring");
    expect(texts(tree)).toContain("Not a date");
    const clear = tree.find(
      (n) => n.props.accessibilityLabel === "Clear meaningful date",
    );
    expect(clear).toBeDefined();
    (clear?.props.onPress as (() => void) | undefined)?.();
    const updater = hooks.setters.find((s) => typeof s === "function") as (
      d: MemoryDraft,
    ) => MemoryDraft;
    const before = initialDraft(memory("next spring"));
    const after = updater(before);
    expect(after.meaningfulDate).toBeNull();
    expect(isMemoryDraftDirty(before, after)).toBe(true);
  });

  it("an impossible date shows raw with Not a date", () => {
    const tree = render("2026-02-31");
    expect(texts(nodes(row(tree)))).toContain("2026-02-31");
    expect(texts(tree)).toContain("Not a date");
  });

  it("a pick updates the draft with the stored YYYY-MM-DD; a dismiss does not", () => {
    hooks.forceOpenPickers = true;
    const tree = render(null);
    const picker = tree.find((n) => n.type === "DateTimePicker");
    expect(picker).toBeDefined();
    expect(picker?.props.mode).toBe("date");
    expect(picker?.props.minimumDate).toBeUndefined();
    expect(picker?.props.maximumDate).toBeUndefined();
    const onChange = picker?.props.onChange as (
      event: { type: string },
      date?: Date,
    ) => void;

    onChange({ type: "dismissed" }, new Date(2026, 9, 20));
    expect(hooks.setters.some((s) => typeof s === "function")).toBe(false);

    onChange({ type: "set" }, new Date(2026, 9, 20, 23, 30));
    const updater = hooks.setters.find((s) => typeof s === "function") as (
      d: MemoryDraft,
    ) => MemoryDraft;
    const before = initialDraft(memory(null));
    const after = updater(before);
    expect(after.meaningfulDate).toBe("2026-10-20");
    expect(isMemoryDraftDirty(before, after)).toBe(true);
  });

  it("offers no year-unknown control (D-67)", () => {
    hooks.forceOpenPickers = true;
    const tree = render(null);
    expect(texts(tree).some((t) => /year unknown/i.test(t))).toBe(false);
  });
});

describe("busy holds the form's Cancel and Save (D-26; 38.9 fix-pass WR-01)", () => {
  type TestElement = ReactElement<Record<string, unknown>>;
  function nodes(node: ReactNode): TestElement[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    const element = node as TestElement;
    return [element, ...nodes(element.props.children as ReactNode)];
  }
  const memory = {
    id: 5,
    type: "general",
    value: "Trip",
    note: null,
    url: null,
    meaningful_date: null,
    pinned: 0,
    outdated: 0,
    hidden: null,
    allow_ai: 0,
    provenance: "user",
    deleted_at: null,
  } as unknown as MemoryRow;
  const render = (busy?: boolean) =>
    nodes(
      MemoryEditor({
        items: [memory],
        initiallyEditingId: 5,
        onAdd: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        globalAiEnabled: true,
        busy,
      }),
    );
  const control = (tree: TestElement[], label: string) =>
    tree.find(
      (n) => n.type === "Pressable" && n.props.accessibilityLabel === label,
    );
  const dimmed = (element: TestElement | undefined) =>
    ((element?.props.style ?? []) as unknown[]).some(
      (style) =>
        typeof style === "object" &&
        style !== null &&
        (style as { opacity?: number }).opacity === 0.5,
    );

  beforeEach(() => {
    hooks.forceOpenPickers = false;
    hooks.setters = [];
  });

  it("leaves Cancel and Save live by default", () => {
    const tree = render();
    for (const label of ["Cancel", "Save memory"]) {
      expect(control(tree, label)?.props.disabled).toBe(false);
      expect(dimmed(control(tree, label))).toBe(false);
    }
  });

  it("disables and dims Cancel and Save while busy", () => {
    const tree = render(true);
    for (const label of ["Cancel", "Save memory"]) {
      expect(control(tree, label)?.props.disabled).toBe(true);
      expect(control(tree, label)?.props.accessibilityState).toEqual({
        disabled: true,
      });
      expect(dimmed(control(tree, label))).toBe(true);
    }
  });

  /** Calls a handler prop, failing loudly when the control or prop is missing. */
  const invoke = (
    element: TestElement | undefined,
    prop: string,
    ...args: unknown[]
  ) => {
    const handler = element?.props[prop];
    if (typeof handler !== "function") throw new Error(`missing ${prop}`);
    handler(...args);
  };
  const renderWith = (props: Partial<MemoryEditorProps>) =>
    nodes(
      MemoryEditor({
        items: [memory],
        initiallyEditingId: 5,
        onAdd: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        globalAiEnabled: true,
        busy: false,
        ...props,
      }),
    );
  const allowAiSwitch = (tree: TestElement[]) =>
    tree.find((n) => n.props.accessibilityLabel === "Allow AI to use this");

  it("leaves Delete and Allow AI live when idle; Delete goes to the host (D-69)", () => {
    const onDelete = vi.fn();
    const tree = renderWith({ onDelete });
    expect(control(tree, "Delete memory")?.props.disabled).toBe(false);
    invoke(control(tree, "Delete memory"), "onPress");
    expect(onDelete).toHaveBeenCalledWith(5);
    expect(allowAiSwitch(tree)?.props.busy).toBe(false);
  });

  it("holds Delete and Allow AI while busy (IN-01)", () => {
    const onDelete = vi.fn();
    const tree = renderWith({ onDelete, busy: true });
    const del = control(tree, "Delete memory");
    expect(del?.props.disabled).toBe(true);
    expect(del?.props.accessibilityState).toEqual({ disabled: true });
    expect(dimmed(del)).toBe(true);
    // Delete also closes the form locally, so it guards its own handler too.
    invoke(del, "onPress");
    expect(onDelete).not.toHaveBeenCalled();
    // Allow AI is announced busy, never drawn disabled (which would show Off
    // over a stored On, D-26), and ignores the tap.
    const allowAi = allowAiSwitch(tree);
    expect(allowAi?.props.busy).toBe(true);
    expect(allowAi?.props.disabled).toBe(false);
    invoke(allowAi, "onValueChange", true);
    expect(hooks.setters).toHaveLength(0);
  });

  it("closes on Delete only when the host accepts (third fix pass IN-01)", () => {
    const refused = renderWith({ onDelete: vi.fn(() => false) });
    invoke(control(refused, "Delete memory"), "onPress");
    expect(hooks.setters).toHaveLength(0);
    for (const accept of [vi.fn(() => true), vi.fn(() => undefined)]) {
      hooks.setters = [];
      const tree = renderWith({ onDelete: accept });
      invoke(control(tree, "Delete memory"), "onPress");
      // close(): setEditing + setDraft + setBaseline.
      expect(hooks.setters).toHaveLength(3);
    }
  });

  it("has no Restore and no Recently Deleted action (NEW-11, D-69)", () => {
    const tree = nodes(
      MemoryEditor({
        items: [{ ...memory, deleted_at: "2026-10-01 09:00:00" }],
        initiallyEditingId: 5,
        onAdd: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        globalAiEnabled: true,
      }),
    );
    expect(
      tree.some((n) =>
        /Restore|Recently Deleted/.test(
          String(n.props.accessibilityLabel ?? ""),
        ),
      ),
    ).toBe(false);
  });

  it("leaves the memory cards live when idle", () => {
    const tree = render(false);
    const cards = tree.filter((n) => n.type === "MemoryCard");
    expect(cards).toHaveLength(1);
    expect(cards[0]?.props.disabled).toBe(false);
    invoke(cards[0], "onPress");
    // openExisting: setEditing + setDraft + setBaseline + setAllowAiTouched.
    expect(hooks.setters).toHaveLength(4);
  });

  it("holds the memory cards while busy: drawn disabled, a tap keeps the draft (third fix pass WR-02)", () => {
    const tree = render(true);
    const cards = tree.filter((n) => n.type === "MemoryCard");
    expect(cards).toHaveLength(1);
    expect(cards[0]?.props.disabled).toBe(true);
    invoke(cards[0], "onPress");
    expect(hooks.setters).toHaveLength(0);
  });

  it("holds Add memory while busy (third fix pass WR-02)", () => {
    const renderClosed = (busy: boolean) =>
      nodes(
        MemoryEditor({
          items: [memory],
          onAdd: vi.fn(),
          onEdit: vi.fn(),
          onDelete: vi.fn(),
          globalAiEnabled: true,
          busy,
        }),
      );
    expect(control(renderClosed(false), "Add memory")?.props.disabled).toBe(
      false,
    );
    const held = control(renderClosed(true), "Add memory");
    expect(held?.props.disabled).toBe(true);
    expect(held?.props.accessibilityState).toEqual({ disabled: true });
    expect(dimmed(held)).toBe(true);
    invoke(held, "onPress");
    expect(hooks.setters).toHaveLength(0);
  });
});

describe("normalizeMemoryDraft (D-65)", () => {
  const draft: MemoryDraft = {
    ...initialDraft(),
    value: "  Trip  ",
    meaningfulDate: "2026-10-20",
  };

  it("keeps a picked date as stored", () => {
    expect(normalizeMemoryDraft(draft).meaningfulDate).toBe("2026-10-20");
    expect(normalizeMemoryDraft(draft).value).toBe("Trip");
  });

  it("turns a cleared or blank date into null", () => {
    expect(
      normalizeMemoryDraft({ ...draft, meaningfulDate: null }).meaningfulDate,
    ).toBeNull();
    expect(
      normalizeMemoryDraft({ ...draft, meaningfulDate: "" }).meaningfulDate,
    ).toBeNull();
  });

  it("a picked or cleared date makes the draft dirty (Plan 02 contract)", () => {
    const initial = initialDraft();
    expect(
      isMemoryDraftDirty(initial, { ...initial, meaningfulDate: "2026-10-20" }),
    ).toBe(true);
    const stored = { ...initial, meaningfulDate: "2026-10-20" };
    expect(
      isMemoryDraftDirty(stored, { ...stored, meaningfulDate: null }),
    ).toBe(true);
  });
});

describe("38.10 plan 13: the reworked editor", () => {
  type TestElement = ReactElement<Record<string, unknown>>;
  function nodes(node: ReactNode): TestElement[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    const element = node as TestElement;
    return [element, ...nodes(element.props.children as ReactNode)];
  }
  function texts(tree: TestElement[]): string[] {
    return tree.flatMap((node) => {
      const children = node.props.children;
      if (typeof children === "string") return [children];
      if (Array.isArray(children)) {
        return children.filter((c): c is string => typeof c === "string");
      }
      return [];
    });
  }
  const invoke = (
    element: TestElement | undefined,
    prop: string,
    ...args: unknown[]
  ) => {
    const handler = element?.props[prop];
    if (typeof handler !== "function") throw new Error(`missing ${prop}`);
    return handler(...args);
  };
  const row = (overrides: Partial<MemoryRow> = {}): MemoryRow =>
    ({
      id: 5,
      uid: "m-5",
      contact_id: 1,
      type: "general",
      custom_label: null,
      value: "Trip",
      note: null,
      url: null,
      meaningful_date: null,
      pinned: 0,
      outdated: 0,
      hidden: null,
      allow_ai: 0,
      provenance: "user",
      deleted_at: null,
      interaction_id: null,
      link_source: null,
      group_note_copy: 0,
      linked_note_ai_locked: 0,
      ...overrides,
    }) as MemoryRow;
  const render = (props: Partial<MemoryEditorProps>) =>
    nodes(
      MemoryEditor({
        items: [row()],
        onAdd: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        globalAiEnabled: true,
        ...props,
      }),
    );
  const byLabel = (tree: TestElement[], label: string) =>
    tree.find((n) => n.props.accessibilityLabel === label);
  const pressable = (tree: TestElement[], label: string) =>
    tree.find(
      (n) => n.type === "Pressable" && n.props.accessibilityLabel === label,
    );
  // The harness does not expand function components, so the type picker is
  // found as its own element.
  const typePicker = (tree: TestElement[]) =>
    tree.find(
      (n) => typeof n.type === "function" && n.type.name === "TypePicker",
    );

  beforeEach(() => {
    hooks.forceOpenPickers = false;
    hooks.draftOverride = null;
    hooks.setters = [];
  });

  describe("Allow AI is draft state (D-27, D-13)", () => {
    it("the switch shows on the Add form too", () => {
      const tree = render({ addOnly: true });
      expect(byLabel(tree, "Allow AI to use this")).toBeDefined();
    });

    it("a toggle updates the draft only; no host write", () => {
      const onEdit = vi.fn();
      const onAdd = vi.fn();
      const tree = render({ initiallyEditingId: 5, onEdit, onAdd });
      invoke(byLabel(tree, "Allow AI to use this"), "onValueChange", true);
      const updater = hooks.setters.find((s) => typeof s === "function") as (
        d: MemoryDraft,
      ) => MemoryDraft;
      expect(updater(initialDraft(row())).allowAi).toBe(1);
      expect(hooks.setters).toContain(true); // setAllowAiTouched(true)
      expect(onEdit).not.toHaveBeenCalled();
      expect(onAdd).not.toHaveBeenCalled();
    });

    it("toggling then Save hands onEdit the new allowAi", () => {
      const onEdit = vi.fn(async () => true);
      hooks.draftOverride = {
        ...initialDraft(row({ allow_ai: 1 })),
        allowAi: 0,
      };
      const tree = render({
        items: [row({ allow_ai: 1 })],
        initiallyEditingId: 5,
        onEdit,
      });
      invoke(pressable(tree, "Save memory"), "onPress");
      expect(onEdit).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ allowAi: 0 }),
      );
    });

    it("toggling then Cancel calls nothing on the host", () => {
      const onEdit = vi.fn();
      const onAdd = vi.fn();
      const onDelete = vi.fn();
      hooks.draftOverride = { ...initialDraft(row()), allowAi: 1 };
      const tree = render({ initiallyEditingId: 5, onEdit, onAdd, onDelete });
      invoke(pressable(tree, "Cancel"), "onPress");
      expect(onEdit).not.toHaveBeenCalled();
      expect(onAdd).not.toHaveBeenCalled();
      expect(onDelete).not.toHaveBeenCalled();
    });

    it("initialDraft reads allow_ai from the row", () => {
      expect(initialDraft(row({ allow_ai: 1 })).allowAi).toBe(1);
      expect(initialDraft(row()).allowAi).toBe(0);
      expect(initialDraft().allowAi).toBe(0);
    });
  });

  describe("locked switch (D-98, D-102, D-103)", () => {
    it.each([
      [
        "a Group Note copy",
        { group_note_copy: 1 },
        "Group Notes are never shared with AI.",
      ],
      [
        "a memory linked to a note locked by Off Limits",
        { interaction_id: 9, link_source: "note", linked_note_ai_locked: 1 },
        "Moved to Off Limits, so AI stays off.",
      ],
    ] as const)(
      "%s shows the switch off and disabled with its reason",
      (_, overrides, reason) => {
        const locked = row(overrides as Partial<MemoryRow>);
        const onEdit = vi.fn(async () => true);
        const tree = render({ items: [locked], initiallyEditingId: 5, onEdit });
        const sw = byLabel(tree, "Allow AI to use this");
        expect(sw?.props.disabled).toBe(true);
        expect(sw?.props.value).toBe(false);
        expect(texts(tree)).toContain(reason);
        invoke(sw, "onValueChange", true);
        expect(hooks.setters).toHaveLength(0);
        invoke(pressable(tree, "Save memory"), "onPress");
        expect(onEdit).toHaveBeenCalledWith(
          5,
          expect.objectContaining({ allowAi: 0 }),
        );
      },
    );

    it("a locked row never seeds allowAi 1, even if stored", () => {
      expect(
        initialDraft(row({ group_note_copy: 1, allow_ai: 1 })).allowAi,
      ).toBe(0);
    });
  });

  describe("addOnly", () => {
    it("renders no list and an open add form seeded from the type default", () => {
      const tree = render({
        addOnly: true,
        fixedType: "gift_idea",
        aiDefaults: { gift_idea: 1 },
      });
      expect(tree.some((n) => n.type === "MemoryCard")).toBe(false);
      expect(texts(tree)).toContain("Add memory");
      expect(byLabel(tree, "Allow AI to use this")?.props.value).toBe(true);
      expect(typePicker(tree)).toBeUndefined();
      expect(byLabel(tree, "Memory value")?.type).toBe("EntryTextField");
    });
  });

  describe("registered type kept and locked (D-25, D-35)", () => {
    it("keeps a gift idea's type on save", () => {
      const onEdit = vi.fn(async () => true);
      const gift = row({ type: "gift_idea" });
      const tree = render({ items: [gift], initiallyEditingId: 5, onEdit });
      invoke(pressable(tree, "Save memory"), "onPress");
      expect(onEdit).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ type: "gift_idea" }),
      );
    });

    it("an Imported row shows its type as text with no picker, and saves as imported", () => {
      const onEdit = vi.fn(async () => true);
      const imported = row({ type: "imported", provenance: "import" });
      const tree = render({ items: [imported], initiallyEditingId: 5, onEdit });
      expect(typePicker(tree)).toBeUndefined();
      expect(texts(tree)).toContain("Imported from Contacts App");
      expect(
        byLabel(tree, "Memory type, Imported from Contacts App"),
      ).toBeDefined();
      invoke(pressable(tree, "Save memory"), "onPress");
      expect(onEdit).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ type: "imported" }),
      );
    });

    it("a general row in the same editor still shows the picker", () => {
      const tree = render({ initiallyEditingId: 5 });
      expect(typePicker(tree)).toBeDefined();
    });

    it("a fixedType host hides the picker", () => {
      const tree = render({ initiallyEditingId: 5, fixedType: "general" });
      expect(typePicker(tree)).toBeUndefined();
    });
  });

  describe("draftAfterTypeChange (convergence c1 F-U3)", () => {
    const defaults = { general: 1, gift_idea: 0 } as const;
    it("an untouched new draft takes the new type's default", () => {
      const draft = newMemoryDraft({ aiDefaults: defaults });
      expect(draft.allowAi).toBe(1);
      const next = draftAfterTypeChange(draft, "gift_idea", {
        aiDefaults: defaults,
        allowAiTouched: false,
        isNew: true,
      });
      expect(next).toMatchObject({ type: "gift_idea", allowAi: 0 });
    });

    it("a touched switch keeps its choice", () => {
      const draft = {
        ...newMemoryDraft({ aiDefaults: defaults }),
        allowAi: 1 as const,
      };
      expect(
        draftAfterTypeChange(draft, "gift_idea", {
          aiDefaults: defaults,
          allowAiTouched: true,
          isNew: true,
        }).allowAi,
      ).toBe(1);
    });

    it("an existing entry's type change never changes allowAi", () => {
      const draft = initialDraft(row({ allow_ai: 1 }));
      expect(
        draftAfterTypeChange(draft, "gift_idea", {
          aiDefaults: defaults,
          allowAiTouched: false,
          isNew: false,
        }).allowAi,
      ).toBe(1);
    });

    it("no aiDefaults gives 0", () => {
      expect(
        draftAfterTypeChange(newMemoryDraft(), "thought_of_them", {
          allowAiTouched: false,
          isNew: true,
        }).allowAi,
      ).toBe(0);
    });

    it("the picker routes through it", () => {
      const tree = render({
        initiallyEditingId: undefined,
        addOnly: true,
        aiDefaults: defaults,
      });
      const picker = typePicker(tree);
      expect(picker).toBeDefined();
      invoke(picker, "onSelect", "gift_idea");
      const updater = hooks.setters.find((s) => typeof s === "function") as (
        d: MemoryDraft,
      ) => MemoryDraft;
      expect(updater(newMemoryDraft({ aiDefaults: defaults }))).toMatchObject({
        type: "gift_idea",
        allowAi: 0,
      });
    });
  });

  describe("D-107 linked entries", () => {
    const linked = row({ id: 7, interaction_id: 40, link_source: "note" });
    const plain = row({ id: 8 });

    it("a linked row's tap opens the interaction; long-press opens the form", () => {
      const onOpenLinked = vi.fn();
      const onTogglePin = vi.fn();
      const tree = render({
        items: [linked, plain],
        onOpenLinked,
        onTogglePin,
      });
      const [linkedCard, plainCard] = tree.filter(
        (n) => n.type === "MemoryCard",
      );
      invoke(linkedCard, "onPress");
      expect(onOpenLinked).toHaveBeenCalledWith(linked);
      expect(hooks.setters).toHaveLength(0);
      invoke(linkedCard, "onLongPress");
      // openExisting: setEditing + setDraft + setBaseline + setAllowAiTouched.
      expect(hooks.setters).toHaveLength(4);
      expect(hooks.setters[0]).toBe(linked);
      hooks.setters = [];
      invoke(plainCard, "onPress");
      expect(hooks.setters[0]).toBe(plain);
      expect(plainCard.props.onLongPress).toBeUndefined();
    });

    it("a linked row exposes Edit and Pin / Unpin, wired to the form and onTogglePin", () => {
      const onTogglePin = vi.fn();
      const pinned = { ...linked, pinned: 1 };
      const tree = render({
        items: [linked, pinned],
        onOpenLinked: vi.fn(),
        onTogglePin,
      });
      const [card, pinnedCard] = tree.filter((n) => n.type === "MemoryCard");
      expect(card.props.accessibilityActions).toEqual([
        { name: "edit", label: "Edit" },
        { name: "togglePin", label: "Pin" },
      ]);
      expect(pinnedCard.props.accessibilityActions).toEqual([
        { name: "edit", label: "Edit" },
        { name: "togglePin", label: "Unpin" },
      ]);
      expect(card.props.accessibilityLabel).toBe(
        "Open the interaction for this Memory entry",
      );
      invoke(card, "onAccessibilityAction", {
        nativeEvent: { actionName: "togglePin" },
      });
      expect(onTogglePin).toHaveBeenCalledWith(linked);
      invoke(card, "onAccessibilityAction", {
        nativeEvent: { actionName: "edit" },
      });
      expect(hooks.setters[0]).toBe(linked);
    });

    it("hosts without onOpenLinked keep tap-to-edit on linked rows", () => {
      const tree = render({ items: [linked] });
      const [card] = tree.filter((n) => n.type === "MemoryCard");
      invoke(card, "onPress");
      expect(hooks.setters[0]).toBe(linked);
      expect(card.props.accessibilityActions).toBeUndefined();
    });
  });

  describe("Show on Profile and Move (D-17, D-84)", () => {
    it("passes each row's callbacks to its card", () => {
      const onShowOnProfile = vi.fn();
      const onMove = vi.fn();
      const hidden = row({ hidden: 1 });
      const tree = render({ items: [hidden], onShowOnProfile, onMove });
      const [card] = tree.filter((n) => n.type === "MemoryCard");
      invoke(card, "onShowOnProfile");
      invoke(card, "onMove");
      expect(onShowOnProfile).toHaveBeenCalledWith(hidden);
      expect(onMove).toHaveBeenCalledWith(hidden);
    });

    it("hosts that pass neither render no new action", () => {
      const [card] = render({}).filter((n) => n.type === "MemoryCard");
      expect(card.props.onShowOnProfile).toBeUndefined();
      expect(card.props.onMove).toBeUndefined();
    });
  });

  describe("label-only memories (D-86, D-89 NEW-9; convergence c7)", () => {
    const labelOnly = row({ custom_label: "Anniversary", value: null });

    it("canSaveMemoryDraft: value only, label only, both blank", () => {
      expect(canSaveMemoryDraft({ ...initialDraft(), value: "Tea" })).toBe(
        true,
      );
      expect(
        canSaveMemoryDraft({ ...initialDraft(), customLabel: "Anniversary" }),
      ).toBe(true);
      expect(
        canSaveMemoryDraft({ ...initialDraft(), value: " ", customLabel: "" }),
      ).toBe(false);
    });

    it("shows the label, enables Save and saves the label with a null value", () => {
      const onEdit = vi.fn(async () => true);
      const tree = render({
        items: [labelOnly],
        initiallyEditingId: 5,
        onEdit,
      });
      expect(byLabel(tree, "Label (optional)")).toBeDefined();
      expect(pressable(tree, "Save memory")?.props.disabled).toBe(false);
      invoke(pressable(tree, "Save memory"), "onPress");
      expect(onEdit).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ value: null, customLabel: "Anniversary" }),
      );
    });

    it("Enter on the value field runs the same guarded save", () => {
      const onEdit = vi.fn(async () => true);
      const tree = render({
        items: [labelOnly],
        initiallyEditingId: 5,
        onEdit,
      });
      invoke(byLabel(tree, "Memory value"), "onSubmit");
      expect(onEdit).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ value: null, customLabel: "Anniversary" }),
      );
    });

    it("Enter on a blank draft saves nothing", () => {
      const onAdd = vi.fn(async () => true);
      const tree = render({ addOnly: true, onAdd });
      invoke(byLabel(tree, "Memory value"), "onSubmit");
      expect(onAdd).not.toHaveBeenCalled();
      expect(pressable(tree, "Add memory")?.props.disabled).toBe(true);
    });
  });

  describe("clean baseline (38.9 D-14/D-15; convergence c7, Claude C-02)", () => {
    it("an untouched fixed-type Add is clean", () => {
      expect(
        memoryDraftState(
          newMemoryDraft({ fixedType: "gift_idea" }),
          newMemoryDraft({ fixedType: "gift_idea" }),
        ),
      ).toEqual({ open: true, dirty: false });
    });

    it("an untouched default-on Add is clean", () => {
      const seeded = newMemoryDraft({ aiDefaults: { general: 1 } });
      expect(seeded.allowAi).toBe(1);
      expect(memoryDraftState(seeded, { ...seeded })).toEqual({
        open: true,
        dirty: false,
      });
    });

    it("initialEditorState's baseline equals its draft", () => {
      const state = initialEditorState([row()], 5);
      expect(state.baseline).toEqual(state.draft);
    });

    it("a new draft whose type changed from its baseline is dirty", () => {
      const seeded = newMemoryDraft();
      expect(
        memoryDraftState(seeded, { ...seeded, type: "thought_of_them" }).dirty,
      ).toBe(true);
    });
  });

  describe("opt-in primary Add (D-67; convergence c7, Claude C-03)", () => {
    it("renders a primary Button with the host's label", () => {
      const tree = render({ addButton: { label: "Add Gift Idea" } });
      const button = tree.find((n) => n.type === "Button");
      expect(button?.props.role).toBe("primary");
      expect(button?.props.label).toBe("Add Gift Idea");
      invoke(button, "onPress");
      // openNew: setEditing + setDraft + setBaseline + setAllowAiTouched.
      expect(hooks.setters).toHaveLength(4);
      expect(pressable(tree, "Add memory")).toBeUndefined();
    });

    it("without it the outlined Add memory action renders as today", () => {
      const tree = render({});
      expect(tree.some((n) => n.type === "Button")).toBe(false);
      expect(pressable(tree, "Add memory")).toBeDefined();
    });

    it("showAdd false renders no Add action", () => {
      const tree = render({ showAdd: false });
      expect(tree.some((n) => n.type === "Button")).toBe(false);
      expect(pressable(tree, "Add memory")).toBeUndefined();
    });
  });
});

describe("Link validation (G-13 via D-89)", () => {
  type TestElement = ReactElement<Record<string, unknown>>;
  function nodes(node: ReactNode): TestElement[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    const element = node as TestElement;
    return [element, ...nodes(element.props.children as ReactNode)];
  }
  /** Calls a handler prop, failing loudly when it is missing. */
  const call = (element: TestElement | undefined, prop: string) => {
    const handler = element?.props[prop];
    if (typeof handler !== "function") throw new Error(`missing ${prop}`);
    handler();
  };
  const draft = (url: string | null): MemoryDraft => ({
    ...initialDraft(),
    value: "Gift",
    url,
  });

  beforeEach(() => {
    hooks.forceOpenPickers = false;
    hooks.draftOverride = null;
    hooks.setters = [];
  });

  it("a blank or web link saves; another scheme or plain words do not", () => {
    expect(memoryLinkError(draft(null))).toBeNull();
    expect(memoryLinkError(draft("example.com"))).toBeNull();
    expect(memoryLinkError(draft("https://example.com/x"))).toBeNull();
    expect(memoryLinkError(draft("javascript:alert(1)"))).toBe(
      "Enter a web link, like example.com",
    );
    expect(canSaveMemoryDraft(draft("hello world"))).toBe(false);
  });

  it("shows the FieldError and holds Save while the link is invalid", () => {
    const onAdd = vi.fn(async () => true);
    hooks.draftOverride = draft("not a link");
    const tree = nodes(
      MemoryEditor({
        items: [],
        addOnly: true,
        onAdd,
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        globalAiEnabled: true,
      }),
    );
    const error = tree.find((n) => n.type === "FieldError");
    expect(error?.props.message).toBe("Enter a web link, like example.com");
    const save = tree.find(
      (n) =>
        n.type === "Pressable" && n.props.accessibilityLabel === "Add memory",
    );
    expect(save?.props.disabled).toBe(true);
    call(
      tree.find((n) => n.props.accessibilityLabel === "Memory value"),
      "onSubmit",
    );
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("a double tap on Save commits once (G-15)", () => {
    const onAdd = vi.fn(() => new Promise<boolean>(() => {}));
    hooks.draftOverride = draft(null);
    const tree = nodes(
      MemoryEditor({
        items: [],
        addOnly: true,
        onAdd,
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        globalAiEnabled: true,
      }),
    );
    const save = tree.find(
      (n) =>
        n.type === "Pressable" && n.props.accessibilityLabel === "Add memory",
    );
    call(save, "onPress");
    call(save, "onPress");
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe("card edit mode (D-130)", () => {
  type TestElement = ReactElement<Record<string, unknown>>;
  function nodes(node: ReactNode): TestElement[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    const element = node as TestElement;
    return [element, ...nodes(element.props.children as ReactNode)];
  }
  const invoke = (
    element: TestElement | undefined,
    prop: string,
    ...args: unknown[]
  ) => {
    const handler = element?.props[prop];
    if (typeof handler !== "function") throw new Error(`missing ${prop}`);
    return handler(...args);
  };
  const row = (id: number, overrides: Partial<MemoryRow> = {}): MemoryRow =>
    ({
      id,
      uid: `m-${id}`,
      contact_id: 1,
      type: "gift_idea",
      custom_label: null,
      value: `Gift ${id}`,
      note: null,
      url: null,
      meaningful_date: null,
      pinned: 0,
      outdated: 0,
      hidden: null,
      allow_ai: 0,
      provenance: "user",
      deleted_at: null,
      interaction_id: null,
      link_source: null,
      group_note_copy: 0,
      linked_note_ai_locked: 0,
      ...overrides,
    }) as MemoryRow;
  const items = [row(1), row(2), row(3)];
  const kinds = (slots: ReturnType<typeof memoryEditorSlots>) =>
    slots.map((slot) => (slot.kind === "card" ? slot.item.id : slot.kind));
  const base = {
    items,
    editingId: null,
    adding: false,
    cardEditMode: true,
    addOnly: false,
    showAdd: true,
  };

  beforeEach(() => {
    hooks.forceOpenPickers = false;
    hooks.draftOverride = null;
    hooks.setters = [];
    openMemoryLink.mockClear();
  });

  describe("memoryEditorSlots", () => {
    it("puts an open edit's form at its card's index, then the Add", () => {
      expect(kinds(memoryEditorSlots({ ...base, editingId: 2 }))).toEqual([
        1,
        "form",
        3,
        "add",
      ]);
    });

    it("without cardEditMode keeps today's order: every card, then the form", () => {
      expect(
        kinds(
          memoryEditorSlots({ ...base, editingId: 2, cardEditMode: false }),
        ),
      ).toEqual([1, 2, 3, "form"]);
    });

    it("a new entry's form stays where the Add was", () => {
      expect(kinds(memoryEditorSlots({ ...base, adding: true }))).toEqual([
        1,
        2,
        3,
        "form",
      ]);
    });

    it("addOnly gives only the form; showAdd false and no draft gives only cards", () => {
      expect(
        kinds(memoryEditorSlots({ ...base, addOnly: true, adding: true })),
      ).toEqual(["form"]);
      expect(kinds(memoryEditorSlots({ ...base, showAdd: false }))).toEqual([
        1, 2, 3,
      ]);
      expect(kinds(memoryEditorSlots(base))).toEqual([1, 2, 3, "add"]);
    });

    it("an edited row no longer in the list keeps its form at the end", () => {
      expect(kinds(memoryEditorSlots({ ...base, editingId: 9 }))).toEqual([
        1,
        2,
        3,
        "form",
      ]);
    });

    describe('addPlacement "top" (D-131)', () => {
      const top = { ...base, addPlacement: "top" as const };

      it("puts the add slot first, then the cards", () => {
        expect(kinds(memoryEditorSlots(top))).toEqual(["add", 1, 2, 3]);
      });

      it("a new entry's form opens in the add slot, above the cards", () => {
        expect(kinds(memoryEditorSlots({ ...top, adding: true }))).toEqual([
          "form",
          1,
          2,
          3,
        ]);
      });

      it("an open in-place edit still takes its card's index", () => {
        expect(kinds(memoryEditorSlots({ ...top, editingId: 2 }))).toEqual([
          "add",
          1,
          "form",
          3,
        ]);
      });

      it("showAdd false gives only the cards; a removed edited row's form goes last", () => {
        expect(kinds(memoryEditorSlots({ ...top, showAdd: false }))).toEqual([
          1, 2, 3,
        ]);
        expect(kinds(memoryEditorSlots({ ...top, editingId: 9 }))).toEqual([
          1,
          2,
          3,
          "form",
        ]);
      });

      it("the default stays at the end", () => {
        expect(
          kinds(memoryEditorSlots({ ...base, addPlacement: undefined })),
        ).toEqual([1, 2, 3, "add"]);
      });
    });
  });

  const render = (props: Partial<MemoryEditorProps> = {}) =>
    MemoryEditor({
      items,
      onAdd: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      globalAiEnabled: true,
      fixedType: "gift_idea",
      cardEditMode: true,
      ...props,
    }) as TestElement;
  const children = (root: TestElement) =>
    (root.props.children as TestElement[]).filter(Boolean);

  it("opens the edited card's form in its place, with Move and a red Delete before the fields", () => {
    const onMove = vi.fn();
    const root = render({ initiallyEditingId: 2, onMove });
    const slots = children(root);
    expect(slots.map((n) => n.type)).toEqual([
      "MemoryCard",
      "View",
      "MemoryCard",
      "Pressable",
    ]);
    expect(slots[0]?.props.memory).toBe(items[0]);
    expect(slots[2]?.props.memory).toBe(items[2]);
    const form = nodes(slots[1]);
    const ordered = form.map((n) =>
      n.type === "Button"
        ? `Button:${String(n.props.role)}:${String(n.props.label)}`
        : String(n.props.accessibilityLabel ?? ""),
    );
    const move = ordered.indexOf("Button:secondary:Move");
    const del = ordered.indexOf("Button:destructive:Delete");
    const value = ordered.indexOf("Memory value");
    expect(move).toBeGreaterThanOrEqual(0);
    expect(del).toBeGreaterThan(move);
    expect(value).toBeGreaterThan(del);
    // The bottom Delete Pressable is not rendered in card edit mode.
    expect(
      form.some(
        (n) =>
          n.type === "Pressable" &&
          n.props.accessibilityLabel === "Delete memory",
      ),
    ).toBe(false);
    // Cards: no Move at rest, a pencil on each, held while the form is open.
    for (const card of [slots[0], slots[2]]) {
      expect(card?.props.onMove).toBeUndefined();
      expect(typeof card?.props.onEditPress).toBe("function");
      expect(card?.props.disabled).toBe(true);
    }
    // The Add is held while the form is open.
    expect(slots[3]?.props.disabled).toBe(true);
  });

  it('addPlacement "top" renders no Add of its own (the host renders the bar)', () => {
    const resting = children(render({ addPlacement: "top" }));
    expect(resting.map((n) => n.type)).toEqual([
      "MemoryCard",
      "MemoryCard",
      "MemoryCard",
    ]);
    expect(
      nodes(render({ addPlacement: "top" })).some(
        (n) =>
          (n.type === "Button" && n.props.role === "primary") ||
          n.props.accessibilityLabel === "Add memory",
      ),
    ).toBe(false);
    const editing = children(
      render({ addPlacement: "top", initiallyEditingId: 2 }),
    );
    expect(editing.map((n) => n.type)).toEqual([
      "MemoryCard",
      "View",
      "MemoryCard",
    ]);
  });

  it("each resting card gets a pencil that opens its form, and no Move", () => {
    const onMove = vi.fn();
    const cards = children(render({ onMove })).filter(
      (n) => n.type === "MemoryCard",
    );
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.props.onMove).toBeUndefined();
      expect(card.props.disabled).toBe(false);
    }
    invoke(cards[1], "onEditPress");
    // openExisting: setEditing + setDraft + setBaseline + setAllowAiTouched.
    expect(hooks.setters).toHaveLength(4);
    expect(hooks.setters[0]).toBe(items[1]);
  });

  it("a linked card keeps tap-to-open (D-107) and its pencil opens edit mode", () => {
    const linked = row(4, { interaction_id: 40, link_source: "note" });
    const onOpenLinked = vi.fn();
    const [card] = children(render({ items: [linked], onOpenLinked })).filter(
      (n) => n.type === "MemoryCard",
    );
    invoke(card, "onPress");
    expect(onOpenLinked).toHaveBeenCalledWith(linked);
    expect(hooks.setters).toHaveLength(0);
    invoke(card, "onEditPress");
    expect(hooks.setters[0]).toBe(linked);
  });

  it("Delete keeps the host contract: refused stays open, accepted closes", () => {
    const refused = vi.fn(() => false);
    const del = (root: TestElement) =>
      nodes(root).find(
        (n) => n.type === "Button" && n.props.role === "destructive",
      );
    invoke(
      del(render({ initiallyEditingId: 2, onDelete: refused })),
      "onPress",
    );
    expect(refused).toHaveBeenCalledWith(2);
    expect(hooks.setters).toHaveLength(0);
    const accepted = vi.fn();
    invoke(
      del(render({ initiallyEditingId: 2, onDelete: accepted })),
      "onPress",
    );
    expect(accepted).toHaveBeenCalledWith(2);
    // close(): setEditing + setDraft + setBaseline.
    expect(hooks.setters).toHaveLength(3);
  });

  it("Move closes through the host's dirty-aware close, then hands over the row", () => {
    const onMove = vi.fn();
    let requested: (() => void) | null = null;
    const onCancelRequest = vi.fn((close: () => void) => {
      requested = close;
    });
    const move = nodes(
      render({ initiallyEditingId: 2, onMove, onCancelRequest }),
    ).find((n) => n.type === "Button" && n.props.label === "Move");
    invoke(move, "onPress");
    expect(onCancelRequest).toHaveBeenCalledTimes(1);
    expect(onMove).not.toHaveBeenCalled();
    (requested as unknown as () => void)();
    expect(hooks.setters).toHaveLength(3);
    expect(onMove).toHaveBeenCalledWith(items[1]);
  });

  it("no onMove (Imported) gives Delete only", () => {
    const tree = nodes(render({ initiallyEditingId: 2 }));
    expect(
      tree.some((n) => n.type === "Button" && n.props.label === "Move"),
    ).toBe(false);
    expect(
      tree.some((n) => n.type === "Button" && n.props.role === "destructive"),
    ).toBe(true);
  });

  it("the open form shows the stored Open link (D-24)", () => {
    const linkRow = row(2, { url: "https://example.com/gift" });
    const tree = nodes(
      render({ items: [items[0], linkRow, items[2]], initiallyEditingId: 2 }),
    );
    const link = tree.find(
      (n) => n.props.accessibilityLabel === "Open memory link",
    );
    expect(link?.props.accessibilityRole).toBe("link");
    invoke(link, "onPress");
    expect(openMemoryLink).toHaveBeenCalledWith("https://example.com/gift");
  });

  it("without cardEditMode the cards keep Move and get no pencil", () => {
    const onMove = vi.fn();
    const root = render({
      cardEditMode: undefined,
      onMove,
      initiallyEditingId: 2,
    });
    const slots = children(root);
    expect(slots.map((n) => n.type)).toEqual([
      "MemoryCard",
      "MemoryCard",
      "MemoryCard",
      "View",
    ]);
    for (const card of slots.slice(0, 3)) {
      expect(typeof card.props.onMove).toBe("function");
      expect(card.props.onEditPress).toBeUndefined();
    }
    const form = nodes(slots[3]);
    expect(form.some((n) => n.type === "Button")).toBe(false);
    expect(
      form.some(
        (n) =>
          n.type === "Pressable" &&
          n.props.accessibilityLabel === "Delete memory",
      ),
    ).toBe(true);
  });
});
