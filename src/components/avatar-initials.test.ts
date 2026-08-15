/**
 * Pure initials + deterministic swatch-index logic (PHOTO-04) — behavioural proof.
 *
 * The `.ts` sibling of `Avatar.tsx` exists so the correctness-critical bits (the
 * initials split, the ported rolling hash, and the swatch-index quantization)
 * unit-test in the node Vitest env — `Avatar.tsx` imports react-native/expo-image
 * and cannot load there. The legacy plugin coloured avatars with a free
 * HSL hue derived from hash-mod-360; that free-hue output is BARRED
 * (CLAUDE.md / check:colors), so this module emits an INDEX only — no colour
 * ever leaves it.
 */
import { describe, expect, it } from "vitest";
import {
  getInitials,
  hashName,
  swatchIndex,
} from "@/components/avatar-initials";

describe("getInitials — first char of first two words, uppercased, sliced to 2", () => {
  it("two-word name → both initials", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
  });

  it("single-word name → one initial", () => {
    expect(getInitials("Grace")).toBe("G");
  });

  it("empty name → empty string (component picks a blank neutral swatch, no glyph)", () => {
    expect(getInitials("")).toBe("");
  });

  it("whitespace-only name → empty string", () => {
    expect(getInitials("   ")).toBe("");
  });

  it("multi-word name → first char of the first two words only (slice to 2)", () => {
    expect(getInitials("mary jane watson")).toBe("MJ");
  });

  it("lowercases are uppercased", () => {
    expect(getInitials("ada lovelace")).toBe("AL");
  });
});

describe("hashName — deterministic, stable, non-negative", () => {
  it("is stable for the same input across calls", () => {
    expect(hashName("Ada Lovelace")).toBe(hashName("Ada Lovelace"));
  });

  it("returns a non-negative integer", () => {
    for (const n of ["Ada Lovelace", "Grace", "z", ""]) {
      const h = hashName(n);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
    }
  });

  it("differs for different names (no trivial collapse)", () => {
    expect(hashName("Alice")).not.toBe(hashName("Bob"));
  });
});

describe("swatchIndex — in [0, count) and stable per name", () => {
  it("returns an integer within [0, count)", () => {
    const count = 8;
    for (const n of ["Ada Lovelace", "Grace", "mary jane watson", "z", "Zoë"]) {
      const i = swatchIndex(n, count);
      expect(Number.isInteger(i)).toBe(true);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(count);
    }
  });

  it("is stable across calls for the same name + count", () => {
    expect(swatchIndex("Ada Lovelace", 8)).toBe(swatchIndex("Ada Lovelace", 8));
  });

  it("is whitespace-insensitive at the edges (trims before hashing)", () => {
    expect(swatchIndex("  Ada Lovelace  ", 8)).toBe(
      swatchIndex("Ada Lovelace", 8),
    );
  });

  it("an empty name maps to index 0 (the neutral swatch)", () => {
    expect(swatchIndex("", 8)).toBe(0);
    expect(swatchIndex("   ", 8)).toBe(0);
  });
});
