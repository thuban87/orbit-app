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
  advanceHistoryDay,
  buildLogRoute,
  countByCycle,
  type HistoryReadState,
  historyDayAfterLensChange,
  historyDayAfterNext,
  historyDayAfterPrev,
  historyReadStateOnFail,
  historyReadStateOnPublish,
  historyReadStateOnStart,
  initialHistoryDayState,
  initialHistoryReadState,
  initialPersistedPref,
  isEmptyHistory,
  persistedPrefOnRead,
  persistedPrefOnUserChange,
  persistedPrefOnWriteFailed,
  resolveActiveWindow,
} from "@/components/history/history-section-logic";
import type { CycleBlock } from "@/services/history/cycles";
import { nextWindow, prevWindow } from "@/services/history/window";

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

describe("history read state (38.3 RG-024)", () => {
  const initial: HistoryReadState<string> = initialHistoryReadState();

  it("starts loading", () => {
    expect(initial).toEqual({ phase: "loading" });
  });

  it("a failure before anything has loaded is the error state", () => {
    expect(historyReadStateOnFail(initial)).toEqual({ phase: "error" });
  });

  it("a failed re-read keeps the loaded rows and flags the refresh notice", () => {
    const loaded = historyReadStateOnPublish(initial, "rows-1");
    expect(loaded).toEqual({
      phase: "loaded",
      data: "rows-1",
      refreshError: false,
    });
    expect(historyReadStateOnFail(loaded)).toEqual({
      phase: "loaded",
      data: "rows-1",
      refreshError: true,
    });
  });

  it("initial success → new revision → failed read keeps old rows and flags; the next success clears", () => {
    let state = historyReadStateOnPublish(initial, "rows-1");
    state = historyReadStateOnStart(state);
    state = historyReadStateOnFail(state);
    expect(state).toEqual({
      phase: "loaded",
      data: "rows-1",
      refreshError: true,
    });
    state = historyReadStateOnPublish(state, "rows-2");
    expect(state).toEqual({
      phase: "loaded",
      data: "rows-2",
      refreshError: false,
    });
  });

  it("a retry from the error state shows loading; a loaded view is kept while re-reading", () => {
    expect(historyReadStateOnStart(historyReadStateOnFail(initial))).toEqual({
      phase: "loading",
    });
    const loaded = historyReadStateOnPublish(initial, "rows-1");
    expect(historyReadStateOnStart(loaded)).toBe(loaded);
  });
});

describe("history day state — D-12 follow-today (38.3 RG-024)", () => {
  it("starts on today, following today", () => {
    expect(initialHistoryDayState("2026-09-25")).toEqual({
      today: "2026-09-25",
      refDate: "2026-09-25",
      followingToday: true,
    });
  });

  it("the same local date returns the unchanged object", () => {
    const state = initialHistoryDayState("2026-09-25");
    expect(advanceHistoryDay(state, "2026-09-25")).toBe(state);
  });

  it("a following view advances its window to the new today", () => {
    const next = advanceHistoryDay(
      initialHistoryDayState("2026-09-25"),
      "2026-09-26",
    );
    expect(next).toEqual({
      today: "2026-09-26",
      refDate: "2026-09-26",
      followingToday: true,
    });
  });

  it("a picked past window stays put while today-bound limits update", () => {
    const start = initialHistoryDayState("2026-09-25");
    const window = resolveActiveWindow("month", start.refDate, start.today);
    if (!window) throw new Error("month window expected");
    const past = historyDayAfterPrev(
      start,
      prevWindow(window, start.today).ref,
    );
    expect(past.followingToday).toBe(false);
    const next = advanceHistoryDay(past, "2026-09-26");
    expect(next).toEqual({
      today: "2026-09-26",
      refDate: past.refDate,
      followingToday: false,
    });
  });

  it("advances across month, year and leap-day boundaries when following", () => {
    const month = advanceHistoryDay(
      initialHistoryDayState("2026-01-31"),
      "2026-02-01",
    );
    expect(month.refDate).toBe("2026-02-01");
    expect(
      resolveActiveWindow("month", month.refDate, month.today)?.start,
    ).toBe("2026-02-01");

    const year = advanceHistoryDay(
      initialHistoryDayState("2026-12-31"),
      "2027-01-01",
    );
    expect(year.refDate).toBe("2027-01-01");
    expect(resolveActiveWindow("year", year.refDate, year.today)?.start).toBe(
      "2027-01-01",
    );

    const leap = advanceHistoryDay(
      initialHistoryDayState("2028-02-28"),
      "2028-02-29",
    );
    expect(leap.refDate).toBe("2028-02-29");
    expect(resolveActiveWindow("7days", leap.refDate, leap.today)?.end).toBe(
      "2028-02-29",
    );
  });

  it("next reaching the window containing today resumes following; stopping short does not", () => {
    const today = "2026-09-25";
    let state = initialHistoryDayState(today);
    let window = resolveActiveWindow("month", state.refDate, state.today);
    if (!window) throw new Error("month window expected");
    // Two months back.
    state = historyDayAfterPrev(state, prevWindow(window, today).ref);
    window = resolveActiveWindow("month", state.refDate, today);
    if (!window) throw new Error("month window expected");
    state = historyDayAfterPrev(state, prevWindow(window, today).ref);
    window = resolveActiveWindow("month", state.refDate, today);
    if (!window) throw new Error("month window expected");
    expect(window.start).toBe("2026-07-01");

    // One step forward: August — still a past window.
    state = historyDayAfterNext(state, "month", nextWindow(window, today).ref);
    expect(state.followingToday).toBe(false);
    window = resolveActiveWindow("month", state.refDate, today);
    if (!window) throw new Error("month window expected");
    expect(window.start).toBe("2026-08-01");

    // Second step: September, which contains today.
    state = historyDayAfterNext(state, "month", nextWindow(window, today).ref);
    expect(state.followingToday).toBe(true);
    expect(advanceHistoryDay(state, "2026-10-01").refDate).toBe("2026-10-01");
  });

  it("a lens change resets to today and following", () => {
    const past = historyDayAfterPrev(
      initialHistoryDayState("2026-09-25"),
      "2026-08-15",
    );
    expect(historyDayAfterLensChange(past)).toEqual({
      today: "2026-09-25",
      refDate: "2026-09-25",
      followingToday: true,
    });
  });
});

describe("persisted History lens/preset (38.3 review A-WR-08)", () => {
  it("adopts the persisted value from reads until the user makes a choice", () => {
    let pref = initialPersistedPref("cycles");
    pref = persistedPrefOnRead(pref, "7days");
    expect(pref.value).toBe("7days");
    pref = persistedPrefOnRead(pref, "month");
    expect(pref.value).toBe("month");
  });

  it("a revision re-read that started before the write committed never reverts the user's choice", () => {
    let pref = persistedPrefOnRead(initialPersistedPref("cycles"), "cycles");
    pref = persistedPrefOnUserChange(pref, "month");
    // A read snapshotted before the settings write lands with the old value.
    pref = persistedPrefOnRead(pref, "cycles");
    expect(pref.value).toBe("month");
  });

  it("a failed write reverts to the previous value and lets reads adopt the persisted truth again", () => {
    let pref = persistedPrefOnRead(initialPersistedPref("cycles"), "cycles");
    const change = persistedPrefOnUserChange(pref, "month");
    pref = persistedPrefOnWriteFailed(change, change.userGen, "cycles");
    expect(pref.value).toBe("cycles");
    pref = persistedPrefOnRead(pref, "7days");
    expect(pref.value).toBe("7days");
  });

  it("a failed OLDER write never reverts a newer choice", () => {
    let pref = persistedPrefOnRead(initialPersistedPref("cycles"), "cycles");
    const first = persistedPrefOnUserChange(pref, "month");
    const second = persistedPrefOnUserChange(first, "7days");
    pref = persistedPrefOnWriteFailed(second, first.userGen, "cycles");
    expect(pref).toEqual(second);
  });
});

describe("persisted History pref generations never collide (38.3 review A-WR-08)", () => {
  it("a late failure of an old write cannot revert a choice made after an earlier revert", () => {
    let pref = persistedPrefOnRead(initialPersistedPref("cycles"), "cycles");
    const first = persistedPrefOnUserChange(pref, "month");
    const second = persistedPrefOnUserChange(first, "7days");
    pref = persistedPrefOnWriteFailed(second, second.userGen, "month");
    const third = persistedPrefOnUserChange(pref, "cycles");
    // The first write's failure lands last: it must not touch the newest choice.
    expect(persistedPrefOnWriteFailed(third, first.userGen, "cycles")).toEqual(
      third,
    );
  });
});
