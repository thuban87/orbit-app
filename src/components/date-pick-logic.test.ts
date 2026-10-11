import { describe, expect, it } from "vitest";
import { formatLocalDate } from "@/utils/dates";
import {
  isPickableStoredDate,
  pickerSeedFromStored,
  storedFromPickerEvent,
} from "./date-pick-logic";

/**
 * Pure helpers behind the two native date pickers (38.9 D-65 memory meaningful
 * date, D-66 custom Date field). Stored form is YYYY-MM-DD via formatLocalDate
 * (D-23); nothing here formats for display.
 */
const NOW = new Date(2026, 9, 10, 9, 0);

function sameLocalDay(date: Date, y: number, m: number, d: number) {
  expect(date.getFullYear()).toBe(y);
  expect(date.getMonth()).toBe(m - 1);
  expect(date.getDate()).toBe(d);
}

describe("storedFromPickerEvent (D-23)", () => {
  it("stores a set date as the local YYYY-MM-DD, even late in the evening", () => {
    expect(storedFromPickerEvent("set", new Date(2026, 9, 20, 23, 30))).toBe(
      "2026-10-20",
    );
  });

  it("emits nothing on dismiss or without a date", () => {
    expect(storedFromPickerEvent("dismissed", new Date(2026, 9, 20))).toBe(
      null,
    );
    expect(storedFromPickerEvent("set", undefined)).toBe(null);
    expect(storedFromPickerEvent("neutralButtonPressed", NOW)).toBe(null);
  });

  it("allows a date a year ahead (D-67: no range limit)", () => {
    const ahead = new Date(
      NOW.getFullYear() + 1,
      NOW.getMonth(),
      NOW.getDate(),
    );
    const stored = storedFromPickerEvent("set", ahead);
    expect(stored).toBe(formatLocalDate(ahead));
    sameLocalDay(
      pickerSeedFromStored(stored, NOW),
      ahead.getFullYear(),
      ahead.getMonth() + 1,
      ahead.getDate(),
    );
  });

  it("allows a date far in the past (D-67)", () => {
    expect(storedFromPickerEvent("set", new Date(1950, 0, 2))).toBe(
      "1950-01-02",
    );
  });
});

describe("pickerSeedFromStored", () => {
  it("seeds a valid stored date", () => {
    sameLocalDay(pickerSeedFromStored("2026-10-20", NOW), 2026, 10, 20);
  });

  it("seeds a leading valid date with trailing text", () => {
    sameLocalDay(pickerSeedFromStored("2026-03-04 trip", NOW), 2026, 3, 4);
  });

  it("seeds a parser-valid value with leading whitespace (C6-L6)", () => {
    sameLocalDay(pickerSeedFromStored(" 2026-10-20", NOW), 2026, 10, 20);
  });

  it.each([["2026-02-31"], ["next spring"], [""], [null]])(
    "falls back to now for %j",
    (stored) => {
      expect(pickerSeedFromStored(stored, NOW)).toBe(NOW);
    },
  );

  it("defaults now to the wall clock", () => {
    const before = Date.now();
    const seed = pickerSeedFromStored(null);
    expect(seed.getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe("isPickableStoredDate", () => {
  it("accepts a real stored date", () => {
    expect(isPickableStoredDate("2026-10-20")).toBe(true);
    expect(isPickableStoredDate("2028-02-29")).toBe(true);
  });

  it("accepts parser-valid leading whitespace and trailing text (C6-L6)", () => {
    expect(isPickableStoredDate(" 2026-10-20")).toBe(true);
    expect(isPickableStoredDate(" 2026-10-20 trip ")).toBe(true);
  });

  it.each([["2026-02-31"], ["next spring"], [""], [null], ["2026-13-01"]])(
    "rejects %j",
    (stored) => {
      expect(isPickableStoredDate(stored)).toBe(false);
    },
  );
});
