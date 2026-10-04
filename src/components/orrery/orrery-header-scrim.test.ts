import { describe, expect, it } from "vitest";
import {
  HEADER_SCRIM_BAR,
  HEADER_SCRIM_TAIL,
  HEADER_SCRIM_TOP,
  headerScrimAlpha,
  headerScrimBands,
} from "./orrery-header-scrim";

/** Composite opacity of the nested bands at depth y. */
function composite(bands: [number, number][], y: number): number {
  let t = 1;
  for (const [h, a] of bands) if (y < h) t *= 1 - a;
  return 1 - t;
}

describe("38.7-12 (D-39): the Orrery title scrim (Lab B IMMERSE profile)", () => {
  it("keeps Lab B's values", () => {
    expect([HEADER_SCRIM_TOP, HEADER_SCRIM_BAR, HEADER_SCRIM_TAIL]).toEqual([
      0.96, 0.84, 44,
    ]);
  });

  it("is dense behind the bar and fades to zero below it", () => {
    const bar = 52;
    expect(headerScrimAlpha(0, bar)).toBeCloseTo(HEADER_SCRIM_TOP);
    expect(headerScrimAlpha(bar, bar)).toBeCloseTo(HEADER_SCRIM_BAR);
    expect(headerScrimAlpha(bar + HEADER_SCRIM_TAIL, bar)).toBe(0);
  });

  it.each([52, 56, 78])(
    "nested bands reproduce the profile (≥ SCRIM_BAR behind the title) and decrease monotonically (bar %s)",
    (bar) => {
      const bands = headerScrimBands(bar);
      expect(bands.length).toBeGreaterThan(10);
      let prev = 1;
      for (let y = 0; y < bar + HEADER_SCRIM_TAIL; y += 1) {
        const a = composite(bands, y);
        expect(a).toBeLessThanOrEqual(prev + 1e-9);
        prev = a;
        if (y < bar) expect(a).toBeGreaterThanOrEqual(HEADER_SCRIM_BAR - 1e-6);
      }
      expect(composite(bands, bar + HEADER_SCRIM_TAIL + 1)).toBe(0);
    },
  );

  it("draws nothing before the bar is measured", () => {
    expect(headerScrimBands(0)).toEqual([]);
    expect(headerScrimBands(Number.NaN)).toEqual([]);
  });
});
