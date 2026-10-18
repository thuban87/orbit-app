import { describe, expect, it } from "vitest";
import { customFieldValueError } from "./field-value-error";

/**
 * Edit Contact's explanation for a flagged custom value (38.12 D-70; C-4):
 * present exactly when `isFlaggedCustomValue` flags the value, with the
 * type's problem and expected format, or the dropdown's current options.
 */
describe("customFieldValueError (38.12 D-70; C-4)", () => {
  it("explains a value its type's parser rejects", () => {
    expect(
      customFieldValueError({ type: "date", options: null }, "not a date"),
    ).toEqual({
      problem: "This isn't a valid date",
      expectedFormat: "Use YYYY-MM-DD",
    });
    expect(
      customFieldValueError({ type: "number", options: null }, "about 60k")
        ?.problem,
    ).toBe("This isn't a number");
    expect(
      customFieldValueError({ type: "toggle", options: null }, "maybe")
        ?.problem,
    ).toBe("This isn't Yes or No");
  });

  it("lists the current options for a dropdown value no longer among them", () => {
    expect(
      customFieldValueError(
        { type: "dropdown", options: JSON.stringify(["Platinum", "Bronze"]) },
        "Gold",
      ),
    ).toEqual({
      problem: "This is no longer one of the options",
      expectedFormat: "Choose one of: Platinum, Bronze",
    });
  });

  it("returns null for a value that is not flagged", () => {
    expect(
      customFieldValueError({ type: "date", options: null }, "2026-10-20"),
    ).toBeNull();
    expect(
      customFieldValueError(
        { type: "dropdown", options: JSON.stringify(["Platinum"]) },
        "Platinum",
      ),
    ).toBeNull();
    expect(
      customFieldValueError({ type: "date", options: null }, null),
    ).toBeNull();
    expect(
      customFieldValueError({ type: "text", options: null }, "anything"),
    ).toBeNull();
  });
});
