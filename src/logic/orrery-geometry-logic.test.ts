/**
 * Pure orrery geometry math — proof (ORR-01 / ORR-04).
 *
 * Every correctness-critical calculation the Skia render surface (13-05/13-07)
 * consumes is asserted here node-side, before a single pixel is drawn:
 * angle↔time anchors + wrap, clockwise polar projection, ring radius, the drift
 * bands + the DRIFT_MAX clamp, hit-testing (nearest/tie/miss/empty), even-spread,
 * the shortest-path morph delta, and the shared measured-canvas responsive metrics
 * (`deriveOrreryMetrics` — H2 / C2-4 / C2-6).
 */
import { describe, expect, it } from "vitest";
import {
  deriveOrreryMetrics,
  drawnRadius,
  driftPush,
  evenSpreadAngle,
  hitTest,
  MIN_GAP,
  PLANET_RADIUS,
  polarToXY,
  progressToAngle,
  RING_GAP_SEED,
  ringRadius,
  shortestAngleDelta,
} from "@/logic/orrery-geometry-logic";

const HALF_PI = Math.PI / 2;

describe("progressToAngle — 0 at top (12 o'clock), clockwise, wraps each interval", () => {
  it("0 → 0 rad (top)", () => {
    expect(progressToAngle(0)).toBeCloseTo(0);
  });
  it("0.25 → π/2 (3 o'clock)", () => {
    expect(progressToAngle(0.25)).toBeCloseTo(HALF_PI);
  });
  it("0.5 → π (bottom / 6 o'clock)", () => {
    expect(progressToAngle(0.5)).toBeCloseTo(Math.PI);
  });
  it("1.0 wraps back to 0 (top)", () => {
    expect(progressToAngle(1)).toBeCloseTo(0);
  });
  it("1.5 wraps to π (bottom)", () => {
    expect(progressToAngle(1.5)).toBeCloseTo(Math.PI);
  });
  it("is negative-safe via floor: -0.25 ≡ 0.75", () => {
    expect(progressToAngle(-0.25)).toBeCloseTo(progressToAngle(0.75));
    expect(progressToAngle(-0.25)).toBeCloseTo(1.5 * Math.PI);
  });
});

describe("polarToXY — clockwise-from-top on a y-grows-down screen", () => {
  const cx = 100;
  const cy = 100;
  const r = 10;
  it("angle 0 → (cx, cy−r) (top)", () => {
    const { x, y } = polarToXY(cx, cy, r, 0);
    expect(x).toBeCloseTo(cx);
    expect(y).toBeCloseTo(cy - r);
  });
  it("angle π/2 → (cx+r, cy) (right)", () => {
    const { x, y } = polarToXY(cx, cy, r, HALF_PI);
    expect(x).toBeCloseTo(cx + r);
    expect(y).toBeCloseTo(cy);
  });
  it("angle π → (cx, cy+r) (bottom)", () => {
    const { x, y } = polarToXY(cx, cy, r, Math.PI);
    expect(x).toBeCloseTo(cx);
    expect(y).toBeCloseTo(cy + r);
  });
});

describe("ringRadius — reads the canonical C.ringInner / C.effectiveGap", () => {
  // 600×1000 canvas, 3 bodies → no overflow: effectiveGap === RING_GAP_SEED (34), ringInner 58.
  const C = deriveOrreryMetrics(600, 1000, 3);
  it("rank 0 → C.ringInner", () => {
    expect(ringRadius(0, C)).toBe(C.ringInner);
  });
  it("rank n → C.ringInner + n·C.effectiveGap", () => {
    expect(ringRadius(3, C)).toBeCloseTo(C.ringInner + 3 * C.effectiveGap);
  });
});

describe("drawnRadius — stable/wobble on-ring, decay drifts, rogue furthest, clamped ≤ DRIFT_MAX", () => {
  const C = deriveOrreryMetrics(600, 1000, 3); // ringInner 58, effectiveGap 34, DRIFT_MAX 276

  it("'stable' sits exactly on its ring (no push)", () => {
    expect(drawnRadius(0.5, 0, "stable", C)).toBeCloseTo(ringRadius(0, C));
  });
  it("'wobble' sits exactly on its ring (no push)", () => {
    expect(drawnRadius(0.9, 1, "wobble", C)).toBeCloseTo(ringRadius(1, C));
  });
  it("'decay' at the band start (progress = WOBBLE_MAX) has zero push", () => {
    expect(drawnRadius(1.0, 0, "decay", C)).toBeCloseTo(ringRadius(0, C));
  });
  it("'decay' drifts outward across the band (mid-band > ring, < rogue)", () => {
    const mid = drawnRadius(2.0, 0, "decay", C);
    expect(mid).toBeGreaterThan(ringRadius(0, C));
    expect(mid).toBeLessThan(drawnRadius(5, 0, "rogue", C));
  });
  it("'decay' push grows monotonically with progress", () => {
    expect(drawnRadius(2.5, 0, "decay", C)).toBeGreaterThan(
      drawnRadius(1.5, 0, "decay", C),
    );
  });
  it("'rogue' drifts furthest (a fixed max push)", () => {
    expect(drawnRadius(5, 0, "rogue", C)).toBeGreaterThan(
      drawnRadius(2.99, 0, "decay", C),
    );
  });
  it("NEVER exceeds C.DRIFT_MAX — a far outer rank + rogue push clamps to the bound", () => {
    expect(drawnRadius(5, 10, "rogue", C)).toBe(C.DRIFT_MAX);
    expect(drawnRadius(2.99, 10, "decay", C)).toBeLessThanOrEqual(C.DRIFT_MAX);
    expect(drawnRadius(0.1, 10, "stable", C)).toBeLessThanOrEqual(C.DRIFT_MAX);
  });
});

describe("driftPush — the effective drawn-above-ring offset the drag-release inverts (WR-01)", () => {
  const C = deriveOrreryMetrics(600, 1000, 3); // ringInner 58, effectiveGap 34, DRIFT_MAX 276

  it("stable/wobble bodies have zero push (drawn on their ring)", () => {
    expect(driftPush(0.5, 0, "stable", C)).toBeCloseTo(0);
    expect(driftPush(0.9, 1, "wobble", C)).toBeCloseTo(0);
  });

  it("a drifted (decay/rogue) body has a positive push equal to drawnRadius − ringRadius", () => {
    expect(driftPush(2.0, 0, "decay", C)).toBeGreaterThan(0);
    expect(driftPush(5, 0, "rogue", C)).toBeCloseTo(
      drawnRadius(5, 0, "rogue", C) - ringRadius(0, C),
    );
  });

  it("a rim-clamped body reports its REDUCED (post-DRIFT_MAX-clamp) push, not the nominal span", () => {
    // rank 10 + rogue clamps drawnRadius to DRIFT_MAX, so the effective push is
    // DRIFT_MAX − ringRadius(10), well below the nominal ROGUE_DRIFT_SPAN.
    expect(driftPush(5, 10, "rogue", C)).toBeCloseTo(
      C.DRIFT_MAX - ringRadius(10, C),
    );
    expect(driftPush(5, 10, "rogue", C)).toBeLessThan(C.ROGUE_DRIFT_SPAN);
  });

  it("net-zero: releasing a drifted body at its OWN drawn radius inverts back to its current rank", () => {
    // The drag-release map: round((releaseRadius − driftPush − ringInner) / gap).
    for (const [rank, status] of [
      [2, "rogue"],
      [1, "decay"],
      [0, "stable"],
    ] as const) {
      const drawn = drawnRadius(2.0, rank, status, C);
      const adjusted = drawn - driftPush(2.0, rank, status, C);
      const invertedRank = Math.round(
        (adjusted - C.ringInner) / C.effectiveGap,
      );
      expect(invertedRank).toBe(rank);
    }
  });
});

describe("evenSpreadAngle — uniform index/count sweep", () => {
  it("index i of count n → (i/n)·2π", () => {
    expect(evenSpreadAngle(0, 4)).toBeCloseTo(0);
    expect(evenSpreadAngle(1, 4)).toBeCloseTo(HALF_PI);
    expect(evenSpreadAngle(2, 4)).toBeCloseTo(Math.PI);
  });
  it("count 0 → 0 (no divide-by-zero)", () => {
    expect(evenSpreadAngle(0, 0)).toBe(0);
  });
});

describe("shortestAngleDelta — the short way round the wrap (Pitfall 2)", () => {
  it("350° → 10° goes +20°, not −340°", () => {
    const from = (350 * Math.PI) / 180;
    const to = (10 * Math.PI) / 180;
    expect(shortestAngleDelta(from, to)).toBeCloseTo((20 * Math.PI) / 180);
  });
  it("normalises to [−π, π]: 0 → 3π/2 is −π/2 (short way)", () => {
    expect(shortestAngleDelta(0, 1.5 * Math.PI)).toBeCloseTo(-HALF_PI);
  });
  it("a within-range delta is unchanged", () => {
    expect(shortestAngleDelta(0, HALF_PI)).toBeCloseTo(HALF_PI);
  });
});

describe("hitTest — nearest body within HIT_RADIUS, last-drawn wins ties, else null", () => {
  const HIT = 24;
  const bodies = [
    { id: 1, x: 0, y: 0 },
    { id: 2, x: 100, y: 0 },
    { id: 3, x: 0, y: 100 },
  ];
  it("a point inside one body returns its id", () => {
    expect(hitTest(2, 3, bodies, HIT)).toBe(1);
    expect(hitTest(98, -2, bodies, HIT)).toBe(2);
  });
  it("equidistant / overlapping → the LAST body in the array (top-drawn) wins", () => {
    const stacked = [
      { id: 10, x: 50, y: 50 },
      { id: 20, x: 50, y: 50 },
    ];
    expect(hitTest(50, 50, stacked, HIT)).toBe(20);
  });
  it("a point beyond HIT_RADIUS of every body → null", () => {
    expect(hitTest(50, 50, bodies, HIT)).toBeNull();
  });
  it("empty bodies → null", () => {
    expect(hitTest(0, 0, [], HIT)).toBeNull();
  });
});

describe("deriveOrreryMetrics — shared measured-canvas responsive layout (H2 / C2-4 / C2-6)", () => {
  it("(H2) small body count keeps effectiveGap === RING_GAP_SEED (no compression)", () => {
    const C = deriveOrreryMetrics(600, 1000, 3);
    expect(C.effectiveGap).toBe(RING_GAP_SEED);
    expect(C.cx).toBe(300);
    expect(C.cy).toBe(500);
    expect(C.DRIFT_MAX).toBe(Math.min(300, 500) - PLANET_RADIUS - 8);
  });

  it("(H2) a large overflowing body count compresses effectiveGap proportionally, furthest ring ≤ DRIFT_MAX, gap > 0", () => {
    const bodyCount = 10;
    const C = deriveOrreryMetrics(600, 1000, bodyCount);
    expect(C.effectiveGap).toBeLessThan(RING_GAP_SEED); // compressed
    expect(C.effectiveGap).toBeGreaterThan(0);
    const furthestRing = C.ringInner + (bodyCount - 1) * C.effectiveGap;
    expect(furthestRing).toBeLessThanOrEqual(C.DRIFT_MAX + 1e-6);
    expect(C.DRIFT_MAX).toBe(Math.min(C.cx, C.cy) - PLANET_RADIUS - 8);
  });

  it("(C2-4) a zero canvas yields effectiveGap === MIN_GAP (> 0), never NaN or ≤ 0", () => {
    const C = deriveOrreryMetrics(0, 0, 5);
    expect(C.effectiveGap).toBe(MIN_GAP);
    expect(C.effectiveGap).toBeGreaterThan(0);
    expect(Number.isNaN(C.effectiveGap)).toBe(false);
  });

  it("(C2-4) a canvas smaller than the sun (DRIFT_MAX ≤ ringInner) floors to MIN_GAP", () => {
    const C = deriveOrreryMetrics(40, 40, 5);
    expect(C.effectiveGap).toBe(MIN_GAP);
    expect(C.effectiveGap).toBeGreaterThan(0);
  });

  it("(C2-4) the drag-release rank map (releaseRadius − ringInner)/effectiveGap is domain-safe (finite) on a degenerate canvas", () => {
    const C = deriveOrreryMetrics(0, 0, 5);
    const rank = (120 - C.ringInner) / C.effectiveGap;
    expect(Number.isFinite(rank)).toBe(true);
  });

  it("(C2-6) exposes ONLY the canonical ringInner/effectiveGap spacing keys — no RING_INNER/RING_GAP alias", () => {
    const C = deriveOrreryMetrics(600, 1000, 3);
    expect(C).toHaveProperty("ringInner");
    expect(C).toHaveProperty("effectiveGap");
    expect("RING_INNER" in C).toBe(false);
    expect("RING_GAP" in C).toBe(false);
  });

  it("carries the fixed constants so ONE object threads to render + hit-test + drag mapping", () => {
    const C = deriveOrreryMetrics(600, 1000, 3);
    expect(C.PLANET_RADIUS).toBe(PLANET_RADIUS);
    expect(C.HIT_RADIUS).toBeGreaterThan(0);
    expect(C.SUN_RADIUS).toBeGreaterThan(0);
    expect(C.SUN_GLOW_RADIUS).toBeGreaterThan(0);
    expect(C.MORPH_MS).toBeGreaterThan(0);
    expect(C.DECAY_DRIFT_SPAN).toBeGreaterThan(0);
    expect(C.ROGUE_DRIFT_SPAN).toBeGreaterThan(0);
  });
});
