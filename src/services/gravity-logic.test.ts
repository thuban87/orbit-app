/**
 * Pure gravity math — behavioural proof (LOG-03 gravity half).
 *
 * Node-unit-tested (no react-native / expo / DB): the age-decay-toward-a-floor
 * weight, the sum → raw, the raw → named-tier mapping, and the two load-bearing
 * monotonicities (more-recent ≥ older; a superset never lowers). Also covers the
 * impact.ts orchestrator's recency-mirroring connected filter for
 * "Rarely responds" contacts.
 */
import { describe, expect, it } from "vitest";
import {
  computeGravity,
  type GravityTunables,
} from "@/services/gravity-logic";
import { computeContactGravity } from "@/services/impact";

const NOW = "2026-08-14 12:00:00";

// Self-contained test tunables (independent of impact.ts's owner-approved values
// so a retune there cannot silently break these invariants). Four ascending
// tiers, floor 0.15, one-year half-life.
const TUNABLES: GravityTunables = {
  halfLifeDays: 365,
  floorW: 0.15,
  tiers: [
    { name: "thin", threshold: 0 },
    { name: "building", threshold: 2 },
    { name: "solid", threshold: 5 },
    { name: "deep", threshold: 10 },
  ],
};

/** A row at `daysAgo` before NOW, connected by default. */
function rowDaysAgo(daysAgo: number, connected = 1): {
  occurredAt: string;
  connected: number;
} {
  const now = new Date(2026, 7, 14, 12, 0, 0).getTime();
  const then = new Date(now - daysAgo * 86400000);
  const y = then.getFullYear();
  const m = String(then.getMonth() + 1).padStart(2, "0");
  const d = String(then.getDate()).padStart(2, "0");
  const hh = String(then.getHours()).padStart(2, "0");
  const mm = String(then.getMinutes()).padStart(2, "0");
  const ss = String(then.getSeconds()).padStart(2, "0");
  return { occurredAt: `${y}-${m}-${d} ${hh}:${mm}:${ss}`, connected };
}

describe("computeGravity — age-decay weight toward a floor", () => {
  it("weighs a same-instant interaction ~1 (floor + full decay term)", () => {
    const g = computeGravity([rowDaysAgo(0)], NOW, TUNABLES);
    expect(g.raw).toBeCloseTo(1, 5);
  });

  it("weighs a one-half-life-old interaction ~ floor + (1-floor)/2", () => {
    const g = computeGravity([rowDaysAgo(365)], NOW, TUNABLES);
    // 0.15 + 0.85 * 0.5 = 0.575
    expect(g.raw).toBeCloseTo(0.575, 3);
  });

  it("an ANCIENT interaction still weighs >= FLOOR_W (never zero)", () => {
    const g = computeGravity([rowDaysAgo(3650 * 10)], NOW, TUNABLES); // ~100y
    expect(g.raw).toBeGreaterThanOrEqual(TUNABLES.floorW);
    expect(g.raw).toBeCloseTo(TUNABLES.floorW, 2); // asymptotes to the floor
  });
});

describe("computeGravity — raw → named tier mapping", () => {
  it("zero interactions → the lowest tier (index 0), raw 0", () => {
    const g = computeGravity([], NOW, TUNABLES);
    expect(g.raw).toBe(0);
    expect(g.tierIndex).toBe(0);
    expect(g.tierName).toBe("thin");
    expect(g.tierCount).toBe(4);
  });

  it("picks the HIGHEST tier whose threshold <= raw", () => {
    // Six same-instant rows → raw ~6 → 'solid' (threshold 5), below 'deep' (10).
    const g = computeGravity(
      Array.from({ length: 6 }, () => rowDaysAgo(0)),
      NOW,
      TUNABLES,
    );
    expect(g.raw).toBeCloseTo(6, 5);
    expect(g.tierName).toBe("solid");
    expect(g.tierIndex).toBe(2);
  });

  it("reaches the top tier when raw clears the last threshold", () => {
    const g = computeGravity(
      Array.from({ length: 12 }, () => rowDaysAgo(0)),
      NOW,
      TUNABLES,
    );
    expect(g.tierName).toBe("deep");
    expect(g.tierIndex).toBe(3);
  });

  it("never surfaces raw as the label — exposes name + index + count + raw", () => {
    const g = computeGravity([rowDaysAgo(0)], NOW, TUNABLES);
    expect(g).toHaveProperty("raw");
    expect(g).toHaveProperty("tierIndex");
    expect(g).toHaveProperty("tierName");
    expect(g).toHaveProperty("tierCount");
    expect(typeof g.tierName).toBe("string");
  });
});

describe("computeGravity — monotonicities", () => {
  it("is monotone in recency: the same set shifted more-recent yields >= gravity", () => {
    const older = [rowDaysAgo(800), rowDaysAgo(600), rowDaysAgo(400)];
    const newer = [rowDaysAgo(400), rowDaysAgo(200), rowDaysAgo(0)];
    const gOlder = computeGravity(older, NOW, TUNABLES);
    const gNewer = computeGravity(newer, NOW, TUNABLES);
    expect(gNewer.raw).toBeGreaterThanOrEqual(gOlder.raw);
    expect(gNewer.tierIndex).toBeGreaterThanOrEqual(gOlder.tierIndex);
  });

  it("a superset never lowers gravity (more interactions >= fewer)", () => {
    const base = [rowDaysAgo(100), rowDaysAgo(50)];
    const superset = [...base, rowDaysAgo(10)];
    const gBase = computeGravity(base, NOW, TUNABLES);
    const gSuper = computeGravity(superset, NOW, TUNABLES);
    expect(gSuper.raw).toBeGreaterThanOrEqual(gBase.raw);
    expect(gSuper.tierIndex).toBeGreaterThanOrEqual(gBase.tierIndex);
  });

  it("clamps a (nominally future) row so it cannot exceed a same-instant weight", () => {
    // A row dated slightly after `now` must not weigh MORE than 1 (age clamped
    // at 0), keeping the sum well-behaved.
    const future = computeGravity([rowDaysAgo(-5)], NOW, TUNABLES);
    expect(future.raw).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe("computeContactGravity — orchestration + rarely-responds connected filter", () => {
  it("counts non-connected rows for a NORMAL contact (mirrors recency)", () => {
    const g = computeContactGravity(
      {
        intervalDays: 30,
        rarelyResponds: 0,
        interactions: [
          { ...rowDaysAgo(0, 1), direction: "outbound" },
          { ...rowDaysAgo(0, 0), direction: "outbound" },
        ],
      },
      NOW,
    );
    // Both rows count → raw ~2.
    expect(g.raw).toBeCloseTo(2, 5);
  });

  it("ignores non-connected rows for a RARELY-RESPONDS contact (mirrors recency)", () => {
    const g = computeContactGravity(
      {
        intervalDays: 30,
        rarelyResponds: 1,
        interactions: [
          { ...rowDaysAgo(0, 1), direction: "outbound" },
          { ...rowDaysAgo(0, 0), direction: "outbound" },
        ],
      },
      NOW,
    );
    // Only the connected row counts → raw ~1.
    expect(g.raw).toBeCloseTo(1, 5);
  });

  it("returns the lowest tier for a contact with no interactions", () => {
    const g = computeContactGravity(
      { intervalDays: 30, rarelyResponds: 0, interactions: [] },
      NOW,
    );
    expect(g.raw).toBe(0);
    expect(g.tierIndex).toBe(0);
  });
});
