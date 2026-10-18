import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * One disabled dim across the shared controls (38.9 D-26; 38.12 D-IN-13):
 * SettingsRow, Button, SegmentedControl and OptionSelectRow all draw a
 * disabled control at the same opacity.
 */

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

const { SETTINGS_ROW_DISABLED_OPACITY } = await import("./SettingsRow");

const read = (file: string) => readFileSync(join(__dirname, file), "utf8");

describe("the shared disabled dim", () => {
  it("is 0.5 on SettingsRow", () => {
    expect(SETTINGS_ROW_DISABLED_OPACITY).toBe(0.5);
  });

  it("OptionSelectRow uses SettingsRow's constant, not its own value", () => {
    const source = read("OptionSelectRow.tsx");
    expect(source).toContain(
      "disabled: { opacity: SETTINGS_ROW_DISABLED_OPACITY }",
    );
  });

  it("Button and SegmentedControl draw the same value", () => {
    expect(read("Button.tsx")).toContain(
      `opacity: disabled ? ${SETTINGS_ROW_DISABLED_OPACITY} : 1`,
    );
    expect(read("../SegmentedControl.tsx")).toContain(
      `SEGMENTED_DISABLED_OPACITY = ${SETTINGS_ROW_DISABLED_OPACITY};`,
    );
  });
});
