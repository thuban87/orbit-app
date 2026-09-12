/**
 * History section orchestration logic (Plan 08, HIST-01/HIST-15) — RED first.
 *
 * Pure, DB-free orchestration behind the assembled Profile History section:
 *   • resolveActiveWindow: lens -> day-window (7days/month/year) or null (cycles).
 *   • isEmptyHistory: the "No history yet" predicate — true ONLY when the contact
 *     has zero interactions AND no lifecycle records; a lifecycle-only contact
 *     (zero interactions, hasLifecycleRecords true) is NOT empty (it shows the
 *     zero-count surfaces), and a populated contact is NOT empty.
 *   • buildLogRoute: the TYPED LogContact { contactId, prefillDate } navigation
 *     contract (contact preselected + date prefilled), never a quick-log payload.
 *   • countByCycle: per-cycle interaction counts, index-aligned to the blocks.
 */
import { describe, expect, it } from "vitest";
import {
  buildLogRoute,
  countByCycle,
  isEmptyHistory,
  resolveActiveWindow,
} from "@/components/history/history-section-logic";
import type { CycleBlock } from "@/services/history/cycles";

const TODAY = "2026-09-11";

describe("resolveActiveWindow — lens -> window", () => {
  it("returns a 7-day window for the '7days' lens", () => {
    const w = resolveActiveWindow("7days", TODAY, TODAY);
    expect(w).not.toBeNull();
    expect(w?.lens).toBe("7days");
    expect(w?.end).toBe(TODAY);
    expect(w?.cells).toHaveLength(7);
  });

  it("returns a month-shaped window for the 'month' lens", () => {
    const w = resolveActiveWindow("month", TODAY, TODAY);
    expect(w).not.toBeNull();
    expect(w?.lens).toBe("month");
    // Whole weeks (multiple of 7), covering September 2026.
    expect((w?.cells.length ?? 0) % 7).toBe(0);
    expect(w?.start).toBe("2026-09-01");
  });

  it("returns a year window for the 'year' lens", () => {
    const w = resolveActiveWindow("year", TODAY, TODAY);
    expect(w).not.toBeNull();
    expect(w?.lens).toBe("year");
  });

  it("returns null for the 'cycles' lens (cycles are not a date grid)", () => {
    expect(resolveActiveWindow("cycles", TODAY, TODAY)).toBeNull();
  });
});

describe("isEmptyHistory — the 'No history yet' predicate", () => {
  it("is TRUE only when all three record families are empty (no interactions, no lifecycle, no knowledge changes)", () => {
    expect(
      isEmptyHistory({
        interactions: [],
        hasLifecycleRecords: false,
        knowledgeChanges: [],
      }),
    ).toBe(true);
  });

  it("is FALSE for a lifecycle-only contact (zero interactions, has lifecycle)", () => {
    expect(
      isEmptyHistory({
        interactions: [],
        hasLifecycleRecords: true,
        knowledgeChanges: [],
      }),
    ).toBe(false);
  });

  it("is FALSE for a knowledge-change-only contact (zero interactions, no lifecycle, has knowledge changes)", () => {
    expect(
      isEmptyHistory({
        interactions: [],
        hasLifecycleRecords: false,
        knowledgeChanges: [{ id: 1 }],
      }),
    ).toBe(false);
  });

  it("is FALSE for a populated contact (has interactions)", () => {
    expect(
      isEmptyHistory({
        interactions: [{ id: 1 }],
        hasLifecycleRecords: false,
        knowledgeChanges: [],
      }),
    ).toBe(false);
  });

  it("is FALSE for a populated contact that also has lifecycle records", () => {
    expect(
      isEmptyHistory({
        interactions: [{ id: 1 }, { id: 2 }],
        hasLifecycleRecords: true,
        knowledgeChanges: [{ id: 9 }],
      }),
    ).toBe(false);
  });
});

describe("buildLogRoute — typed LogContact preselect + prefill contract", () => {
  it("yields the LogContact route with the contact preselected and the date prefilled", () => {
    const route = buildLogRoute(42, "2026-08-04");
    expect(route.screen).toBe("LogContact");
    expect(route.params.contactId).toBe(42);
    expect(route.params.prefillDate).toBe("2026-08-04");
  });

  it("is a detailed-log contract, never a quick-log payload", () => {
    const route = buildLogRoute(7, "2026-01-01");
    // No quick-log discriminator; the screen is the typed detailed-log route.
    expect(route.screen).toBe("LogContact");
    expect(route).not.toHaveProperty("quickLog");
    expect(route.params).not.toHaveProperty("quickLog");
  });
});

describe("countByCycle — per-cycle interaction counts", () => {
  const blocks: readonly CycleBlock[] = [
    { index: 0, start: "2026-08-01", end: "2026-08-10", isCurrent: false },
    { index: 1, start: "2026-08-11", end: "2026-08-20", isCurrent: false },
    { index: 2, start: "2026-08-21", end: "2026-08-30", isCurrent: true },
  ];

  it("buckets interaction dates into their containing cycle block, index-aligned", () => {
    const counts = countByCycle(blocks, [
      "2026-08-05",
      "2026-08-09",
      "2026-08-15",
      "2026-08-29",
      "2026-08-29",
    ]);
    expect(counts).toEqual([2, 1, 2]);
  });

  it("ignores dates outside every block and returns a zero-filled array otherwise", () => {
    expect(countByCycle(blocks, ["2026-07-31", "2026-09-01"])).toEqual([
      0, 0, 0,
    ]);
    expect(countByCycle(blocks, [])).toEqual([0, 0, 0]);
  });
});
