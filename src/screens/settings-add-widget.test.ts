import { describe, expect, it } from "vitest";
import { ADD_WIDGET_FALLBACK_COPY, pinResultCopy } from "./settings-add-widget";

describe("pinResultCopy", () => {
  it("returns null when the launcher accepted the pin request (true)", () => {
    // A true result means the launcher accepted the request — no message to show.
    expect(pinResultCopy(true)).toBeNull();
  });

  it("returns the verbatim UI-SPEC fallback copy when the request was refused (false)", () => {
    // false = unsupported launcher / API < 26 / a rejected request (mapped to
    // false by the caller) → surface the exact fallback copy.
    expect(pinResultCopy(false)).toBe(ADD_WIDGET_FALLBACK_COPY);
  });

  it("uses the exact UI-SPEC fallback string", () => {
    expect(ADD_WIDGET_FALLBACK_COPY).toBe(
      "Your launcher can't add it automatically — add Orbit from your home screen's widget menu.",
    );
  });
});
