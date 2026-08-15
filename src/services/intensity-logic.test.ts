/**
 * Pure intensity math — behavioural proof (LOG-03 intensity half).
 *
 * Node-unit-tested (no react-native / expo / DB): the you-reached-out direction
 * filter, the recency-mirroring connected scope for rarely-responds contacts,
 * the this-period count, and the trailing-cadence average — INCLUDING the
 * load-bearing ascending-sort-before-differencing (a newest-first/DESC input
 * yields a POSITIVE, correct average). Also covers the impact.ts orchestrator's
 * computeContactIntensity delegation.
 */
import { describe, expect, it } from "vitest";
import { computeContactIntensity } from "@/services/impact";
import { computeIntensity } from "@/services/intensity-logic";

const NOW = "2026-08-14 12:00:00";

/** A row at `daysAgo` before NOW with an explicit direction/connected. */
function rowDaysAgo(
  daysAgo: number,
  direction: string | null = "outbound",
  connected = 1,
): { occurredAt: string; connected: number; direction: string | null } {
  const now = new Date(2026, 7, 14, 12, 0, 0).getTime();
  const then = new Date(now - daysAgo * 86400000);
  const y = then.getFullYear();
  const m = String(then.getMonth() + 1).padStart(2, "0");
  const d = String(then.getDate()).padStart(2, "0");
  const hh = String(then.getHours()).padStart(2, "0");
  const mm = String(then.getMinutes()).padStart(2, "0");
  const ss = String(then.getSeconds()).padStart(2, "0");
  return {
    occurredAt: `${y}-${m}-${d} ${hh}:${mm}:${ss}`,
    connected,
    direction,
  };
}

describe("computeIntensity — you-reached-out direction filter", () => {
  it("counts outbound rows within the period", () => {
    const r = computeIntensity(
      [rowDaysAgo(1), rowDaysAgo(5), rowDaysAgo(10)],
      30,
      0,
      NOW,
    );
    expect(r.currentCount).toBe(3);
    expect(r.multiple).toBe(3);
    expect(r.intendedPerPeriod).toBe(1);
    expect(r.periodDays).toBe(30);
  });

  it("counts 'mutual' as you-reached-out too", () => {
    const r = computeIntensity(
      [rowDaysAgo(1, "mutual"), rowDaysAgo(2, "outbound")],
      30,
      0,
      NOW,
    );
    expect(r.currentCount).toBe(2);
  });

  it("does NOT count inbound-only volume (they blew up your phone)", () => {
    const r = computeIntensity(
      [
        rowDaysAgo(1, "inbound"),
        rowDaysAgo(2, "inbound"),
        rowDaysAgo(3, "outbound"),
      ],
      30,
      0,
      NOW,
    );
    // Only the single outbound row raises the count.
    expect(r.currentCount).toBe(1);
  });

  it("does NOT count a null-direction row", () => {
    const r = computeIntensity([rowDaysAgo(1, null)], 30, 0, NOW);
    expect(r.currentCount).toBe(0);
  });
});

describe("computeIntensity — this-period window", () => {
  it("excludes qualifying rows older than the period", () => {
    const r = computeIntensity([rowDaysAgo(5), rowDaysAgo(45)], 30, 0, NOW);
    // The 45-days-ago row is outside a 30-day period.
    expect(r.currentCount).toBe(1);
  });
});

describe("computeIntensity — future rows excluded (LOW-3 upper bound)", () => {
  it("excludes a future-dated qualifying row from currentCount and the cadence", () => {
    // rowDaysAgo(-5) is 5 days AFTER now (a clock rollback / legacy corrupt row).
    // It must not inflate the this-period count nor the trailing cadence.
    const withFuture = computeIntensity(
      [rowDaysAgo(-5), rowDaysAgo(10), rowDaysAgo(20)],
      30,
      0,
      NOW,
    );
    // Without the upper bound this would be 3 (and the cadence would fold in the
    // future gap); with it, only the two past rows qualify.
    expect(withFuture.currentCount).toBe(2);

    // The trailing cadence matches the same two past rows with NO future row —
    // proving the future row is excluded from the gap set, not just the count.
    const pastOnly = computeIntensity(
      [rowDaysAgo(10), rowDaysAgo(20)],
      30,
      0,
      NOW,
    );
    expect(withFuture.trailingAvgGapDays).toBeCloseTo(
      pastOnly.trailingAvgGapDays as number,
      5,
    );
    expect(withFuture.trailingAvgGapDays).toBeCloseTo(10, 5);
  });
});

describe("computeIntensity — rarely-responds connected scope (mirrors recency)", () => {
  it("ignores non-connected outbound attempts for a rarely-responds contact", () => {
    const r = computeIntensity(
      [rowDaysAgo(1, "outbound", 0), rowDaysAgo(2, "outbound", 1)],
      30,
      1,
      NOW,
    );
    // Only the connected outbound row counts → a non-connected attempt does not
    // inflate intensity.
    expect(r.currentCount).toBe(1);
  });

  it("counts non-connected rows for a NORMAL contact", () => {
    const r = computeIntensity(
      [rowDaysAgo(1, "outbound", 0), rowDaysAgo(2, "outbound", 1)],
      30,
      0,
      NOW,
    );
    expect(r.currentCount).toBe(2);
  });
});

describe("computeIntensity — trailing cadence (ascending-sort proof)", () => {
  it("returns null for zero qualifying rows (never divides by zero)", () => {
    const r = computeIntensity([], 30, 0, NOW);
    expect(r.currentCount).toBe(0);
    expect(r.trailingAvgGapDays).toBeNull();
  });

  it("returns null for a single qualifying row", () => {
    const r = computeIntensity([rowDaysAgo(1)], 30, 0, NOW);
    expect(r.trailingAvgGapDays).toBeNull();
  });

  it("computes the mean consecutive day-gap over all history", () => {
    // Rows at 0/10/20 days ago → gaps of 10 and 10 → average 10.
    const r = computeIntensity(
      [rowDaysAgo(0), rowDaysAgo(10), rowDaysAgo(20)],
      30,
      0,
      NOW,
    );
    expect(r.trailingAvgGapDays).toBeCloseTo(10, 5);
  });

  it("yields a POSITIVE, correct average from a DESCENDING (newest-first) input", () => {
    // getImpactInputs delivers rows occurred_at DESC. Feed newest-first and prove
    // the internal ascending sort produces a POSITIVE gap, not a negative one.
    const descending = [rowDaysAgo(0), rowDaysAgo(30), rowDaysAgo(60)];
    // Sanity: the input really is newest-first.
    expect(descending[0].occurredAt > descending[2].occurredAt).toBe(true);
    const r = computeIntensity(descending, 90, 0, NOW);
    // Gaps of 30 and 30 → average 30, POSITIVE.
    expect(r.trailingAvgGapDays).toBeCloseTo(30, 5);
    expect(r.trailingAvgGapDays as number).toBeGreaterThan(0);
  });

  it("computes cadence over ALL history, not just the current period", () => {
    // Two rows, both OUTSIDE a 30-day period, still yield a trailing average.
    const r = computeIntensity([rowDaysAgo(40), rowDaysAgo(80)], 30, 0, NOW);
    expect(r.currentCount).toBe(0);
    expect(r.trailingAvgGapDays).toBeCloseTo(40, 5);
  });
});

describe("computeContactIntensity — orchestration over impact inputs", () => {
  it("delegates with periodDays = intervalDays and the rarely-responds scope", () => {
    const r = computeContactIntensity(
      {
        intervalDays: 30,
        rarelyResponds: 1,
        interactions: [
          rowDaysAgo(1, "outbound", 1),
          rowDaysAgo(2, "outbound", 0), // dropped: non-connected + rarely-responds
          rowDaysAgo(3, "inbound", 1), // dropped: inbound
        ],
      },
      NOW,
    );
    expect(r.periodDays).toBe(30);
    expect(r.currentCount).toBe(1);
  });

  it("handles a contact with no interactions (currentCount 0, cadence null)", () => {
    const r = computeContactIntensity(
      { intervalDays: 30, rarelyResponds: 0, interactions: [] },
      NOW,
    );
    expect(r.currentCount).toBe(0);
    expect(r.trailingAvgGapDays).toBeNull();
  });
});
