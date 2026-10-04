import { describe, expect, it } from "vitest";
import {
  HEADER_SCRIM_BAR,
  HEADER_SCRIM_LIGHT_CONTINUOUS,
  HEADER_SCRIM_STANDARD_DARK_CONTINUOUS,
  HEADER_SCRIM_TAIL,
  HEADER_SCRIM_TOP,
  headerScrimAlpha,
  headerScrimBands,
  headerScrimContinuous,
  headerScrimLayout,
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

describe("38.7-14: the light-mode bar edge has no step (owner-approved fix)", () => {
  /** The scrim + the bar's own chrome scrim seen at depth y (one ink). */
  function seen(
    layout: ReturnType<typeof headerScrimLayout>,
    y: number,
    barScrim: number,
    barEdge: number,
  ): number {
    let t = 1 - composite(layout.bar, y);
    if (layout.tail && y >= layout.tail.top)
      t *= 1 - composite(layout.tail.bands, y - layout.tail.top);
    if (y < barEdge) t *= 1 - barScrim;
    return 1 - t;
  }

  it("Galaxy Dark is Lab B's single background stack, unchanged", () => {
    expect(headerScrimContinuous("galaxy", "dark")).toBe(false);
    for (const bar of [52, 56, 78])
      for (const barScrim of [0.05, 1])
        expect(
          headerScrimLayout(bar, "galaxy", "dark", barScrim, bar - 0.3),
        ).toEqual({
          ink: "background",
          bar: headerScrimBands(bar),
          tail: null,
        });
  });

  it("the continuous treatment covers both light themes and Standard Dark (owner 2026-10-04, SD-FIX)", () => {
    expect(HEADER_SCRIM_STANDARD_DARK_CONTINUOUS).toBe(true);
    expect(headerScrimContinuous("standard", "dark")).toBe(true);
    expect(headerScrimContinuous("standard", "light")).toBe(true);
    expect(headerScrimContinuous("galaxy", "light")).toBe(true);
  });

  it.each([
    ["galaxy", "light", 52, 0.5],
    ["standard", "light", 56, 0.97],
    ["galaxy", "light", 78, 0.97],
    ["standard", "dark", 52, 1],
    ["standard", "dark", 78, 1],
  ] as const)(
    "%s/%s (bar %s, bar scrim %s): the surface composite is continuous across the bar's clipped edge, then fades to 0",
    (pkg, mode, bar, barScrim) => {
      expect(HEADER_SCRIM_LIGHT_CONTINUOUS).toBe(true);
      const edge = bar - 1 / 3.5;
      const layout = headerScrimLayout(bar, pkg, mode, barScrim, edge);
      expect(layout.ink).toBe("surface");
      expect(layout.tail?.top).toBe(edge);
      const above = seen(layout, edge - 1e-3, barScrim, edge);
      const below = seen(layout, edge + 1e-3, barScrim, edge);
      // Same ink on both sides, so equal opacity = no visible edge.
      expect(Math.abs(above - below)).toBeLessThan(1e-9);
      // Behind the title the scrim alone stays at least Lab B's SCRIM_BAR.
      for (let y = 0; y < edge; y += 1)
        expect(composite(layout.bar, y)).toBeGreaterThanOrEqual(
          HEADER_SCRIM_BAR - 1e-6,
        );
      let prev = 1;
      for (let y = edge; y < edge + HEADER_SCRIM_TAIL; y += 0.5) {
        const a = seen(layout, y, barScrim, edge);
        expect(a).toBeLessThanOrEqual(prev + 1e-9);
        prev = a;
      }
      expect(seen(layout, edge + HEADER_SCRIM_TAIL + 1, barScrim, edge)).toBe(
        0,
      );
    },
  );
});
