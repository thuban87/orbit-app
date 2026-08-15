/**
 * log-guards — pure future-date guard proof (LOG-06).
 *
 * No DB: the guard is a string comparison over local wall-clock `occurred_at`
 * values. These cases pin the boundary (future rejected, equal allowed, past
 * allowed) that both the record path (recency-dao) and the refine-form UI share.
 */
import { describe, expect, it } from "vitest";
import { rejectFutureOccurredAt } from "@/db/log-guards";

describe("rejectFutureOccurredAt", () => {
  it("throws when occurredAt is in the future", () => {
    expect(() =>
      rejectFutureOccurredAt("2026-08-20 09:00:00", "2026-08-15 12:00:00"),
    ).toThrow(/future/i);
  });

  it("does NOT throw when occurredAt equals now (equal is allowed)", () => {
    expect(() =>
      rejectFutureOccurredAt("2026-08-15 12:00:00", "2026-08-15 12:00:00"),
    ).not.toThrow();
  });

  it("does NOT throw when occurredAt is in the past", () => {
    expect(() =>
      rejectFutureOccurredAt("2026-08-01 23:59:00", "2026-08-15 12:00:00"),
    ).not.toThrow();
  });

  it("throws on a same-day but later-in-the-day occurredAt (full datetime compare)", () => {
    expect(() =>
      rejectFutureOccurredAt("2026-08-15 12:00:01", "2026-08-15 12:00:00"),
    ).toThrow(/future/i);
  });

  // MED-1: a lexical `>` alone lets a malformed value (which sorts BEFORE a real
  // `now`) slip past the future check and get persisted. Strict shape + calendar
  // validation must REJECT these before the compare.
  it.each([
    ["empty string", ""],
    ["whitespace only", "   "],
    ["a bare date with no time", "2026-08-15"],
    ["a nonsense calendar datetime", "2026-13-40 99:99:99"],
    ["non-date text", "not-a-date"],
    ["a non-zero-padded value", "2026-8-1 9:5:3"],
    ["an impossible calendar day (Feb 30)", "2026-02-30 10:00:00"],
    ["a trailing-whitespace value", "2026-08-01 10:00:00 "],
  ])("throws when occurredAt is %s (malformed → reject)", (_label, bad) => {
    expect(() => rejectFutureOccurredAt(bad, "2026-08-15 12:00:00")).toThrow();
  });

  it("throws when now itself is malformed", () => {
    expect(() =>
      rejectFutureOccurredAt("2026-08-01 10:00:00", "not-a-date"),
    ).toThrow();
  });

  it("allows a well-formed past value at the boundary of the year", () => {
    expect(() =>
      rejectFutureOccurredAt("2025-12-31 23:59:59", "2026-08-15 12:00:00"),
    ).not.toThrow();
  });
});
