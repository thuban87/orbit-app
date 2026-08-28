import { describe, expect, it } from "vitest";
import {
  phoneRegionOverridePatch,
  resolveSettingsPhoneRegion,
} from "./settings-region-logic";

describe("phone region settings logic", () => {
  it("uses a persisted override before the device region", () => {
    expect(resolveSettingsPhoneRegion("GB", "US")).toBe("GB");
  });

  it("uses the device region when no override is persisted", () => {
    expect(resolveSettingsPhoneRegion(null, "US")).toBe("US");
  });

  it("emits a normalized override patch or an explicit device-region null patch", () => {
    expect(phoneRegionOverridePatch(" gb ")).toEqual({ phoneRegionOverride: "GB" });
    expect(phoneRegionOverridePatch("")).toEqual({ phoneRegionOverride: null });
  });
});
