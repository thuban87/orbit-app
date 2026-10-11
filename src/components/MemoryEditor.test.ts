import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hooks are stubbed so the editor renders as a plain function (the
// photo-field-widget-render pattern): `useState` returns its initial value,
// or `true` for a `false` boolean while `forceOpenPickers` is set, so the
// native date picker can be reached; every setter is recorded.
const hooks = vi.hoisted(() => ({
  forceOpenPickers: false,
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
vi.mock("./MemoryCard", () => ({ MemoryCard: "MemoryCard" }));
vi.mock("./ui", () => ({ AppText: "AppText", OrbitSwitch: "OrbitSwitch" }));

import type { MemoryRow } from "@/db/memories-read";
import {
  initialDraft,
  initialEditorState,
  isMemoryDraftDirty,
  type MemoryDraft,
  MemoryEditor,
  memoryDraftState,
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
  const memory = { id: 42, type: "custom", value: "Likes kayaks" } as MemoryRow;

  it("opens the named memory's form with no tap on its card", () => {
    const state = initialEditorState([memory], 42);
    expect(state.editing).toBe(memory);
    expect(state.draft?.value).toBe("Likes kayaks");
  });

  it("stays closed without an id or when the id is not among the items", () => {
    expect(initialEditorState([memory])).toEqual({
      editing: null,
      draft: null,
    });
    expect(initialEditorState([memory], 7)).toEqual({
      editing: null,
      draft: null,
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

  it("memoryDraftState reports open and dirty", () => {
    expect(memoryDraftState(null, null)).toEqual({ open: false, dirty: false });
    expect(memoryDraftState(null, initialDraft())).toEqual({
      open: true,
      dirty: false,
    });
    expect(memoryDraftState(memory, initialDraft(memory))).toEqual({
      open: true,
      dirty: false,
    });
    expect(
      memoryDraftState(null, { ...initialDraft(), value: "Birthday" }),
    ).toEqual({ open: true, dirty: true });
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
        onRestore: vi.fn(),
        onSetAllowAi: vi.fn(),
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
