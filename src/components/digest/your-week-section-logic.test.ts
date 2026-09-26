import { describe, expect, it, vi } from "vitest";

vi.mock("expo-localization", () => ({ getCalendars: () => [] }));

import { buildYourWeekWindow } from "@/services/history/week-window";
import type { HistoryWindow } from "@/services/history/window";
import {
  beginYourWeekPeriodWrite,
  createYourWeekPeriodReader,
  directDateCounts,
  initialYourWeekState,
  isYourWeekDayInWindow,
  persistYourWeekPeriodAccepted,
  persistYourWeekPeriodRejected,
  reconcileYourWeekRead,
  resolveYourWeekRefreshPeriod,
  retainYourWeekDay,
  selectYourWeekDay,
  selectYourWeekPeriod,
  type YourWeekControllerState,
} from "./your-week-section-logic";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Your Week controller", () => {
  it("drops stale reads after a rapid period change", () => {
    const first = selectYourWeekPeriod(initialYourWeekState(), "calendar_week");
    const second = selectYourWeekPeriod(first, "rolling7");
    expect(reconcileYourWeekRead(second, first.generation).accepted).toBe(
      false,
    );
    expect(reconcileYourWeekRead(second, second.generation).accepted).toBe(
      true,
    );
  });

  it("rolls a rejected preference write back to the persisted period", () => {
    const pending = selectYourWeekPeriod(
      initialYourWeekState(),
      "calendar_week",
    );
    const rolledBack = persistYourWeekPeriodRejected(
      pending,
      pending.generation,
    );
    expect(rolledBack.period).toBe("rolling7");
    expect(rolledBack.pendingPeriod).toBeNull();
  });

  it("invalidates selected day detail when the period changes", () => {
    const selected = selectYourWeekDay(initialYourWeekState(), "2026-09-18");
    expect(
      selectYourWeekPeriod(selected, "calendar_week").selectedDay,
    ).toBeNull();
  });

  it("copies pre-aggregated activity-unit counts directly", () => {
    const window: HistoryWindow = {
      lens: "7days",
      ref: "2026-09-19",
      start: "2026-09-18",
      end: "2026-09-19",
      cells: [
        { date: "2026-09-18", isPlaceholder: false, isFuture: false },
        { date: "2026-09-19", isPlaceholder: false, isFuture: false },
      ],
    };
    const counts = directDateCounts(window, [{ d: "2026-09-18", n: 1 }]);
    expect([...counts]).toEqual([
      ["2026-09-18", 1],
      ["2026-09-19", 0],
    ]);
  });
});

describe("Your Week refresh period (38.3 D-15, RESEARCH Pitfall 5)", () => {
  it("starts with no write in flight", () => {
    expect(initialYourWeekState().writingPeriod).toBeNull();
  });

  it("adopts a Settings-changed period: new period, generation +1, day cleared", () => {
    const state = selectYourWeekDay(initialYourWeekState(), "2026-09-24");
    const { state: next, adopted } = resolveYourWeekRefreshPeriod(
      state,
      "calendar_week",
      state.generation,
    );
    expect(adopted).toBe(true);
    expect(next.period).toBe("calendar_week");
    expect(next.persistedPeriod).toBe("calendar_week");
    expect(next.generation).toBe(state.generation + 1);
    expect(next.selectedDay).toBeNull();
  });

  it("never adopts while a toggle write is in flight", () => {
    const writing = beginYourWeekPeriodWrite(
      initialYourWeekState(),
      "calendar_week",
    );
    expect(writing.writingPeriod).toBe("calendar_week");
    // The DB period differs from the persisted one, but the toggle's write is
    // still settling: a refresh must never act on it (adoption waits for the
    // next refresh after the write settles).
    const { state, adopted } = resolveYourWeekRefreshPeriod(
      writing,
      "calendar_week",
      writing.generation,
    );
    expect(adopted).toBe(false);
    expect(state).toBe(writing);
  });

  it("does not adopt when the DB period equals the persisted period", () => {
    const state = initialYourWeekState("calendar_week");
    const result = resolveYourWeekRefreshPeriod(
      state,
      "calendar_week",
      state.generation,
    );
    expect(result.adopted).toBe(false);
    expect(result.state.generation).toBe(state.generation);
    expect(result.state).toBe(state);
  });

  it("drops a settings read that began before a toggle that has since been accepted", () => {
    const initial = initialYourWeekState();
    const readGeneration = initial.generation;
    const writing = beginYourWeekPeriodWrite(initial, "calendar_week");
    const accepted = persistYourWeekPeriodAccepted(writing, writing.generation);
    expect(accepted.writingPeriod).toBeNull();
    expect(accepted.generation).toBe(readGeneration + 1);
    // The stale read still carries the OLD period.
    const { state, adopted } = resolveYourWeekRefreshPeriod(
      accepted,
      "rolling7",
      readGeneration,
    );
    expect(adopted).toBe(false);
    expect(state.period).toBe("calendar_week");
  });

  it("beginYourWeekPeriodWrite keeps selectYourWeekPeriod semantics", () => {
    const selected = selectYourWeekDay(initialYourWeekState(), "2026-09-18");
    const writing = beginYourWeekPeriodWrite(selected, "calendar_week");
    expect(writing).toEqual({
      ...selectYourWeekPeriod(selected, "calendar_week"),
      writingPeriod: "calendar_week",
    });
  });

  it("accept and reject clear writingPeriod only for the matching generation", () => {
    const writing = beginYourWeekPeriodWrite(
      initialYourWeekState(),
      "calendar_week",
    );
    expect(
      persistYourWeekPeriodAccepted(writing, writing.generation).writingPeriod,
    ).toBeNull();
    expect(
      persistYourWeekPeriodRejected(writing, writing.generation).writingPeriod,
    ).toBeNull();
    expect(
      persistYourWeekPeriodAccepted(writing, writing.generation - 1)
        .writingPeriod,
    ).toBe("calendar_week");
    expect(
      persistYourWeekPeriodRejected(writing, writing.generation - 1)
        .writingPeriod,
    ).toBe("calendar_week");
  });
});

describe("Your Week selected-day retention on re-window (38.3 D-15, D-26)", () => {
  const withDay = (day: string): YourWeekControllerState =>
    selectYourWeekDay(initialYourWeekState(), day);

  it("keeps an in-window day and clears an out-of-window day (rolling 7)", () => {
    const window = buildYourWeekWindow("rolling7", "2026-09-26");
    expect(isYourWeekDayInWindow(window, "2026-09-24")).toBe(true);
    expect(retainYourWeekDay(withDay("2026-09-24"), window).selectedDay).toBe(
      "2026-09-24",
    );
    expect(isYourWeekDayInWindow(window, "2026-09-18")).toBe(false);
    expect(
      retainYourWeekDay(withDay("2026-09-18"), window).selectedDay,
    ).toBeNull();
  });

  it("returns the same state when nothing is selected or the day is kept", () => {
    const window = buildYourWeekWindow("rolling7", "2026-09-26");
    const none = initialYourWeekState();
    expect(retainYourWeekDay(none, window)).toBe(none);
    const kept = withDay("2026-09-26");
    expect(retainYourWeekDay(kept, window)).toBe(kept);
  });

  it("re-windows a calendar week across a month boundary", () => {
    // Thursday 2026-10-01, Sunday-first week → 2026-09-27..2026-10-03.
    const window = buildYourWeekWindow("calendar_week", "2026-10-01", 1);
    expect(window.start).toBe("2026-09-27");
    expect(retainYourWeekDay(withDay("2026-09-28"), window).selectedDay).toBe(
      "2026-09-28",
    );
    expect(
      retainYourWeekDay(withDay("2026-09-26"), window).selectedDay,
    ).toBeNull();
  });

  it("re-windows a calendar week across a year boundary", () => {
    // Friday 2027-01-01, Sunday-first week → 2026-12-27..2027-01-02.
    const window = buildYourWeekWindow("calendar_week", "2027-01-01", 1);
    expect(window.start).toBe("2026-12-27");
    expect(window.end).toBe("2027-01-02");
    expect(retainYourWeekDay(withDay("2026-12-30"), window).selectedDay).toBe(
      "2026-12-30",
    );
    expect(
      retainYourWeekDay(withDay("2026-12-26"), window).selectedDay,
    ).toBeNull();
  });

  it("never treats a placeholder cell as a real day", () => {
    const window: HistoryWindow = {
      lens: "7days",
      ref: "2026-09-19",
      start: "2026-09-19",
      end: "2026-09-19",
      cells: [
        { date: "2026-09-18", isPlaceholder: true, isFuture: false },
        { date: null, isPlaceholder: true, isFuture: false },
        { date: "2026-09-19", isPlaceholder: false, isFuture: false },
      ],
    };
    expect(isYourWeekDayInWindow(window, "2026-09-18")).toBe(false);
    expect(
      retainYourWeekDay(withDay("2026-09-18"), window).selectedDay,
    ).toBeNull();
    expect(isYourWeekDayInWindow(window, "2026-09-19")).toBe(true);
  });
});

describe("Your Week period reads share one request authority", () => {
  function harness(initial: YourWeekControllerState) {
    let state = initial;
    const accept = vi.fn((next: YourWeekControllerState, _result: string) => {
      state = next;
    });
    const fail = vi.fn();
    const reader = createYourWeekPeriodReader<string>({
      getState: () => state,
      accept,
      fail,
    });
    return {
      reader,
      accept,
      fail,
      getState: () => state,
      setState: (next: YourWeekControllerState) => {
        state = next;
      },
    };
  }

  it("a manual switch read begun after a refresh read drops the refresh read's late result", async () => {
    const h = harness(initialYourWeekState());
    const refresh = deferred<string>();
    const refreshDone = h.reader.load(
      h.getState().generation,
      () => refresh.promise,
    );
    const switched = beginYourWeekPeriodWrite(h.getState(), "calendar_week");
    h.setState(switched);
    const manual = deferred<string>();
    const manualDone = h.reader.load(switched.generation, () => manual.promise);
    manual.resolve("calendar");
    await manualDone;
    refresh.resolve("rolling");
    await refreshDone;
    expect(h.accept).toHaveBeenCalledTimes(1);
    expect(h.accept.mock.calls[0][1]).toBe("calendar");
  });

  it("a refresh read begun after a manual switch in the SAME generation wins; the switch's late result is dropped", async () => {
    const switched = beginYourWeekPeriodWrite(
      initialYourWeekState(),
      "calendar_week",
    );
    const h = harness(switched);
    const manual = deferred<string>();
    const manualDone = h.reader.load(switched.generation, () => manual.promise);
    const refresh = deferred<string>();
    const refreshDone = h.reader.load(
      switched.generation,
      () => refresh.promise,
    );
    refresh.resolve("refresh");
    await refreshDone;
    manual.resolve("manual");
    await manualDone;
    expect(h.accept).toHaveBeenCalledTimes(1);
    expect(h.accept.mock.calls[0][1]).toBe("refresh");
    expect(h.getState().pendingPeriod).toBeNull();
  });

  it("drops a current-token result whose period intent is stale (generation guard)", async () => {
    const h = harness(initialYourWeekState());
    const read = deferred<string>();
    const done = h.reader.load(h.getState().generation, () => read.promise);
    h.setState(selectYourWeekPeriod(h.getState(), "calendar_week"));
    read.resolve("old");
    await done;
    expect(h.accept).not.toHaveBeenCalled();
  });

  it("reports only a current failure; a stale failure and invalidate() publish nothing", async () => {
    const h = harness(initialYourWeekState());
    const older = deferred<string>();
    const olderDone = h.reader.load(0, () => older.promise);
    const newer = deferred<string>();
    const newerDone = h.reader.load(0, () => newer.promise);
    older.reject(new Error("stale"));
    await olderDone;
    expect(h.fail).not.toHaveBeenCalled();
    newer.reject(new Error("current"));
    await newerDone;
    expect(h.fail).toHaveBeenCalledTimes(1);

    const pending = deferred<string>();
    const pendingDone = h.reader.load(0, () => pending.promise);
    h.reader.invalidate();
    pending.resolve("late");
    await pendingDone;
    expect(h.accept).not.toHaveBeenCalled();
  });
});
