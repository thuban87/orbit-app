import { describe, expect, it } from "vitest";
import { selectorAccessibilityValue, selectorItems } from "./selector-a11y";

describe("selectorItems (out-of-list preservation, RG-030)", () => {
  it("prepends an out-of-list stored value so it is never dropped", () => {
    expect(selectorItems("custom", ["a", "b"])).toEqual(["custom", "a", "b"]);
  });

  it("does not duplicate a stored value that is already an option", () => {
    expect(selectorItems("a", ["a", "b"])).toEqual(["a", "b"]);
  });

  it("returns the options unchanged when there is no value", () => {
    const options = ["a", "b"];
    expect(selectorItems(null, options)).toEqual(["a", "b"]);
    expect(selectorItems(undefined, options)).toEqual(["a", "b"]);
    expect(selectorItems("", options)).toEqual(["a", "b"]);
  });

  it("does not mutate the caller's options", () => {
    const options = ["a", "b"];
    selectorItems("custom", options);
    expect(options).toEqual(["a", "b"]);
  });
});

describe("selectorAccessibilityValue (AUD-UIA-005)", () => {
  it("exposes the current value as text", () => {
    expect(selectorAccessibilityValue("custom")).toEqual({ text: "custom" });
  });

  it("announces 'No value' for an empty selection", () => {
    expect(selectorAccessibilityValue(null)).toEqual({ text: "No value" });
    expect(selectorAccessibilityValue(undefined)).toEqual({ text: "No value" });
    expect(selectorAccessibilityValue("")).toEqual({ text: "No value" });
  });
});
