import { describe, expect, it } from "vitest";
import { orderRowsByFrozenUniverse } from "./dashboard-selection-order";

const row = (id: number) => ({ id, name: `P${id}` });

describe("orderRowsByFrozenUniverse (38.14 D-41)", () => {
  it("returns the present rows in the frozen entry order", () => {
    // A refresh reordered the live rows (1, 2, 3); selection keeps 3, 1, 2.
    expect(
      orderRowsByFrozenUniverse([row(1), row(2), row(3)], [3, 1, 2]).map(
        (r) => r.id,
      ),
    ).toEqual([3, 1, 2]);
  });

  it("drops frozen ids absent from the rows", () => {
    expect(
      orderRowsByFrozenUniverse([row(1), row(3)], [3, 2, 1]).map((r) => r.id),
    ).toEqual([3, 1]);
  });

  it("excludes rows outside the frozen universe", () => {
    expect(
      orderRowsByFrozenUniverse([row(4), row(1), row(2)], [2, 1]).map(
        (r) => r.id,
      ),
    ).toEqual([2, 1]);
  });

  it("returns the row objects themselves", () => {
    const a = row(1);
    expect(orderRowsByFrozenUniverse([a], [1])[0]).toBe(a);
  });

  it("is empty for an empty universe", () => {
    expect(orderRowsByFrozenUniverse([row(1)], [])).toEqual([]);
  });
});
