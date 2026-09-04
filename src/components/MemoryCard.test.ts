import { describe, expect, it, vi } from "vitest";

const { openURL } = vi.hoisted(() => ({ openURL: vi.fn(() => Promise.resolve()) }));
vi.mock("react-native", () => ({
  Linking: { openURL },
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: "View",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("./icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("./ui", () => ({ AppText: "AppText" }));

import { openMemoryLink } from "./MemoryCard";

describe("openMemoryLink", () => {
  it("only passes an http/https-normalised URL to the OS", () => {
    openMemoryLink("intent://scan/#Intent;scheme=zxing;end");
    openMemoryLink("javascript://alert(1)");

    expect(openURL).toHaveBeenNthCalledWith(1, "https://scan/#Intent;scheme=zxing;end");
    expect(openURL).toHaveBeenNthCalledWith(2, "https://alert(1)");
  });
});
