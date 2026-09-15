import { describe, expect, it } from "vitest";
import { MESSAGE_MODES } from "@/db/app-settings-dao";
import { MESSAGE_MODE_OPTIONS } from "./settings-interactions-logic";

describe("settings interactions logic — message mode (D-04a)", () => {
  it("exposes exactly the DAO's MESSAGE_MODES, in order", () => {
    expect(MESSAGE_MODE_OPTIONS.map((option) => option.value)).toEqual([
      ...MESSAGE_MODES,
    ]);
  });

  it("pairs each mode with the exact patch it writes", () => {
    for (const option of MESSAGE_MODE_OPTIONS) {
      expect(option.patch).toEqual({ defaultMessageMode: option.value });
    }
  });

  it("carries a non-empty display label for every mode", () => {
    for (const option of MESSAGE_MODE_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});
