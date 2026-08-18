/**
 * Pure ring drag→order computation — proof (ORR / ring_seq radial drag).
 *
 * computeRingReorder is the exact array move the orrery's `ring_seq` radial drag-end
 * feeds into rewriteRingSeq. Asserts forward/backward moves, no-op, out-of-range
 * clamping, permutation invariance, and input-not-mutated — the same contract the
 * favourites reorder proves, cloned for the ring path.
 */
import { describe, expect, it } from "vitest";
import { computeRingReorder } from "@/logic/ring-reorder-logic";

describe("computeRingReorder — pure drag→order move", () => {
  it("moves an element FORWARD (0 → 2)", () => {
    expect(computeRingReorder([10, 20, 30], 0, 2)).toEqual([20, 30, 10]);
  });

  it("moves an element BACKWARD (2 → 0)", () => {
    expect(computeRingReorder([10, 20, 30], 2, 0)).toEqual([30, 10, 20]);
  });

  it("a no-op move (from === to) returns an equal-order array", () => {
    expect(computeRingReorder([10, 20, 30, 40], 1, 1)).toEqual([
      10, 20, 30, 40,
    ]);
  });

  it("CLAMPS an out-of-range `to` to the last slot", () => {
    // to=99 clamps to length-1 (2): move index 0 to the end.
    expect(computeRingReorder([10, 20, 30], 0, 99)).toEqual([20, 30, 10]);
  });

  it("CLAMPS an out-of-range `from` to the last slot", () => {
    // from=99 clamps to 2 (element 30), moved to index 0.
    expect(computeRingReorder([10, 20, 30], 99, 0)).toEqual([30, 10, 20]);
  });

  it("CLAMPS a negative index to the first slot", () => {
    // from=-5 clamps to 0 (element 10), moved to index 2.
    expect(computeRingReorder([10, 20, 30], -5, 2)).toEqual([20, 30, 10]);
  });

  it("an empty array returns an empty copy", () => {
    const input: number[] = [];
    const result = computeRingReorder(input, 0, 1);
    expect(result).toEqual([]);
    expect(result).not.toBe(input);
  });

  it("a single-element array is unchanged", () => {
    expect(computeRingReorder([7], 0, 0)).toEqual([7]);
  });

  it("the result is always a PERMUTATION of the input (no loss/dup)", () => {
    const input = [10, 20, 30, 40, 50];
    const result = computeRingReorder(input, 4, 1);
    expect([...result].sort((x, y) => x - y)).toEqual(
      [...input].sort((x, y) => x - y),
    );
    expect(new Set(result).size).toBe(input.length);
  });

  it("does NOT mutate the input array (returns a new array)", () => {
    const input = [10, 20, 30, 40];
    const snapshot = [...input];
    const result = computeRingReorder(input, 0, 3);
    expect(input).toEqual(snapshot); // input untouched
    expect(result).not.toBe(input); // new array reference
  });

  it("never throws on an out-of-range index (a stray gesture cannot crash)", () => {
    expect(() => computeRingReorder([10, 20], 999, -999)).not.toThrow();
  });
});
