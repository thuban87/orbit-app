import { describe, expect, it } from "vitest";
import { phoneRegionValueLabel } from "./settings-lifecycle-logic";

describe("SettingsScreen lifecycle settings presentation", () => {
  it("labels a persisted region or the device-region fallback without exposing method identity", () => {
    expect(phoneRegionValueLabel("US", "United States")).toBe(
      "United States (US)",
    );
    expect(phoneRegionValueLabel(null, null)).toBe("Use device region");
  });
});
