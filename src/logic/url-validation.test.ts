import { describe, expect, it, vi } from "vitest";

// LinksEditor is a component file; only its pure normaliser is used here.
vi.mock("react-native", () => ({
  Linking: {},
  Pressable: "Pressable",
  StyleSheet: { create: <T>(styles: T) => styles },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

import { normaliseLinkUrl } from "@/components/LinksEditor";
import {
  hasUrlScheme,
  isValidHttpUrl,
  isValidLinkInput,
} from "./url-validation";

describe("isValidHttpUrl (38.10 G-13, D-24)", () => {
  it.each([
    "https://example.com",
    "http://example.com/gift?id=3",
    "https://shop.example.co.uk/item#top",
    "HTTPS://Example.com",
  ])("accepts %s", (url) => {
    expect(isValidHttpUrl(url)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "javascript:alert(1)",
    "javascript://alert(1)",
    "intent://scan/#Intent;scheme=zxing;end",
    "file:///sdcard/x",
    "example.com",
    "just some words",
    "https://",
    "https:///path",
    "https://exa mple.com",
    "http//example.com",
  ])("rejects %j", (url) => {
    expect(isValidHttpUrl(url)).toBe(false);
  });
});

describe("hasUrlScheme", () => {
  it("sees a dot-free scheme, as normaliseLinkUrl does", () => {
    expect(hasUrlScheme("https://x.com")).toBe(true);
    expect(hasUrlScheme("javascript:alert(1)")).toBe(true);
    expect(hasUrlScheme("example.com")).toBe(false);
    expect(hasUrlScheme("example.com:8080/p")).toBe(false);
  });
});

describe("isValidLinkInput (the memory form's Link field)", () => {
  const check = (raw: string) => isValidLinkInput(raw, normaliseLinkUrl);

  it("a blank link is fine: the field is optional", () => {
    expect(check("")).toBe(true);
    expect(check("  ")).toBe(true);
  });

  it("a missing scheme gets https:// only through normaliseLinkUrl", () => {
    expect(check("example.com")).toBe(true);
    expect(check("example.com:8080/p")).toBe(true);
  });

  it("rejects other schemes and text that is no address", () => {
    expect(check("javascript:alert(1)")).toBe(false);
    expect(check("intent://scan/#Intent;end")).toBe(false);
    expect(check("hello world")).toBe(false);
  });

  it("accepts a typed http(s) URL", () => {
    expect(check("https://example.com/a")).toBe(true);
  });
});
