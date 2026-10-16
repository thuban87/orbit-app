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
  shouldShowCustomError,
  UNIT_FACTORS,
} from "@/components/frequency-picker-logic";

describe("UNIT_FACTORS", () => {
  it("maps days/weeks/months to 1/7/30", () => {
    expect(UNIT_FACTORS).toEqual({ days: 1, weeks: 7, months: 30 });
  });
});

describe("INVALID_INTERVAL_MESSAGE", () => {
  it("is the exact locked copy", () => {
    expect(INVALID_INTERVAL_MESSAGE).toBe(
      "Enter a whole number greater than 0.",
    );
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

describe("shouldShowCustomError: drives both the caption and the danger border (D-36, review U-03)", () => {
  describe("opt-in after-typing timing (Add and Edit only)", () => {
    const afterTyping = true;

    it("untouched invalid box: no caption and no danger border", () => {
      expect(
        shouldShowCustomError({
          valid: false,
          touched: false,
          forced: false,
          afterTyping,
        }),
      ).toBe(false);
    });

    it("typed invalid value: caption and danger border", () => {
      expect(
        shouldShowCustomError({
          valid: false,
          touched: true,
          forced: false,
          afterTyping,
        }),
      ).toBe(true);
    });

    it("typed valid value: no caption and no danger border", () => {
      expect(
        shouldShowCustomError({
          valid: true,
          touched: true,
          forced: false,
          afterTyping,
        }),
      ).toBe(false);
    });

    it("forced by a blocked Save while untouched: caption and danger border", () => {
      expect(
        shouldShowCustomError({
          valid: false,
          touched: false,
          forced: true,
          afterTyping,
        }),
      ).toBe(true);
    });

    it("forced but valid: no caption and no danger border", () => {
      expect(
        shouldShowCustomError({
          valid: true,
          touched: false,
          forced: true,
          afterTyping,
        }),
      ).toBe(false);
    });
  });

  describe("default timing (opt-in absent: Profile, Bulk import, Import review; T-07)", () => {
    it("untouched invalid box still shows the caption and danger border, as today", () => {
      expect(
        shouldShowCustomError({
          valid: false,
          touched: false,
          forced: false,
          afterTyping: false,
        }),
      ).toBe(true);
    });

    it("a valid entry shows neither the caption nor the danger border", () => {
      expect(
        shouldShowCustomError({
          valid: true,
          touched: false,
          forced: false,
          afterTyping: false,
        }),
      ).toBe(false);
    });

    it("equals !valid whatever touched and forced are", () => {
      for (const valid of [true, false]) {
        for (const touched of [true, false]) {
          for (const forced of [true, false]) {
            expect(
              shouldShowCustomError({
                valid,
                touched,
                forced,
                afterTyping: false,
              }),
            ).toBe(!valid);
          }
        }
      }
    });
  });
});
