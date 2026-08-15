/**
 * Unit tests for src/components/tri-state-last-spoke-logic.ts (CRUD-02).
 *
 * Future-date rejection is the entry-time guard for T-04-05 — a future
 * occurred_at must never pin a contact `stable`. Tested here (node Vitest)
 * since the .tsx component imports react-native + the native datetimepicker
 * and cannot load in this env. Dates format through formatLocalDate (never
 * toISOString) so the evening-hours UTC off-by-one cannot reappear.
 */
import { describe, expect, it } from "vitest";
import {
  FUTURE_DATE_MESSAGE,
  isFutureLocalDate,
  resolvePickedDate,
} from "@/components/tri-state-last-spoke-logic";

const NOW = new Date(2026, 7, 15, 12, 0, 0); // Aug 15 2026, noon local

describe("FUTURE_DATE_MESSAGE", () => {
  it("is the exact locked copy", () => {
    expect(FUTURE_DATE_MESSAGE).toBe(
      "That date is in the future. Pick today or earlier.",
    );
  });
});

describe("isFutureLocalDate", () => {
  it("treats the same calendar day as NOT future (even later in the day)", () => {
    const laterToday = new Date(2026, 7, 15, 23, 30, 0);
    expect(isFutureLocalDate(laterToday, NOW)).toBe(false);
  });

  it("treats a past day as NOT future", () => {
    expect(isFutureLocalDate(new Date(2026, 7, 14, 0, 0, 0), NOW)).toBe(false);
  });

  it("treats a later calendar day as future", () => {
    expect(isFutureLocalDate(new Date(2026, 7, 16, 0, 0, 0), NOW)).toBe(true);
  });
});

describe("resolvePickedDate", () => {
  it("rejects a future date with the locked copy and emits no value", () => {
    const result = resolvePickedDate(new Date(2026, 7, 16, 9, 0, 0), NOW);
    expect(result).toEqual({
      rejected: true,
      value: null,
      message: FUTURE_DATE_MESSAGE,
    });
  });

  it("accepts today and emits a { kind: 'date' } local-date value", () => {
    const result = resolvePickedDate(new Date(2026, 7, 15, 23, 30, 0), NOW);
    expect(result).toEqual({
      rejected: false,
      value: { kind: "date", date: "2026-08-15" },
      message: null,
    });
  });

  it("accepts a past date and formats it via formatLocalDate", () => {
    const result = resolvePickedDate(new Date(2026, 0, 5, 8, 0, 0), NOW);
    expect(result).toEqual({
      rejected: false,
      value: { kind: "date", date: "2026-01-05" },
      message: null,
    });
  });
});
