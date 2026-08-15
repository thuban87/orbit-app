/**
 * col_name producer — construction-safety proof (FLD-02, T-03-01).
 *
 * Pure Vitest (no DB): the whole point of the whitelist-construction approach is
 * that col_name safety is provable without a database. Asserts injection payloads
 * become ordinary slugs, reserved/duplicate/quarantined collisions all uniquify,
 * leading-digit labels get the `f_` prefix, and `isSafeColName` rejects anything
 * that could break out of a quoted identifier.
 */
import { describe, expect, it } from "vitest";
import { isSafeColName, makeColName, slugify } from "@/db/col-name";

describe("slugify", () => {
  it("turns a SQL-injection payload label into a safe identifier with no original punctuation", () => {
    const payload = `"; DROP TABLE contacts; -- '`;
    const slug = slugify(payload);
    expect(isSafeColName(slug)).toBe(true);
    // None of the injection punctuation survives.
    expect(slug).not.toMatch(/["';()-]/);
    expect(slug).not.toContain(" ");
  });

  it("prefixes f_ when the label starts with a digit", () => {
    const slug = slugify("123 birthday");
    expect(slug.startsWith("f_")).toBe(true);
    expect(isSafeColName(slug)).toBe(true);
  });

  it("prefixes f_ when the label slugs to empty", () => {
    expect(isSafeColName(slugify("!!! ???"))).toBe(true);
    expect(isSafeColName(slugify(""))).toBe(true);
  });

  it("collapses runs of punctuation/whitespace into a single underscore and trims edges", () => {
    expect(slugify("  Social   Battery!!  ")).toBe("social_battery");
  });

  it("always produces an isSafeColName-passing value for arbitrary unicode/symbols", () => {
    for (const label of ["日本語", "@@@", "a-b-c", "Field #1", "  ", "___"]) {
      expect(isSafeColName(slugify(label))).toBe(true);
    }
  });
});

describe("makeColName", () => {
  it("uniquifies a label that slugs to a reserved fixed-column name", () => {
    // "Phone" slugs to `phone`, a reserved contacts column.
    const col = makeColName("Phone", new Set());
    expect(col).toBe("phone_2");
    expect(isSafeColName(col)).toBe(true);
  });

  it("suffixes when two fields share the same label", () => {
    const first = makeColName("Favourite Colour", new Set());
    const second = makeColName("Favourite Colour", new Set([first]));
    expect(first).toBe("favourite_colour");
    expect(second).toBe("favourite_colour_2");
    expect(first).not.toBe(second);
  });

  it("suffixes when a still-present quarantined field already owns the slug (review MED)", () => {
    // The quarantined field's col_name is in `existing`; re-creating its label
    // must NOT return the colliding name — it must uniquify.
    const label = "Nickname";
    const quarantinedCol = slugify(label); // "nickname"
    const col = makeColName(label, new Set([quarantinedCol]));
    expect(col).toBe("nickname_2");
    expect(col).not.toBe(quarantinedCol);
  });

  it("walks past multiple taken suffixes", () => {
    const taken = new Set(["tag", "tag_2", "tag_3"]);
    expect(makeColName("Tag", taken)).toBe("tag_4");
  });

  it("never returns an unsafe name for an injection-payload label", () => {
    expect(
      isSafeColName(makeColName(`'); DROP TABLE contacts;--`, new Set())),
    ).toBe(true);
  });
});

describe("isSafeColName", () => {
  it("accepts well-formed identifiers", () => {
    expect(isSafeColName("phone")).toBe(true);
    expect(isSafeColName("f_123")).toBe(true);
    expect(isSafeColName("a_b_2")).toBe(true);
  });

  it("rejects a double-quote, a space, or a leading digit", () => {
    expect(isSafeColName('col"name')).toBe(false);
    expect(isSafeColName("col name")).toBe(false);
    expect(isSafeColName("2cats")).toBe(false);
    expect(isSafeColName("")).toBe(false);
    expect(isSafeColName("_leading")).toBe(false);
    expect(isSafeColName("Upper")).toBe(false);
  });
});
