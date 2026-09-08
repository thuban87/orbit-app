import { describe, expect, it } from "vitest";
import {
  computeMembershipDelta,
  preservedFocus,
  selectSystemFraming,
  switchIntensity,
  switchTransitionIntensity,
} from "./orrery-switch-animation";

describe("orrery System switch animation math", () => {
  it("measures overlap, entering, leaving, and total membership", () => {
    expect(computeMembershipDelta([1, 2, 3], [2, 3, 4, 5])).toEqual({
      overlap: 2,
      entering: 2,
      leaving: 1,
      total: 5,
    });
  });

  it("maps membership turnover to a bounded, count-independent intensity", () => {
    expect(switchIntensity(computeMembershipDelta([1, 2], [1, 2]))).toBe(0);
    expect(switchIntensity(computeMembershipDelta([1, 2], [3, 4]))).toBe(1);

    const small = switchIntensity(
      computeMembershipDelta(
        Array.from({ length: 10 }, (_, index) => index),
        Array.from({ length: 10 }, (_, index) => index + 5),
      ),
    );
    const large = switchIntensity(
      computeMembershipDelta(
        Array.from({ length: 1000 }, (_, index) => index),
        Array.from({ length: 1000 }, (_, index) => index + 500),
      ),
    );
    expect(small).toBeCloseTo(large, 8);
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(1);
  });

  it("retains focus only when the same contact belongs to both Systems", () => {
    expect(preservedFocus(2, [1, 2], [2, 3])).toBe(2);
    expect(preservedFocus(1, [1, 2], [2, 3])).toBeNull();
    expect(preservedFocus(null, [1, 2], [2, 3])).toBeNull();
  });

  it("uses Home framing for a real switch while a same-System focus change frames the body", () => {
    const home = { zoom: 1 };
    const focused = { zoom: 2 };
    expect(selectSystemFraming(true, focused, home)).toBe(home);
    expect(selectSystemFraming(false, focused, home)).toBe(focused);
  });

  it("keeps intensity at zero for a same-System reload or session restore", () => {
    const delta = computeMembershipDelta([1, 2], [3, 4]);
    expect(switchTransitionIntensity(false, delta)).toBe(0);
    expect(switchTransitionIntensity(true, delta)).toBe(1);
  });
});
