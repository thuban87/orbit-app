/**
 * Inline-validation primitive logic (38.9 D-19).
 *
 * One rule for every form: the error text sits under its field, it clears when
 * that field changes, and Save reveals the FIRST blocking field. The pure
 * helpers are tested here; the scroll itself is device-checked in 38.9-17
 * (RESEARCH A5).
 *
 * The source assertion at the bottom pins the E-X01 fix: under the new
 * architecture `measureLayout` ignores a numeric `findNodeHandle` result (it
 * logs a dev-only error and never scrolls), so Add Contact and Edit Contact
 * must measure against the ScrollView's content host view instead.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clearFieldError,
  firstBlockingField,
  toFieldErrors,
} from "./field-error-logic";

describe("firstBlockingField (D-19)", () => {
  it("returns the first field in reveal order that has an error", () => {
    expect(
      firstBlockingField(["name", "category"], {
        name: "Enter a name to save.",
      }),
    ).toBe("name");
    expect(
      firstBlockingField(["name", "frequency"], {
        frequency: "Pick a valid frequency.",
      }),
    ).toBe("frequency");
    expect(
      firstBlockingField(["name", "frequency"], {
        frequency: "Pick a valid frequency.",
        name: "Enter a name to save.",
      }),
    ).toBe("name");
  });

  it("returns null when there are no errors", () => {
    expect(firstBlockingField(["name", "category"], {})).toBeNull();
  });

  it("ignores empty messages and fields outside the reveal order", () => {
    expect(firstBlockingField(["name"], { name: "" })).toBeNull();
    expect(firstBlockingField(["name"], { other: "Broken" })).toBeNull();
  });
});

describe("clearFieldError (D-19)", () => {
  it("removes only that key", () => {
    const errors = {
      name: "Enter a name to save.",
      frequency: "Pick a valid frequency.",
    };
    const next = clearFieldError(errors, "name");
    expect(next).toEqual({ frequency: "Pick a valid frequency." });
    // The input record is not mutated.
    expect(errors.name).toBe("Enter a name to save.");
  });

  it("returns the same record when the field has no error (no re-render)", () => {
    const errors = { frequency: "Pick a valid frequency." };
    expect(clearFieldError(errors, "name")).toBe(errors);
  });
});

describe("toFieldErrors (D-19)", () => {
  it("keeps the first message per field and skips message-less errors", () => {
    expect(
      toFieldErrors([
        { field: "name", message: "Enter a name to save." },
        { field: "name", message: "Second" },
        { field: "frequency" },
      ]),
    ).toEqual({ name: "Enter a name to save." });
  });
});

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("no numeric node handle reaches measureLayout (E-X01)", () => {
  it("Add Contact measures against the ScrollView content view", () => {
    const source = read("src/screens/CreateContactScreen.tsx");
    expect(source).not.toMatch(/findNodeHandle/);
    expect(source).toMatch(/innerViewRef=\{contentRef\}/);
  });

  it("Edit Contact measures against the ScrollView content view", () => {
    const source = read("src/screens/EditContactScreen.tsx");
    expect(source).not.toMatch(/findNodeHandle/);
    expect(source).toMatch(/innerViewRef=\{contentRef\}/);
  });
});

describe("bulk-frequency sheet validation is inline (D-40, A-13; 38.13 D-39)", () => {
  // ADR-199 (38.9 D-19) names this sheet: FieldError under the field, Save
  // stays pressable, and a blocked Save reveals the error. 38.13 D-39 made the
  // field the shared FrequencyPicker; its Custom… error renders through
  // FieldError for this sheet, and a blocked Continue forces and announces it
  // (38.13 review B-CR-01 restored this control after 38.13-10 inverted it).
  it("keeps Continue pressable and reveals the picker's FieldError, never snackbars", () => {
    const sheet = read("src/components/BulkFrequencySheet.tsx");
    expect(sheet).toMatch(
      /<FrequencyPicker[\s\S]*?onValidityChange=\{setValid\}/,
    );
    expect(sheet).toMatch(
      /<FrequencyPicker[\s\S]*?errorForced=\{forceError\}[\s\S]*?errorAsFieldError/,
    );
    const button = sheet.slice(
      sheet.indexOf('testID="bulk-frequency-continue"'),
    );
    expect(button).not.toMatch(/disabled=/);
    expect(button).toMatch(/if \(!valid\) \{[\s\S]*?setForceError\(true\)/);
    expect(button).toMatch(/announceForAccessibility\(/);
    expect(sheet).not.toMatch(/showSnackbar\(/);
    expect(sheet).not.toMatch(/<TextInput/);
  });

  it("the picker renders that opt-in error through FieldError", () => {
    const picker = read("src/components/FrequencyPicker.tsx");
    expect(picker).toMatch(
      /errorAsFieldError \? \([\s\S]*?<FieldError[\s\S]*?message=\{showError \? INVALID_INTERVAL_MESSAGE : null\}/,
    );
  });

  it("HomeScreen hosts the sheet instead of its own days field", () => {
    const home = read("src/screens/HomeScreen.tsx");
    expect(home).toMatch(/<BulkFrequencySheet\b/);
    expect(home).not.toMatch(/bulk-frequency-input/);
  });
});
