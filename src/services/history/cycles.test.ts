/**
 * Cycle-block math tests (HIST-04, D-09) — RED first.
 *
 * Proves cycle-block geometry for each preset (5/10/15/20), current-cycle
 * flagging (newest = bottom-right = last block), and the nullable-cadence
 * fallback: for interval_days null OR tracking disabled, `cycles` returns a
 * tagged `{ available: false }` (mirroring impact.ts) — never a divide-by-null,
 * NaN, Infinity, or throw. The last block ends at `now`.
 */
import { describe, expect, it } from "vitest";
import { cycles } from "@/services/history/cycles";

describe("cycles — bound contact", () => {
  it("builds `count` contiguous interval-length blocks, newest (current) last", () => {
    const result = cycles({ intervalDays: 7, trackingEnabled: 1, count: 5, now: "2026-03-20 12:00:00" });
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.blocks).toHaveLength(5);

    // Oldest first; the last block is the in-progress current cycle ending at now.
    const current = result.blocks[4];
    expect(current.isCurrent).toBe(true);
    expect(current.end).toBe("2026-03-20");
    expect(current.start).toBe("2026-03-14");
    expect(result.blocks.slice(0, 4).every((b) => !b.isCurrent)).toBe(true);

    // Oldest block start.
    expect(result.blocks[0].start).toBe("2026-02-14");
    expect(result.blocks[0].end).toBe("2026-02-20");

    // Contiguity: each block ends the day before the next begins.
    for (let i = 0; i < result.blocks.length - 1; i++) {
      const a = result.blocks[i];
      const b = result.blocks[i + 1];
      const nextDay = new Date(`${a.end}T00:00:00`);
      nextDay.setDate(nextDay.getDate() + 1);
      const y = nextDay.getFullYear();
      const m = String(nextDay.getMonth() + 1).padStart(2, "0");
      const d = String(nextDay.getDate()).padStart(2, "0");
      expect(b.start).toBe(`${y}-${m}-${d}`);
    }
  });

  it.each([5, 10, 15, 20])("produces exactly %i blocks for the preset", (count) => {
    const result = cycles({ intervalDays: 30, trackingEnabled: 1, count, now: "2026-03-20" });
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.blocks).toHaveLength(count);
    expect(result.blocks[count - 1].isCurrent).toBe(true);
    expect(result.blocks[count - 1].end).toBe("2026-03-20");
  });
});

describe("cycles — no-cadence fallback (D-09)", () => {
  it("returns { available: false } for a null interval, never dividing by null", () => {
    const result = cycles({ intervalDays: null, trackingEnabled: 1, count: 10, now: "2026-03-20" });
    expect(result).toEqual({ available: false });
  });

  it("returns { available: false } when tracking is disabled", () => {
    const result = cycles({ intervalDays: 30, trackingEnabled: 0, count: 10, now: "2026-03-20" });
    expect(result).toEqual({ available: false });
  });

  it("never yields NaN/Infinity for the fallback path", () => {
    const result = cycles({ intervalDays: null, trackingEnabled: 0, count: 10, now: "2026-03-20" });
    expect(result.available).toBe(false);
    // Structural: the fallback carries no numeric block math at all.
    expect(JSON.stringify(result)).not.toMatch(/null|NaN|Infinity/i);
  });
});
