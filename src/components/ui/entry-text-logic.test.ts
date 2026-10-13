import { describe, expect, it } from "vitest";
import {
  isSavableEntry,
  normalizeEntryText,
  sanitizeEntryInput,
} from "./entry-text-logic";

describe("sanitizeEntryInput (while typing; convergence c1 F-U2, Codex C-05)", () => {
  it("never trims, so a typed trailing space survives", () => {
    expect(sanitizeEntryInput("hello ")).toBe("hello ");
    expect(sanitizeEntryInput(" leading")).toBe(" leading");
  });

  it("round-trips typing one character at a time", () => {
    const target = "hello world";
    let value = "";
    for (const char of target) {
      value = sanitizeEntryInput(value + char);
    }
    expect(value).toBe(target);
  });

  it("turns each pasted newline into a single space", () => {
    expect(sanitizeEntryInput("a\nb")).toBe("a b");
    expect(sanitizeEntryInput("a\r\nb")).toBe("a b");
    expect(sanitizeEntryInput("a\rb")).toBe("a b");
    expect(sanitizeEntryInput("a\n\nb")).toBe("a  b");
  });
});

describe("normalizeEntryText (at save only)", () => {
  it("is sanitizeEntryInput plus trim", () => {
    expect(normalizeEntryText("  a\nb  ")).toBe("a b");
    expect(normalizeEntryText("hello ")).toBe("hello");
    expect(normalizeEntryText("\nx\n")).toBe("x");
  });
});

describe("isSavableEntry", () => {
  it("is false for a blank or whitespace-only value", () => {
    expect(isSavableEntry("")).toBe(false);
    expect(isSavableEntry("   ")).toBe(false);
    expect(isSavableEntry("\n\r\n ")).toBe(false);
  });

  it("is true once there is visible text", () => {
    expect(isSavableEntry(" a ")).toBe(true);
  });
});
