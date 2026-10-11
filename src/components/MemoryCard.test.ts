import { describe, expect, it, vi } from "vitest";

const { openURL } = vi.hoisted(() => ({
  openURL: vi.fn(() => Promise.resolve()),
}));
vi.mock("react-native", () => ({
  Linking: { openURL },
  Pressable: "Pressable",
  StyleSheet: { create: <T>(styles: T) => styles },
  View: "View",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("./icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("./ui", () => ({ AppText: "AppText" }));

import type { MemoryRow } from "@/db/memories-read";
import { MemoryCard, openMemoryLink } from "./MemoryCard";

describe("openMemoryLink", () => {
  it("only passes an http/https-normalised URL to the OS", () => {
    openMemoryLink("intent://scan/#Intent;scheme=zxing;end");
    openMemoryLink("javascript://alert(1)");

    expect(openURL).toHaveBeenNthCalledWith(
      1,
      "https://scan/#Intent;scheme=zxing;end",
    );
    expect(openURL).toHaveBeenNthCalledWith(2, "https://alert(1)");
  });
});

describe("MemoryCard disabled (D-26; 38.9 third fix pass WR-02)", () => {
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
  type CardElement = { type: unknown; props: Record<string, unknown> };

  it("is a live button by default", () => {
    const onPress = vi.fn();
    const card = MemoryCard({ memory, onPress }) as unknown as CardElement;
    expect(card.type).toBe("Pressable");
    expect(card.props.disabled).toBe(false);
    expect(card.props.accessibilityState).toEqual({ disabled: false });
    expect(card.props.onPress).toBe(onPress);
    expect(card.props.style).toBeNull();
  });

  it("holds the press and draws the Button disabled look when disabled", () => {
    const onPress = vi.fn();
    const card = MemoryCard({
      memory,
      onPress,
      disabled: true,
    }) as unknown as CardElement;
    expect(card.props.disabled).toBe(true);
    expect(card.props.accessibilityState).toEqual({ disabled: true });
    expect(card.props.onPress).toBeUndefined();
    expect(card.props.style).toEqual({ opacity: 0.5 });
  });
});
