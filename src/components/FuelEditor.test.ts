import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  FlatList: "FlatList",
  Linking: { openURL: () => Promise.resolve() },
  Pressable: "Pressable",
  StyleSheet: {
    create: <T>(styles: T) => styles,
    absoluteFill: {},
    hairlineWidth: 1,
  },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/components/ui/RegisteredModal", () => ({
  RegisteredModal: "RegisteredModal",
}));
vi.mock("./icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("./LinksEditor", () => ({ normaliseLinkUrl: (url: string) => url }));
vi.mock("@/services/fuel-age", () => ({ formatFuelAge: () => "" }));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

import { fuelDraftState, isFuelDraftDirty } from "./FuelEditor";

describe("fuel draft dirty state (38.9 review CR-01; D-14)", () => {
  const blank = { text: "", label: "", url: "" };

  it("an untouched or typed-then-erased draft is clean", () => {
    expect(isFuelDraftDirty(blank)).toBe(false);
    expect(isFuelDraftDirty({ text: "  ", label: "\n", url: " " })).toBe(false);
  });

  it("typed text, label or link makes the draft dirty", () => {
    expect(isFuelDraftDirty({ ...blank, text: "Politics" })).toBe(true);
    expect(isFuelDraftDirty({ ...blank, label: "Work" })).toBe(true);
    expect(isFuelDraftDirty({ ...blank, url: "example.com" })).toBe(true);
  });

  it("only an open draft reports dirty", () => {
    expect(fuelDraftState(false, true)).toEqual({ open: false, dirty: false });
    expect(fuelDraftState(true, false)).toEqual({ open: true, dirty: false });
    expect(fuelDraftState(true, true)).toEqual({ open: true, dirty: true });
  });
});
