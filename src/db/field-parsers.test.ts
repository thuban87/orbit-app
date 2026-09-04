/**
 * Pure Vitest coverage for the 10 target-type parsers + isValueInOptions
 * (FLD-04). No DB, no expo — these are pure string functions.
 *
 * The two load-bearing invariants under test: (1) every FieldType has a parser
 * (exhaustiveness), and (2) an unconvertible input FLAGS (`ok:false`) and is
 * never rewritten or cleared (T-03-04 — parsers never destroy data).
 */
import { describe, expect, it } from "vitest";
import {
  isValueInOptions,
  type ParseResult,
  parsers,
} from "@/db/field-parsers";
import type { CustomFieldDef } from "@/db/field-types";
import type { FieldType } from "@/schemas/types";

/** Narrow assert: the result accepted with the given canonical value. */
function expectOk(result: ParseResult, value: string | null): void {
  expect(result).toEqual({ ok: true, value });
}

describe("parsers — exhaustiveness", () => {
  it("has exactly one parser per FieldType key", () => {
    const allTypes: FieldType[] = [
      "text",
      "textarea",
      "dropdown",
      "date",
      "toggle",
      "number",
      "photo",
      "url",
      "email",
      "phone",
    ];
    for (const t of allTypes) {
      expect(typeof parsers[t]).toBe("function");
    }
    // No stray keys beyond the 10 target types.
    expect(Object.keys(parsers).sort()).toEqual([...allTypes].sort());
  });
});

describe("parsers.text / textarea / photo — identity pass-through", () => {
  it("accepts arbitrary text unchanged, including digits and punctuation", () => {
    expectOk(parsers.text("2 dogs, 1 cat"), "2 dogs, 1 cat");
    expectOk(parsers.textarea("line1\nline2"), "line1\nline2");
    expectOk(parsers.photo("file:///photo.jpg"), "file:///photo.jpg");
  });

  it("is null-safe (null → ok null)", () => {
    expectOk(parsers.text(null), null);
    expectOk(parsers.textarea(null), null);
    expectOk(parsers.photo(null), null);
  });
});

describe("parsers.dropdown — identity (membership is the caller's concern)", () => {
  it("passes any value through unchanged and never flags", () => {
    expectOk(parsers.dropdown("anything"), "anything");
    expectOk(parsers.dropdown(null), null);
  });
});

describe("parsers.url / email / phone — permissive raw-TEXT validation", () => {
  it("accepts plausible URLs unchanged and flags a space-separated non-URL", () => {
    const localDev = "http://localhost:3000/path?q=hello";
    expectOk(parsers.url("https://example.com"), "https://example.com");
    expectOk(parsers.url("example.com"), "example.com");
    expectOk(parsers.url(localDev), localDev);
    expectOk(parsers.url("mailto:person@example.com"), "mailto:person@example.com");
    expect(parsers.url("not a url with spaces only")).toEqual({ ok: false });
  });

  it("accepts plausible emails unchanged and requires one @ plus a domain dot", () => {
    const plusAddress = "a+tag@b.co";
    expectOk(parsers.email("a@b.co"), "a@b.co");
    expectOk(parsers.email(plusAddress), plusAddress);
    expect(parsers.email("a@b")).toEqual({ ok: false });
    expect(parsers.email("plainstring")).toEqual({ ok: false });
  });

  it("accepts plausible phones unchanged and flags non-phone prose", () => {
    const internationalExtension = "+44 (0)20 7946 0018 ext. 42";
    expectOk(parsers.phone("+1 (555) 123-4567"), "+1 (555) 123-4567");
    expectOk(parsers.phone("555.123.4567"), "555.123.4567");
    expectOk(parsers.phone(internationalExtension), internationalExtension);
    expect(parsers.phone("call me maybe")).toEqual({ ok: false });
  });

  it("treats null and blank values as absent without rewriting them", () => {
    for (const type of ["url", "email", "phone"] as const) {
      expectOk(parsers[type](null), null);
      expectOk(parsers[type](""), null);
      expectOk(parsers[type]("   "), null);
    }
  });
});

describe("parsers.number", () => {
  it("empty/null → ok null", () => {
    expectOk(parsers.number(null), null);
    expectOk(parsers.number(""), null);
    expectOk(parsers.number("   "), null);
  });

  it("strips thousands commas and canonicalises via String(n)", () => {
    expectOk(parsers.number("1,234"), "1234");
    expectOk(parsers.number("  42 "), "42");
    expectOk(parsers.number("3.50"), "3.5");
    expectOk(parsers.number("-7"), "-7");
  });

  it("flags a non-numeric value (never coerces)", () => {
    expect(parsers.number("about 60k")).toEqual({ ok: false });
    expect(parsers.number("12abc")).toEqual({ ok: false });
  });
});

describe("parsers.date", () => {
  it("empty/null → ok null", () => {
    expectOk(parsers.date(null), null);
    expectOk(parsers.date(""), null);
  });

  it("canonicalises a leading YYYY-MM-DD, tolerating trailing text", () => {
    expectOk(parsers.date("2026-08-14"), "2026-08-14");
    expectOk(parsers.date("2026-08-14 extra"), "2026-08-14");
    expectOk(parsers.date("2026-08-14T10:00:00Z"), "2026-08-14");
  });

  it("flags a non-ISO date shape", () => {
    expect(parsers.date("14/08/2026")).toEqual({ ok: false });
    expect(parsers.date("Aug 14 2026")).toEqual({ ok: false });
  });
});

describe("parsers.toggle", () => {
  it("empty/null → ok null", () => {
    expectOk(parsers.toggle(null), null);
    expectOk(parsers.toggle(""), null);
  });

  it("maps truthy words to canonical '1'", () => {
    for (const s of ["yes", "true", "y", "on", "YES", " On "]) {
      expectOk(parsers.toggle(s), "1");
    }
  });

  it("maps falsy words to canonical '0'", () => {
    for (const s of ["no", "false", "n", "off", "none", "NO"]) {
      expectOk(parsers.toggle(s), "0");
    }
  });

  it("treats a finite number as nonzero → '1', zero → '0' (§14.4)", () => {
    expectOk(parsers.toggle("3"), "1");
    expectOk(parsers.toggle("0"), "0");
    expectOk(parsers.toggle("-2"), "1");
  });

  it("flags an uninterpretable value", () => {
    expect(parsers.toggle("maybe")).toEqual({ ok: false });
  });
});

describe("parsers — never throw, never clear", () => {
  it("returns a result object for every parser on hostile input", () => {
    const hostile = "'; DROP TABLE contacts; --";
    for (const t of Object.keys(parsers) as FieldType[]) {
      expect(() => parsers[t](hostile)).not.toThrow();
    }
    // A flagged value is signalled, not rewritten to "" or null.
    expect(parsers.number("about 60k")).toEqual({ ok: false });
    expect(parsers.date("nope")).toEqual({ ok: false });
    expect(parsers.toggle("maybe")).toEqual({ ok: false });
  });
});

describe("isValueInOptions", () => {
  const dropdown = (
    options: string | null,
  ): Pick<CustomFieldDef, "type" | "options"> => ({
    type: "dropdown",
    options,
  });

  it("returns dropdown membership for a parseable options array", () => {
    const f = dropdown(JSON.stringify(["a", "b"]));
    expect(isValueInOptions(f, "a")).toBe(true);
    expect(isValueInOptions(f, "c")).toBe(false);
  });

  it("treats an empty/null value as present (absent, not wrong)", () => {
    const f = dropdown(JSON.stringify(["a", "b"]));
    expect(isValueInOptions(f, "")).toBe(true);
    expect(isValueInOptions(f, null)).toBe(true);
  });

  it("returns true for any value on a non-dropdown field (not applicable)", () => {
    expect(isValueInOptions({ type: "text", options: null }, "x")).toBe(true);
    expect(isValueInOptions({ type: "number", options: null }, "12")).toBe(
      true,
    );
  });

  it("returns true when options are null or malformed (unclassifiable)", () => {
    expect(isValueInOptions(dropdown(null), "x")).toBe(true);
    expect(isValueInOptions(dropdown("{not json"), "x")).toBe(true);
    expect(
      isValueInOptions(dropdown(JSON.stringify({ not: "array" })), "x"),
    ).toBe(true);
  });
});
