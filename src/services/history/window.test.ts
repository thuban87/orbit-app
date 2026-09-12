/**
 * Pure window-generation tests (HIST-05) — RED first.
 *
 * Proves each lens' geometry, future-date flagging/clamping, and prev/next
 * navigation across month/year boundaries. All date math is local (dates.ts
 * convention); a UTC evening off-by-one would surface as a shifted date here.
 */
import { describe, expect, it } from "vitest";
import { buildWindow, nextWindow, prevWindow } from "@/services/history/window";

describe("buildWindow — 7 Days lens", () => {
  it("returns 7 consecutive local dates ending at the reference date", () => {
    const w = buildWindow("7days", "2026-03-15", "2026-03-20");
    expect(w.lens).toBe("7days");
    expect(w.cells).toHaveLength(7);
    expect(w.cells.map((c) => c.date)).toEqual([
      "2026-03-09",
      "2026-03-10",
      "2026-03-11",
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
      "2026-03-15",
    ]);
    expect(w.start).toBe("2026-03-09");
    expect(w.end).toBe("2026-03-15");
    expect(w.cells.every((c) => !c.isPlaceholder && !c.isFuture)).toBe(true);
  });

  it("clamps the window end so no cell is after today", () => {
    const w = buildWindow("7days", "2026-03-25", "2026-03-20");
    expect(w.end).toBe("2026-03-20");
    expect(w.cells[6].date).toBe("2026-03-20");
    expect(w.cells.some((c) => c.isFuture)).toBe(false);
  });
});

describe("buildWindow — Month lens", () => {
  it("aligns a 28-day February to whole weeks with placeholders", () => {
    const w = buildWindow("month", "2026-02-10", "2026-12-31");
    const real = w.cells.filter((c) => !c.isPlaceholder);
    expect(real).toHaveLength(28);
    expect(real[0].date).toBe("2026-02-01");
    expect(real[27].date).toBe("2026-02-28");
    expect(w.start).toBe("2026-02-01");
    expect(w.end).toBe("2026-02-28");
    // Whole-week alignment: total cells divisible by 7, placeholders carry no date.
    expect(w.cells.length % 7).toBe(0);
    expect(w.cells.filter((c) => c.isPlaceholder).every((c) => c.date === null)).toBe(true);
  });

  it("flags in-month dates after today as future", () => {
    const w = buildWindow("month", "2026-03-10", "2026-03-15");
    const cell = (d: string) => w.cells.find((c) => c.date === d);
    expect(cell("2026-03-15")?.isFuture).toBe(false);
    expect(cell("2026-03-16")?.isFuture).toBe(true);
    expect(cell("2026-03-31")?.isFuture).toBe(true);
  });
});

describe("buildWindow — Year lens", () => {
  it("produces a dense daily grid for a leap year", () => {
    const w = buildWindow("year", "2024-06-01", "2026-12-31");
    expect(w.cells.filter((c) => !c.isPlaceholder)).toHaveLength(366);
    expect(w.start).toBe("2024-01-01");
    expect(w.end).toBe("2024-12-31");
    expect(w.cells.length % 7).toBe(0);
  });

  it("produces 365 real cells for a non-leap year", () => {
    const w = buildWindow("year", "2025-06-01", "2026-12-31");
    expect(w.cells.filter((c) => !c.isPlaceholder)).toHaveLength(365);
  });
});

describe("window navigation — prev/next with today clamp", () => {
  it("prev shifts the 7-day window back across a month boundary", () => {
    const w = buildWindow("7days", "2026-03-03", "2026-12-31");
    const prev = prevWindow(w, "2026-12-31");
    expect(prev.end).toBe("2026-02-24");
    expect(prev.start).toBe("2026-02-18");
  });

  it("next clamps the 7-day window so it never passes today", () => {
    const w = buildWindow("7days", "2026-03-20", "2026-03-20");
    const next = nextWindow(w, "2026-03-20");
    expect(next.end).toBe("2026-03-20");
  });

  it("prev shifts the Month lens to the previous calendar month across a year boundary", () => {
    const w = buildWindow("month", "2026-01-15", "2026-12-31");
    const prev = prevWindow(w, "2026-12-31");
    expect(prev.start).toBe("2025-12-01");
    expect(prev.end).toBe("2025-12-31");
  });

  it("next clamps the Month lens to the current month", () => {
    const w = buildWindow("month", "2026-03-10", "2026-03-15");
    const next = nextWindow(w, "2026-03-15");
    // Cannot advance into a wholly-future month.
    expect(next.start).toBe("2026-03-01");
    expect(next.end).toBe("2026-03-31");
  });

  it("prev shifts the Year lens to the previous calendar year", () => {
    const w = buildWindow("year", "2026-06-01", "2026-12-31");
    const prev = prevWindow(w, "2026-12-31");
    expect(prev.start).toBe("2025-01-01");
    expect(prev.end).toBe("2025-12-31");
  });
});
