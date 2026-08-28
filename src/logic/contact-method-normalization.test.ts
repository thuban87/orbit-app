import { describe, expect, it } from "vitest";
import { normalizeContactMethod } from "@/logic/contact-method-normalization";

describe("normalizeContactMethod", () => {
  it("canonicalizes a device-region national phone to E.164", () => {
    expect(
      normalizeContactMethod({ type: "phone", value: " (312) 555-1234 ", defaultPhoneRegion: "US" }),
    ).toMatchObject({
      displayValue: "(312) 555-1234",
      canonicalValue: "+13125551234",
      isActionable: true,
      extension: null,
      canonicalRegion: "US",
    });
  });

  it("parses explicit international values independently of the device region", () => {
    expect(
      normalizeContactMethod({ type: "phone", value: "+44 20 7946 0958", defaultPhoneRegion: "US" }),
    ).toMatchObject({ canonicalValue: "+442079460958", isActionable: true, canonicalRegion: "GB" });
  });

  it("retains extensions and produces a derived display value", () => {
    expect(
      normalizeContactMethod({ type: "phone", value: "+1 312 555 1234 ext. 22", defaultPhoneRegion: null }),
    ).toMatchObject({ canonicalValue: "+13125551234", extension: "22", isActionable: true });
  });

  it("retains a right-length invalid national number as non-actionable", () => {
    expect(
      normalizeContactMethod({ type: "phone", value: "211 555 1234", defaultPhoneRegion: "US" }),
    ).toEqual({
      rawValue: "211 555 1234",
      displayValue: "211 555 1234",
      canonicalValue: null,
      canonicalRegion: null,
      extension: null,
      isActionable: false,
    });
  });

  it("fails closed for national values without a device region", () => {
    expect(
      normalizeContactMethod({ type: "phone", value: "312 555 1234", defaultPhoneRegion: null }),
    ).toMatchObject({ canonicalValue: null, canonicalRegion: null, isActionable: false });
  });

  it("uses trimmed ASCII case-folded equality for valid email", () => {
    expect(
      normalizeContactMethod({ type: "email", value: " Person@Example.COM ", defaultPhoneRegion: null }),
    ).toEqual({
      rawValue: "Person@Example.COM",
      displayValue: "Person@Example.COM",
      canonicalValue: "person@example.com",
      canonicalRegion: null,
      extension: null,
      isActionable: true,
    });
  });

  it("stores malformed nonblank email input without making it actionable", () => {
    expect(
      normalizeContactMethod({ type: "email", value: "not an email", defaultPhoneRegion: null }),
    ).toMatchObject({ canonicalValue: null, isActionable: false });
  });
});
