/**
 * Pure drag→order computation — proof (DASH-06).
 *
 * computeReorder is the exact array move the Manage-favourites drag-end feeds
 * into rewriteFavouriteRanks. Asserts forward/backward moves, no-op, out-of-range
 * clamping, permutation invariance, and input-not-mutated.
 */
import { describe, expect, it } from "vitest";
import { computeReorder } from "@/logic/favourites-reorder-logic";

describe("computeReorder — pure drag→order move", () => {
  it("moves an element FORWARD (0 → 2)", () => {
    expect(computeReorder([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
  });

  it("moves an element BACKWARD (3 → 0)", () => {
    expect(computeReorder([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
  });

  it("a no-op move (from === to) returns an equal-order array", () => {
    expect(computeReorder([1, 2, 3, 4], 1, 1)).toEqual([1, 2, 3, 4]);
  });

  it("CLAMPS an out-of-range `to` to the last slot", () => {
    // to=99 clamps to length-1 (3): move index 0 to the end.
    expect(computeReorder([1, 2, 3, 4], 0, 99)).toEqual([2, 3, 4, 1]);
  });

  it("CLAMPS an out-of-range `from` to the last slot", () => {
    // from=99 clamps to 3 (element 4), moved to index 0.
    expect(computeReorder([1, 2, 3, 4], 99, 0)).toEqual([4, 1, 2, 3]);
  });

  it("CLAMPS a negative index to the first slot", () => {
    // from=-5 clamps to 0 (element 1), moved to index 2.
    expect(computeReorder([1, 2, 3, 4], -5, 2)).toEqual([2, 3, 1, 4]);
  });

  it("an empty array returns an empty copy", () => {
    const input: number[] = [];
    const result = computeReorder(input, 0, 1);
    expect(result).toEqual([]);
    expect(result).not.toBe(input);
  });

  it("a single-element array is unchanged", () => {
    expect(computeReorder([7], 0, 0)).toEqual([7]);
  });

  it("the result is always a PERMUTATION of the input (no loss/dup)", () => {
    const input = [10, 20, 30, 40, 50];
    const result = computeReorder(input, 4, 1);
    expect([...result].sort((x, y) => x - y)).toEqual(
      [...input].sort((x, y) => x - y),
    );
    expect(new Set(result).size).toBe(input.length);
  });

  it("does NOT mutate the input array (returns a new array)", () => {
    const input = [1, 2, 3, 4];
    const snapshot = [...input];
    const result = computeReorder(input, 0, 3);
    expect(input).toEqual(snapshot); // input untouched
    expect(result).not.toBe(input); // new array reference
  });

  it("returns a new array even on a no-op move", () => {
    const input = [1, 2, 3];
    const result = computeReorder(input, 1, 1);
    expect(result).not.toBe(input);
    expect(result).toEqual(input);
  });
});
