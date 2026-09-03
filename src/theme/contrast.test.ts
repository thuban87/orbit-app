import { describe, expect, it } from "vitest";
import {
  AA_LARGE,
  AA_NORMAL,
  contrastRatio,
  meetsAA,
  relativeLuminance,
} from "./contrast";

describe("AA thresholds", () => {
  it("exports the WCAG-AA-equivalent minimums and never weakens them", () => {
    // These are LOCKED. A future edit lowering either to green a failing token
    // is a prohibited reversal (CLAUDE.md) and must fail this suite loudly.
    expect(AA_NORMAL).toBe(4.5);
    expect(AA_LARGE).toBe(3.0);
  });
});

describe("relativeLuminance", () => {
  it("returns 0 for pure black and 1 for pure white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 6);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 6);
  });

  it("rejects a malformed or empty hex rather than silently passing", () => {
    expect(() => relativeLuminance("")).toThrow();
    expect(() => relativeLuminance("#FFF")).toThrow(); // 3-digit shorthand not accepted
    expect(() => relativeLuminance("#12345")).toThrow(); // 5 digits
    expect(() => relativeLuminance("#GGGGGG")).toThrow(); // non-hex
    expect(() => relativeLuminance("red")).toThrow();
    // @ts-expect-error — a non-string input must be rejected, not coerced.
    expect(() => relativeLuminance(null)).toThrow();
  });
});

describe("contrastRatio", () => {
  it("returns 1.0 for identical colours (fails AA)", () => {
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 6);
    expect(meetsAA("#123456", "#123456")).toBe(false);
  });

  it("is symmetric — argument order never changes the ratio", () => {
    const forward = contrastRatio("#0B0E1A", "#E6E9F5");
    const reverse = contrastRatio("#E6E9F5", "#0B0E1A");
    expect(forward).toBeCloseTo(reverse, 12);
  });

  it("matches the known black-on-white reference ratio of 21:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 4);
  });

  it("treats a near-equal (ratio approaching 1.0) pair as a FAIL, never rounded up", () => {
    const ratio = contrastRatio("#808080", "#828282");
    expect(ratio).toBeLessThan(AA_LARGE);
    expect(meetsAA("#808080", "#828282")).toBe(false);
    expect(meetsAA("#808080", "#828282", AA_LARGE)).toBe(false);
  });

  it("computes a mid-contrast reference pair correctly", () => {
    // white on the galaxy danger fill (#E5484D) — the known ~3.9:1 pair the plan
    // flags for the owner; assert it is below AA-normal so the gate can catch it.
    const ratio = contrastRatio("#FFFFFF", "#E5484D");
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(AA_NORMAL);
  });
});
