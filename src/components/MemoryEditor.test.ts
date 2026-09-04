import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  FlatList: "FlatList",
  Modal: "Modal",
  Pressable: "Pressable",
  StyleSheet: {
    absoluteFill: {},
    create: <T,>(styles: T) => styles,
    hairlineWidth: 1,
  },
  Switch: "Switch",
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("./MemoryCard", () => ({ MemoryCard: "MemoryCard" }));
vi.mock("./ui", () => ({ AppText: "AppText" }));

import { initialDraft } from "./MemoryEditor";
import type { MemoryRow } from "@/db/memories-read";

describe("initialDraft", () => {
  it("retains inherited visibility for an existing Memory", () => {
    const memory = { hidden: null } as MemoryRow;

    expect(initialDraft(memory).hidden).toBeNull();
  });
});
