import { describe, expect, it } from "vitest";
import {
  deviceRegionCaption,
  phoneRegionValueLabel,
} from "./settings-lifecycle-logic";

describe("SettingsScreen lifecycle settings presentation", () => {
  it("labels a persisted region or the device-region fallback without exposing method identity", () => {
    expect(phoneRegionValueLabel("US", "United States")).toBe(
      "United States (US)",
    );
    expect(phoneRegionValueLabel(null, null)).toBe("Use device region");
  });
});

describe("Use device region caption (D-79; 38.12 D-IN-13)", () => {
  it("names the device's country with its code, or Unavailable", () => {
    expect(deviceRegionCaption("GB", "United Kingdom")).toBe(
      "United Kingdom (GB)",
    );
    expect(deviceRegionCaption("ZZ", null)).toBe("ZZ (ZZ)");
    expect(deviceRegionCaption(null, null)).toBe("Unavailable");
  });
});
