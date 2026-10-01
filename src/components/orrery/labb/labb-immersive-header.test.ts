import { describe, expect, it } from "vitest";
import {
  labHeaderScrimAlpha,
  labHeaderScrimBands,
  SCRIM_BAR,
  SCRIM_TAIL,
  SCRIM_TOP,
} from "./labb-header-scrim";

/** Composite opacity of the nested bands at depth y. */
function composite(bands: [number, number][], y: number): number {
  let t = 1;
  for (const [h, a] of bands) if (y < h) t *= 1 - a;
  return 1 - t;
}

describe("R3 immersive header scrim", () => {
  it("is dense behind the bar and fades to zero below it", () => {
    const bar = 56;
    expect(labHeaderScrimAlpha(0, bar)).toBeCloseTo(SCRIM_TOP);
    expect(labHeaderScrimAlpha(bar, bar)).toBeCloseTo(SCRIM_BAR);
    expect(labHeaderScrimAlpha(bar + SCRIM_TAIL, bar)).toBe(0);
  });

  it("nested bands reproduce the profile (≥ SCRIM_BAR behind the title) and decrease monotonically", () => {
    const bar = 56;
    const bands = labHeaderScrimBands(bar);
    expect(bands.length).toBeGreaterThan(10);
    let prev = 1;
    for (let y = 0; y < bar + SCRIM_TAIL; y += 1) {
      const a = composite(bands, y);
      expect(a).toBeLessThanOrEqual(prev + 1e-9);
      prev = a;
      if (y < bar) expect(a).toBeGreaterThanOrEqual(SCRIM_BAR - 1e-6);
    }
    expect(composite(bands, bar + SCRIM_TAIL + 1)).toBe(0);
    expect(labHeaderScrimBands(0)).toEqual([]);
  });
});
