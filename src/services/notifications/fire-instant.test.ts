import { describe, expect, it } from "vitest";
import {
  clampHour,
  nextAllowedFireInstant,
  nextGridFireInstant,
  nextNudgeDate,
  sameDayAllowedInstant,
} from "./fire-instant";

// All dates are LOCAL wall-clock (mirrors birthday-logic.test.ts). Because every
// input Date, every `now`, and every expectation is built from LOCAL components,
// these assertions are timezone- and DST-independent — never `toISOString`/UTC.

describe("clampHour — 0–23 integer coercion (T-11-05 defense-in-depth)", () => {
  it("clamps a below-range hour up to 0", () => {
    expect(clampHour(-1)).toBe(0);
  });

  it("clamps an above-range hour down to 23", () => {
    expect(clampHour(24)).toBe(23);
    expect(clampHour(99)).toBe(23);
  });

  it("truncates a non-integer hour to an integer in range", () => {
    expect(clampHour(9.5)).toBe(9);
    expect(clampHour(23.9)).toBe(23);
  });

  it("coerces NaN / non-finite to a safe in-range integer (never NaN)", () => {
    expect(clampHour(Number.NaN)).toBe(0);
    expect(clampHour(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampHour(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("passes through a valid integer unchanged", () => {
    expect(clampHour(0)).toBe(0);
    expect(clampHour(9)).toBe(9);
    expect(clampHour(23)).toBe(23);
  });
});

describe("nextGridFireInstant — stateless weekly decay slots", () => {
  it("skips a fired slot to the next weekly tick", () => {
    const fire = nextGridFireInstant(
      new Date(2026, 8, 22),
      new Date(2026, 8, 22, 12),
      7,
      9,
      21,
      8,
      5,
    );
    expect(fire).toEqual(new Date(2026, 8, 29, 9, 5));
  });

  it("keeps yesterday's tick when its evening slot rolled into this morning", () => {
    const due = new Date(2026, 8, 22);
    expect(
      nextGridFireInstant(due, new Date(2026, 8, 23, 7), 7, 22, 21, 8, 0),
    ).toEqual(new Date(2026, 8, 23, 8));
    expect(
      nextGridFireInstant(due, new Date(2026, 8, 23, 8, 30), 7, 22, 21, 8, 0),
    ).toEqual(new Date(2026, 8, 30, 8));
  });

  it("steps by local calendar days across DST", () => {
    const due = new Date(2026, 2, 7);
    const fire = nextGridFireInstant(
      due,
      new Date(2026, 2, 7, 12),
      7,
      9,
      21,
      8,
      5,
    );
    expect(fire).toEqual(new Date(2026, 2, 14, 9, 5));
  });
});

describe("nextAllowedFireInstant — delivery slot + quiet-window roll", () => {
  it("9am with quiet 21→08 is allowed (outside the wrapping window)", () => {
    const base = new Date(2026, 8, 1); // Sep 1 2026 (local midnight)
    const now = new Date(2026, 8, 1, 8, 0); // 08:00, before the slot
    const fire = nextAllowedFireInstant(base, 9, 21, 8, 0, now);
    expect(fire.getFullYear()).toBe(2026);
    expect(fire.getMonth()).toBe(8);
    expect(fire.getDate()).toBe(1);
    expect(fire.getHours()).toBe(9);
    expect(fire.getMinutes()).toBe(0);
  });

  it("6am inside quiet 21→08 rolls forward to 08:00 the SAME morning", () => {
    const base = new Date(2026, 8, 1);
    const now = new Date(2026, 8, 1, 5, 0);
    const fire = nextAllowedFireInstant(base, 6, 21, 8, 0, now);
    expect(fire.getDate()).toBe(1);
    expect(fire.getHours()).toBe(8);
    expect(fire.getMinutes()).toBe(0);
  });

  it("a 23:00 candidate (evening quiet) rolls to the NEXT morning 08:00", () => {
    const base = new Date(2026, 8, 1);
    const now = new Date(2026, 8, 1, 12, 0);
    const fire = nextAllowedFireInstant(base, 23, 21, 8, 0, now);
    expect(fire.getDate()).toBe(2); // next day
    expect(fire.getHours()).toBe(8);
    expect(fire.getMinutes()).toBe(0);
  });

  it("stagger that pushes a 21:00 slot to 22:30 (evening quiet) rolls to next 08:00", () => {
    const base = new Date(2026, 8, 1);
    const now = new Date(2026, 8, 1, 12, 0);
    const fire = nextAllowedFireInstant(base, 21, 21, 8, 90, now);
    expect(fire.getDate()).toBe(2);
    expect(fire.getHours()).toBe(8);
    expect(fire.getMinutes()).toBe(0);
  });

  it("rolls a non-wrapping quiet window [00,08) to 08:00 the same day", () => {
    const base = new Date(2026, 8, 1);
    const now = new Date(2026, 8, 1, 3, 0);
    const fire = nextAllowedFireInstant(base, 6, 0, 8, 0, now);
    expect(fire.getDate()).toBe(1);
    expect(fire.getHours()).toBe(8);
  });

  it("rolls a slot already past `now` to the next day's delivery slot", () => {
    const base = new Date(2026, 8, 1);
    const now = new Date(2026, 8, 1, 10, 0); // after the 9am slot
    const fire = nextAllowedFireInstant(base, 9, 21, 8, 0, now);
    expect(fire.getDate()).toBe(2);
    expect(fire.getHours()).toBe(9);
    expect(fire.getMinutes()).toBe(0);
  });

  it("applies the per-contact stagger minutes to the delivery slot", () => {
    const base = new Date(2026, 8, 1);
    const now = new Date(2026, 8, 1, 8, 0);
    const fire = nextAllowedFireInstant(base, 9, 21, 8, 7, now);
    expect(fire.getDate()).toBe(1);
    expect(fire.getHours()).toBe(9);
    expect(fire.getMinutes()).toBe(7);
  });

  it("staggers two contacts to distinct minute offsets (no morning burst)", () => {
    const base = new Date(2026, 8, 1);
    const now = new Date(2026, 8, 1, 8, 0);
    const a = nextAllowedFireInstant(base, 9, 21, 8, 3, now);
    const b = nextAllowedFireInstant(base, 9, 21, 8, 11, now);
    expect(a.getMinutes()).toBe(3);
    expect(b.getMinutes()).toBe(11);
    expect(a.getTime()).not.toBe(b.getTime());
  });

  it("clamps an out-of-range delivery hour and never yields a NaN instant", () => {
    const base = new Date(2026, 8, 1);
    const now = new Date(2026, 8, 1, 0, 0);
    const fire = nextAllowedFireInstant(base, 24, 21, 8, 0, now); // 24 → 23
    expect(Number.isNaN(fire.getTime())).toBe(false);
    // 23:00 clamped candidate is inside the evening quiet → next-morning 08:00.
    expect(fire.getDate()).toBe(2);
    expect(fire.getHours()).toBe(8);
  });

  it("treats a NaN delivery hour as 0 (still a finite, quiet-respecting instant)", () => {
    const base = new Date(2026, 8, 1);
    const now = new Date(2026, 8, 1, 0, 0);
    const fire = nextAllowedFireInstant(base, Number.NaN, 21, 8, 0, now);
    expect(Number.isNaN(fire.getTime())).toBe(false);
    // hour 0 is inside the wrapping quiet window's morning portion → 08:00.
    expect(fire.getHours()).toBe(8);
  });
});

describe("nextNudgeDate — stateless weekly cadence anchored to the due date", () => {
  it("returns the due date itself when it is today", () => {
    const due = new Date(2026, 7, 16); // Aug 16
    const now = new Date(2026, 7, 16, 9, 30);
    const tick = nextNudgeDate(due, now, 7);
    expect(tick.getFullYear()).toBe(2026);
    expect(tick.getMonth()).toBe(7);
    expect(tick.getDate()).toBe(16);
  });

  it("returns the due date when it is still in the future", () => {
    const due = new Date(2026, 7, 20);
    const now = new Date(2026, 7, 16, 9, 0);
    const tick = nextNudgeDate(due, now, 7);
    expect(tick.getDate()).toBe(20);
    expect(tick.getMonth()).toBe(7);
  });

  it("rolls an OVERDUE due date forward by whole weeks to a today-or-future tick", () => {
    // due Aug 1; ticks Aug 1, 8, 15, 22. today Aug 16 → first tick >= today is Aug 22.
    const due = new Date(2026, 7, 1);
    const now = new Date(2026, 7, 16, 14, 0);
    const tick = nextNudgeDate(due, now, 7);
    expect(tick.getMonth()).toBe(7);
    expect(tick.getDate()).toBe(22);
  });

  it("lands exactly on a tick that equals today (>=, not strictly future)", () => {
    // due Aug 1; Aug 15 is a tick; today Aug 15 → returns Aug 15.
    const due = new Date(2026, 7, 1);
    const now = new Date(2026, 7, 15, 23, 0);
    const tick = nextNudgeDate(due, now, 7);
    expect(tick.getDate()).toBe(15);
  });

  it("returns a local-midnight Date (no time-of-day carried from the due date)", () => {
    const due = new Date(2026, 7, 1, 13, 45);
    const now = new Date(2026, 7, 16, 14, 0);
    const tick = nextNudgeDate(due, now, 7);
    expect(tick.getHours()).toBe(0);
    expect(tick.getMinutes()).toBe(0);
  });
});

describe("sameDayAllowedInstant — a date-bound slot that never leaves its day (38.12 D-142)", () => {
  const day = new Date(2026, 8, 10); // Sep 10 2026, local midnight
  const dayBefore = new Date(2026, 8, 9, 12, 0);

  it("moves an evening slot inside an overnight window to quiet-hours end on the SAME day (+stagger)", () => {
    // Reminder 22:00, quiet 21→08: the day's own quiet end is 08:00 that morning.
    const fire = sameDayAllowedInstant(day, 22, 21, 8, 5, dayBefore);
    expect(fire).toEqual(new Date(2026, 8, 10, 8, 5));
  });

  it("keeps a delivery slot outside quiet hours unchanged", () => {
    const fire = sameDayAllowedInstant(day, 9, 21, 8, 5, dayBefore);
    expect(fire).toEqual(new Date(2026, 8, 10, 9, 5));
  });

  it("moves a slot inside a same-day window (12→14, delivery 13) to 14:00", () => {
    const fire = sameDayAllowedInstant(day, 13, 12, 14, 0, dayBefore);
    expect(fire).toEqual(new Date(2026, 8, 10, 14, 0));
  });

  it("moves an early-morning slot inside an overnight window to that morning's end (+stagger)", () => {
    const fire = sameDayAllowedInstant(day, 6, 21, 8, 10, dayBefore);
    expect(fire).toEqual(new Date(2026, 8, 10, 8, 10));
  });

  it("treats an empty window (start = end) as never quiet", () => {
    const fire = sameDayAllowedInstant(day, 22, 8, 8, 0, dayBefore);
    expect(fire).toEqual(new Date(2026, 8, 10, 22, 0));
  });

  it("returns null when the day's delivery slot has already passed", () => {
    const now = new Date(2026, 8, 10, 15, 0);
    expect(sameDayAllowedInstant(day, 9, 21, 8, 0, now)).toBeNull();
  });

  it("returns null when the slot is quiet and the same-day quiet end has passed", () => {
    // 22:00 is quiet; the day's quiet end (08:05) is already behind 09:00.
    const now = new Date(2026, 8, 10, 9, 0);
    expect(sameDayAllowedInstant(day, 22, 21, 8, 5, now)).toBeNull();
  });

  it("still returns the quiet-end slot when it is ahead of now on the day itself", () => {
    const now = new Date(2026, 8, 10, 6, 0);
    expect(sameDayAllowedInstant(day, 22, 21, 8, 5, now)).toEqual(
      new Date(2026, 8, 10, 8, 5),
    );
  });

  it("treats an invalid now as no past constraint", () => {
    expect(
      sameDayAllowedInstant(day, 22, 21, 8, 0, new Date(Number.NaN)),
    ).toEqual(new Date(2026, 8, 10, 8, 0));
  });

  it("keeps the day across a spring-forward DST day", () => {
    const dst = new Date(2026, 2, 8); // US spring-forward Sunday
    const fire = sameDayAllowedInstant(dst, 22, 21, 8, 5, new Date(2026, 2, 7));
    expect(fire).toEqual(new Date(2026, 2, 8, 8, 5));
  });

  it("keeps the day across a fall-back DST day", () => {
    const dst = new Date(2026, 10, 1); // US fall-back Sunday
    const fire = sameDayAllowedInstant(dst, 23, 22, 7, 5, new Date(2026, 9, 31));
    expect(fire).toEqual(new Date(2026, 10, 1, 7, 5));
  });

  it("never returns a slot off its day or inside quiet hours, for every hour combination", () => {
    const noPast = new Date(Number.NaN);
    for (let dh = 0; dh < 24; dh++) {
      for (let qs = 0; qs < 24; qs++) {
        for (let qe = 0; qe < 24; qe++) {
          const fire = sameDayAllowedInstant(day, dh, qs, qe, 55, noPast);
          // With no past constraint a slot always exists on the day.
          expect(fire).not.toBeNull();
          if (fire === null) continue;
          expect(fire.getDate()).toBe(10);
          const h = fire.getHours();
          const quiet =
            qs !== qe && (qs > qe ? h >= qs || h < qe : h >= qs && h < qe);
          expect(quiet).toBe(false);
        }
      }
    }
  });
});
