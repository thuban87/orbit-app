import { describe, expect, it, vi } from "vitest";

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
import { initialDraft, initialEditorState } from "./MemoryEditor";

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
