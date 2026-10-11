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
import { describe, expect, it, vi } from "vitest";
import {
  advanceHistoryDay,
  buildLogRoute,
  countByCycle,
  cyclesNextRef,
  cyclesPrevRef,
  type HistoryReadState,
  historyDayAfterCyclesNext,
  historyDayAfterLensChange,
  historyDayAfterNext,
  historyDayAfterPresetChange,
  historyDayAfterPrev,
  historyReadStateOnFail,
  historyReadStateOnPublish,
  historyReadStateOnStart,
  initialHistoryDayState,
  initialHistoryReadState,
  initialPersistedPref,
  isEmptyHistory,
  lensTapIntent,
  NO_CADENCE_FALLBACK_NOTE,
  pagedCycles,
  persistedPrefOnRead,
  persistedPrefOnUserChange,
  persistedPrefOnWriteFailed,
  resolveActiveWindow,
  resolveEffectiveLens,
  settleEventConversion,
} from "@/components/history/history-section-logic";
import type { HistoryLens } from "@/db/app-settings-dao";
import { type CycleBlock, cycles } from "@/services/history/cycles";
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

  it("keeps the dated route for an empty day (D-21)", () => {
    expect(buildLogRoute(42, "2026-08-04")).toEqual({
      screen: "LogContact",
      params: { contactId: 42, prefillDate: "2026-08-04" },
    });
  });

  it("omits prefillDate entirely for an empty span, so the Log form starts at now (D-28)", () => {
    const route = buildLogRoute(42);
    expect(route).toEqual({ screen: "LogContact", params: { contactId: 42 } });
    expect(route.params).not.toHaveProperty("prefillDate");
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

describe("Cycles paging by whole pages (38.8 D-25, D-26)", () => {
  const T = "2026-10-08";
  const cadence = { intervalDays: 7, trackingEnabled: 1, count: 5 };
  const page = (refDate: string, today = T) =>
    pagedCycles({ ...cadence, today, refDate });
  const blocksOf = (result: ReturnType<typeof pagedCycles>) => {
    if (!result.available) throw new Error("cycles expected");
    return result.blocks;
  };

  it("page 0 equals cycles() ending today, with the last block current", () => {
    const current = page(T);
    expect(current).toEqual(cycles({ ...cadence, now: T }));
    const blocks = blocksOf(current);
    expect(blocks[4]).toMatchObject({ end: T, isCurrent: true });
    expect(blocks.filter((b) => b.isCurrent)).toHaveLength(1);
  });

  it("one page back ends the day before the current first block and has no current block", () => {
    const current = blocksOf(page(T));
    expect(current[0].start).toBe("2026-09-04");
    const ref = cyclesPrevRef(current);
    expect(ref).toBe("2026-09-03");
    const back = blocksOf(page(ref));
    expect(back[4].end).toBe("2026-09-03");
    expect(back[0].start).toBe("2026-07-31");
    expect(back.some((b) => b.isCurrent)).toBe(false);
    // Contiguous with the page after it.
    expect(back).toHaveLength(5);
  });

  it("next from one page back returns to today and follows it again", () => {
    let day = initialHistoryDayState(T);
    day = historyDayAfterPrev(day, cyclesPrevRef(blocksOf(page(day.refDate))));
    expect(day.followingToday).toBe(false);
    const nextRef = cyclesNextRef({
      refDate: day.refDate,
      intervalDays: 7,
      count: 5,
      today: day.today,
    });
    expect(nextRef).toBe(T);
    day = historyDayAfterCyclesNext(day, nextRef);
    expect(day).toEqual(initialHistoryDayState(T));
    expect(blocksOf(page(day.refDate))[4].isCurrent).toBe(true);
  });

  it("next never passes today", () => {
    expect(
      cyclesNextRef({
        refDate: "2026-10-01",
        intervalDays: 30,
        count: 20,
        today: T,
      }),
    ).toBe(T);
    expect(
      cyclesNextRef({ refDate: T, intervalDays: 7, count: 5, today: T }),
    ).toBe(T);
  });

  it("two pages back and forward again steps one whole page at a time", () => {
    let day = initialHistoryDayState(T);
    day = historyDayAfterPrev(day, cyclesPrevRef(blocksOf(page(day.refDate))));
    day = historyDayAfterPrev(day, cyclesPrevRef(blocksOf(page(day.refDate))));
    expect(day.refDate).toBe("2026-07-30");
    const forward = cyclesNextRef({
      refDate: day.refDate,
      intervalDays: 7,
      count: 5,
      today: T,
    });
    expect(forward).toBe("2026-09-03");
    day = historyDayAfterCyclesNext(day, forward);
    expect(day.followingToday).toBe(false);
  });

  it("a rollover keeps a past page put (D-04), and next realigns to today one step later", () => {
    const seed = initialHistoryDayState(T);
    const R = cyclesPrevRef(blocksOf(page(T)));
    let day = historyDayAfterPrev(seed, R);
    // A new local day: the past page stays put; next is still allowed.
    day = advanceHistoryDay(day, "2026-10-09");
    expect(day).toEqual({
      today: "2026-10-09",
      refDate: R,
      followingToday: false,
    });
    expect(day.refDate < day.today).toBe(true);
    // First next: min(R + 5·7, T + 1) = the old today T — a page ending at T,
    // not following.
    const first = cyclesNextRef({
      refDate: day.refDate,
      intervalDays: 7,
      count: 5,
      today: day.today,
    });
    expect(first).toBe(T);
    day = historyDayAfterCyclesNext(day, first);
    expect(day.followingToday).toBe(false);
    expect(
      blocksOf(page(day.refDate, day.today)).some((b) => b.isCurrent),
    ).toBe(false);
    // Second next: min(T + 35, T + 1) = T + 1, and it follows today again.
    const second = cyclesNextRef({
      refDate: day.refDate,
      intervalDays: 7,
      count: 5,
      today: day.today,
    });
    expect(second).toBe("2026-10-09");
    day = historyDayAfterCyclesNext(day, second);
    expect(day).toEqual(initialHistoryDayState("2026-10-09"));
  });

  it("an unavailable cadence returns { available: false } on any page", () => {
    expect(
      pagedCycles({
        intervalDays: null,
        trackingEnabled: 1,
        count: 5,
        today: T,
        refDate: "2026-09-01",
      }),
    ).toEqual({ available: false });
    expect(
      pagedCycles({
        intervalDays: 7,
        trackingEnabled: 0,
        count: 5,
        today: T,
        refDate: T,
      }),
    ).toEqual({ available: false });
  });

  it("pages across a year boundary with local dates", () => {
    const back = blocksOf(
      pagedCycles({
        intervalDays: 30,
        trackingEnabled: 1,
        count: 5,
        today: "2026-01-10",
        refDate: "2026-01-10",
      }),
    );
    expect(back[0].start).toBe("2025-08-14");
    expect(cyclesPrevRef(back)).toBe("2025-08-13");
  });
});

describe("a preset change returns to the current page (38.8 D-26)", () => {
  it("resets a paged-back day state to today, following", () => {
    const past = historyDayAfterPrev(
      initialHistoryDayState("2026-10-08"),
      "2026-09-03",
    );
    expect(historyDayAfterPresetChange(past)).toEqual(
      initialHistoryDayState("2026-10-08"),
    );
  });
});

describe("the no-cadence Month fallback (38.8 D-27, D-66, D-67)", () => {
  it("the note names Month and the missing frequency", () => {
    expect(NO_CADENCE_FALLBACK_NOTE.length).toBeGreaterThan(0);
    expect(NO_CADENCE_FALLBACK_NOTE).toMatch(/Month/);
    expect(NO_CADENCE_FALLBACK_NOTE).toMatch(/frequency/);
  });

  describe("resolveEffectiveLens", () => {
    it("shows the Cycles explanation whatever the persisted lens once explained (no cadence)", () => {
      for (const persisted of ["cycles", "7days", "month", "year"] as const) {
        expect(
          resolveEffectiveLens({
            persisted,
            cyclesAvailable: false,
            cyclesExplained: true,
          }),
        ).toEqual({ lens: "cycles", fallback: false });
      }
    });

    it("falls back to Month for persisted Cycles with no cadence", () => {
      expect(
        resolveEffectiveLens({
          persisted: "cycles",
          cyclesAvailable: false,
          cyclesExplained: false,
        }),
      ).toEqual({ lens: "month", fallback: true });
    });

    it("keeps Cycles with a cadence and any other persisted lens as itself", () => {
      expect(
        resolveEffectiveLens({
          persisted: "cycles",
          cyclesAvailable: true,
          cyclesExplained: false,
        }),
      ).toEqual({ lens: "cycles", fallback: false });
      for (const persisted of ["7days", "month", "year"] as const) {
        for (const cyclesAvailable of [true, false]) {
          expect(
            resolveEffectiveLens({
              persisted,
              cyclesAvailable,
              cyclesExplained: false,
            }),
          ).toEqual({ lens: persisted, fallback: false });
        }
      }
    });
  });

  describe("lensTapIntent", () => {
    const FALLBACK = { lens: "month", fallback: true } as const;
    const EXPLAINED = { lens: "cycles", fallback: false } as const;

    it("in the fallback: the shown Month is a no-op that keeps the page", () => {
      expect(
        lensTapIntent({
          persisted: "cycles",
          cyclesAvailable: false,
          effective: FALLBACK,
          tapped: "month",
        }),
      ).toEqual({
        persist: null,
        explainCycles: false,
        clearExplained: false,
        resetDay: false,
      });
    });

    it("in the fallback: Cycles shows the explanation without a write", () => {
      expect(
        lensTapIntent({
          persisted: "cycles",
          cyclesAvailable: false,
          effective: FALLBACK,
          tapped: "cycles",
        }),
      ).toEqual({
        persist: null,
        explainCycles: true,
        clearExplained: false,
        resetDay: true,
      });
    });

    it("in the fallback: 7 Days and Year persist", () => {
      for (const tapped of ["7days", "year"] as const) {
        expect(
          lensTapIntent({
            persisted: "cycles",
            cyclesAvailable: false,
            effective: FALLBACK,
            tapped,
          }),
        ).toEqual({
          persist: tapped,
          explainCycles: false,
          clearExplained: false,
          resetDay: true,
        });
      }
    });

    it("D-66: persisted Cycles, explanation showing — Month writes nothing and clears the flag", () => {
      expect(
        lensTapIntent({
          persisted: "cycles",
          cyclesAvailable: false,
          effective: EXPLAINED,
          tapped: "month",
        }),
      ).toEqual({
        persist: null,
        explainCycles: false,
        clearExplained: true,
        resetDay: true,
      });
      for (const tapped of ["7days", "year"] as const) {
        expect(
          lensTapIntent({
            persisted: "cycles",
            cyclesAvailable: false,
            effective: EXPLAINED,
            tapped,
          }),
        ).toEqual({
          persist: tapped,
          explainCycles: false,
          clearExplained: true,
          resetDay: true,
        });
      }
    });

    it("D-67: a Cycles tap on a no-cadence contact never persists, from any persisted lens", () => {
      for (const persisted of ["month", "7days", "year"] as const) {
        expect(
          lensTapIntent({
            persisted,
            cyclesAvailable: false,
            effective: { lens: persisted, fallback: false },
            tapped: "cycles",
          }),
        ).toEqual({
          persist: null,
          explainCycles: true,
          clearExplained: false,
          resetDay: true,
        });
      }
    });

    it("D-67: while the explanation shows, Cycles again keeps the page; the persisted lens returns without a write", () => {
      for (const persisted of ["cycles", "month", "7days", "year"] as const) {
        expect(
          lensTapIntent({
            persisted,
            cyclesAvailable: false,
            effective: EXPLAINED,
            tapped: "cycles",
          }),
        ).toEqual({
          persist: null,
          explainCycles: true,
          clearExplained: false,
          resetDay: false,
        });
      }
      for (const persisted of ["month", "7days", "year"] as const) {
        expect(
          lensTapIntent({
            persisted,
            cyclesAvailable: false,
            effective: EXPLAINED,
            tapped: persisted,
          }),
        ).toEqual({
          persist: null,
          explainCycles: false,
          clearExplained: true,
          resetDay: true,
        });
      }
    });

    it("D-67: while the explanation shows, a different non-Cycles lens persists and clears the flag", () => {
      expect(
        lensTapIntent({
          persisted: "month",
          cyclesAvailable: false,
          effective: EXPLAINED,
          tapped: "year",
        }),
      ).toEqual({
        persist: "year",
        explainCycles: false,
        clearExplained: true,
        resetDay: true,
      });
    });

    it("with a cadence, a Cycles tap persists as before", () => {
      expect(
        lensTapIntent({
          persisted: "month",
          cyclesAvailable: true,
          effective: { lens: "month", fallback: false },
          tapped: "cycles",
        }),
      ).toEqual({
        persist: "cycles",
        explainCycles: false,
        clearExplained: false,
        resetDay: true,
      });
    });

    it("C4-02: with a cadence, re-tapping the shown Month persists and resets the page", () => {
      expect(
        lensTapIntent({
          persisted: "month",
          cyclesAvailable: true,
          effective: { lens: "month", fallback: false },
          tapped: "month",
        }),
      ).toEqual({
        persist: "month",
        explainCycles: false,
        clearExplained: false,
        resetDay: true,
      });
    });
  });

  describe("tap sequences make zero global writes", () => {
    const T = "2026-10-08";

    function run(
      persisted: HistoryLens,
      taps: readonly HistoryLens[],
    ): {
      writes: HistoryLens[];
      effective: ReturnType<typeof resolveEffectiveLens>;
      day: ReturnType<typeof initialHistoryDayState>;
    } {
      let day = historyDayAfterPrev(initialHistoryDayState(T), "2026-08-15");
      let explained = false;
      const writes: HistoryLens[] = [];
      for (const tapped of taps) {
        const effective = resolveEffectiveLens({
          persisted,
          cyclesAvailable: false,
          cyclesExplained: explained,
        });
        const intent = lensTapIntent({
          persisted,
          cyclesAvailable: false,
          effective,
          tapped,
        });
        if (intent.explainCycles) explained = true;
        if (intent.clearExplained) explained = false;
        if (intent.persist !== null) writes.push(intent.persist);
        if (intent.resetDay) day = historyDayAfterLensChange(day);
      }
      return {
        writes,
        effective: resolveEffectiveLens({
          persisted,
          cyclesAvailable: false,
          cyclesExplained: explained,
        }),
        day,
      };
    }

    it("(a) C3-03: persisted Cycles, paged Month fallback → Cycles → Month", () => {
      const result = run("cycles", ["cycles", "month"]);
      expect(result.writes).toEqual([]);
      expect(result.effective).toEqual({ lens: "month", fallback: true });
      expect(result.day).toEqual(initialHistoryDayState(T));
    });

    it("(b) D-67: persisted Month → Cycles → Month", () => {
      const result = run("month", ["cycles", "month"]);
      expect(result.writes).toEqual([]);
      expect(result.effective).toEqual({ lens: "month", fallback: false });
      expect(result.day).toEqual(initialHistoryDayState(T));
    });

    it("the fallback Month tap alone keeps the paged day", () => {
      const result = run("cycles", ["month"]);
      expect(result.writes).toEqual([]);
      expect(result.day.followingToday).toBe(false);
    });
  });
});

describe("settleEventConversion (38.9 fix-pass IN-02)", () => {
  const handlers = () => ({
    onCreated: vi.fn(),
    onFailed: vi.fn(),
    onOpenFailed: vi.fn(),
  });

  it("a created event opens, with no error", async () => {
    const h = handlers();
    await settleEventConversion(Promise.resolve({ groupEventId: 9 }), h);
    expect(h.onCreated).toHaveBeenCalledWith({ groupEventId: 9 });
    expect(h.onFailed).not.toHaveBeenCalled();
    expect(h.onOpenFailed).not.toHaveBeenCalled();
  });

  it("a rejected write hands its reason to onFailed and resolves", async () => {
    const h = handlers();
    const reason = new Error("interaction id=4 is no longer standalone");
    await expect(
      settleEventConversion(Promise.reject(reason), h),
    ).resolves.toBeUndefined();
    expect(h.onFailed).toHaveBeenCalledWith(reason);
    expect(h.onCreated).not.toHaveBeenCalled();
    expect(h.onOpenFailed).not.toHaveBeenCalled();
  });

  it("is what HistorySection's Make this an event prompt returns, with no blanket catch", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      "src/components/history/HistorySection.tsx",
      "utf8",
    );
    const start = source.indexOf("<GroupTitlePromptSheet");
    const block = source.slice(start, source.indexOf("/>\n", start));
    expect(block).toContain("return settleEventConversion(");
    expect(block).not.toContain(".catch(");
    expect(block).toMatch(/onFailed: \(error\) => \{\s*Logger\.error\(/);
  });

  it("a throw while opening the created event is not a failed create", async () => {
    const h = handlers();
    const thrown = new Error("navigate failed");
    h.onCreated.mockImplementation(() => {
      throw thrown;
    });
    await expect(
      settleEventConversion(Promise.resolve({ groupEventId: 9 }), h),
    ).resolves.toBeUndefined();
    expect(h.onOpenFailed).toHaveBeenCalledWith(thrown);
    expect(h.onFailed).not.toHaveBeenCalled();
  });
});
