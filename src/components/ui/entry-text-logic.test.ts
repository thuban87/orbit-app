import { describe, expect, it } from "vitest";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import {
  ENTRY_VERTICAL_PADDING,
  ENTRY_VISIBLE_LINES,
  entryFieldMaxHeight,
  isSavableEntry,
  normalizeEntryText,
  sanitizeEntryChange,
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

const newlines = (s: string) => (s.match(/\r\n|\r|\n/g) ?? []).length;

describe("sanitizeEntryChange (D-129: only new line breaks are flattened)", () => {
  it("keeps the line breaks of a stored multi-line value edited mid-line", () => {
    const stored = "First paragraph\nSecond line\r\nThird";
    // Fix a typo in the middle of the second line: "Second" -> "Secand".
    const next = stored.replace("Second", "Secand");
    expect(sanitizeEntryChange(stored, next)).toBe(next);
    // Type one character at the end; every stored break survives.
    expect(sanitizeEntryChange(stored, `${stored}!`)).toBe(`${stored}!`);
  });

  it("flattens a pasted multi-line chunk", () => {
    expect(sanitizeEntryChange("Hello ", "Hello a\nb\r\nc")).toBe(
      "Hello a b c",
    );
    // Pasted into a stored multi-line value: the stored break is kept.
    expect(sanitizeEntryChange("x\ny", "x\nP\nQy")).toBe("x\nP Qy");
  });

  it("flattens a newline typed at the end", () => {
    expect(sanitizeEntryChange("abc", "abc\n")).toBe("abc ");
    expect(sanitizeEntryChange("a\n", "a\n\n")).toBe("a\n ");
  });

  it("flattens a newline typed next to a stored one", () => {
    expect(sanitizeEntryChange("a\nb", "a\n\nb")).toBe("a\n b");
  });

  it("lets a stored line break be deleted", () => {
    expect(sanitizeEntryChange("a\nb", "ab")).toBe("ab");
  });

  it("flattens a paste that replaces the whole value", () => {
    expect(sanitizeEntryChange("x\ny", "p\nq")).toBe("p q");
  });

  it("round-trips typing one character at a time and never trims", () => {
    let value = "";
    for (const char of "hello world ") {
      value = sanitizeEntryChange(value, value + char);
    }
    expect(value).toBe("hello world ");
  });

  it("never returns more line breaks than the previous value had", () => {
    const cases: [string, string][] = [
      ["", "\n\n"],
      ["a\nb", "a\nb\n"],
      ["a\nb", "\na\nb"],
      ["a\r\nb", "a\r\n\r\nb"],
      ["a\rb", "a\r\nb"],
    ];
    for (const [previous, next] of cases) {
      expect(newlines(sanitizeEntryChange(previous, next))).toBeLessThanOrEqual(
        newlines(previous),
      );
    }
  });
});

describe("normalizeEntryText (at save only)", () => {
  it("trims and keeps line breaks already in the value (D-129)", () => {
    expect(normalizeEntryText("  a\nb  ")).toBe("a\nb");
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

describe("entryFieldMaxHeight (D-66 about 3 lines; D-147)", () => {
  const LINE = TYPOGRAPHY.body.lineHeight;
  const PAD = 2 * ENTRY_VERTICAL_PADDING;

  it("fits 3 whole body lines plus padding at font scale 1", () => {
    expect(ENTRY_VISIBLE_LINES).toBe(3);
    expect(entryFieldMaxHeight(1)).toBe(3 * LINE + PAD);
  });

  it("grows with the font scale, so the first line is never cut (1.15, the test phones)", () => {
    for (const scale of [0.85, 1, 1.15, 1.3, 2]) {
      const cap = entryFieldMaxHeight(scale);
      // Android scales the field's lineHeight by the font scale.
      expect(cap - PAD).toBeGreaterThanOrEqual(
        ENTRY_VISIBLE_LINES * LINE * scale,
      );
      expect(cap - PAD).toBeLessThan(ENTRY_VISIBLE_LINES * LINE * scale + 1);
    }
    expect(entryFieldMaxHeight(1.15)).toBeGreaterThan(entryFieldMaxHeight(1));
  });

  it("treats a missing or bad scale as 1", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(entryFieldMaxHeight(bad)).toBe(entryFieldMaxHeight(1));
    }
  });
});
