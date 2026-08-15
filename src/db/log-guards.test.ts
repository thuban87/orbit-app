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
});
