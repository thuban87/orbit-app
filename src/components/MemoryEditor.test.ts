import { describe, expect, it, vi } from "vitest";

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
  Switch: "Switch",
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("./icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("./MemoryCard", () => ({ MemoryCard: "MemoryCard" }));
vi.mock("./ui", () => ({ AppText: "AppText" }));

import type { MemoryRow } from "@/db/memories-read";
import {
  initialDraft,
  initialEditorState,
  isMemoryDraftDirty,
  memoryDraftState,
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
