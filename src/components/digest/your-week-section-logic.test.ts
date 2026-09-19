import { describe, expect, it } from "vitest";
import type { HistoryWindow } from "@/services/history/window";
import {
  directDateCounts,
  initialYourWeekState,
  persistYourWeekPeriodRejected,
  reconcileYourWeekRead,
  selectYourWeekDay,
  selectYourWeekPeriod,
} from "./your-week-section-logic";

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
