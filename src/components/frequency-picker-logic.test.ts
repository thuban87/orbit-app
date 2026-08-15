/**
 * Unit tests for src/components/frequency-picker-logic.ts (CRUD-01).
 *
 * The custom "every N" validation is the entry-time defence-in-depth for
 * T-04-05 — a non-positive / non-integer interval must never emit a value that
 * could reach the recency-dao write chokepoint. Tested here (node Vitest) since
 * the .tsx component imports react-native and cannot load in this env.
 */
import { describe, expect, it } from "vitest";
import {
  INVALID_INTERVAL_MESSAGE,
  parseCustomInterval,
  UNIT_FACTORS,
} from "@/components/frequency-picker-logic";

describe("UNIT_FACTORS", () => {
  it("maps days/weeks/months to 1/7/30", () => {
    expect(UNIT_FACTORS).toEqual({ days: 1, weeks: 7, months: 30 });
  });
});

describe("INVALID_INTERVAL_MESSAGE", () => {
  it("is the exact locked copy", () => {
    expect(INVALID_INTERVAL_MESSAGE).toBe("Enter a whole number greater than 0.");
  });
});

describe("parseCustomInterval", () => {
  it("computes N × unit factor for a valid whole number", () => {
    expect(parseCustomInterval("3", "days")).toEqual({
      valid: true,
      intervalDays: 3,
    });
    expect(parseCustomInterval("2", "weeks")).toEqual({
      valid: true,
      intervalDays: 14,
    });
    expect(parseCustomInterval("6", "months")).toEqual({
      valid: true,
      intervalDays: 180,
    });
  });

  it("accepts a value of 1 (smallest positive integer)", () => {
    expect(parseCustomInterval("1", "days")).toEqual({
      valid: true,
      intervalDays: 1,
    });
  });

  it("rejects zero", () => {
    expect(parseCustomInterval("0", "days")).toEqual({
      valid: false,
      intervalDays: null,
    });
  });

  it("rejects a negative number", () => {
    expect(parseCustomInterval("-4", "days")).toEqual({
      valid: false,
      intervalDays: null,
    });
  });

  it("rejects a blank / whitespace entry", () => {
    expect(parseCustomInterval("", "days")).toEqual({
      valid: false,
      intervalDays: null,
    });
    expect(parseCustomInterval("   ", "weeks")).toEqual({
      valid: false,
      intervalDays: null,
    });
  });

  it("rejects a non-integer", () => {
    expect(parseCustomInterval("1.5", "days")).toEqual({
      valid: false,
      intervalDays: null,
    });
  });

  it("rejects non-numeric and exponent/hex forms", () => {
    expect(parseCustomInterval("abc", "days").valid).toBe(false);
    expect(parseCustomInterval("1e3", "days").valid).toBe(false);
    expect(parseCustomInterval("0x1", "days").valid).toBe(false);
  });

  it("tolerates surrounding whitespace around a valid number", () => {
    expect(parseCustomInterval(" 5 ", "days")).toEqual({
      valid: true,
      intervalDays: 5,
    });
  });
});
