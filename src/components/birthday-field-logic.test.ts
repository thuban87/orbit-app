/**
 * The shared Birthday control's state machine (38.11 D-61, D-49; review U-08,
 * V-10, W-02; T-05).
 *
 * D-61: switching Year unknown off asks for the year through the date picker;
 * cancelling turns Year unknown back on; 2000 is never stored silently. The
 * ask's seed is the most recent occurrence of the month/day on or before
 * today (never a future date, never 1 March for a stored 02-29), except that a
 * real year the form still holds (Year unknown on → off before saving) seeds
 * the picker on that date. D-49: Clear stores null.
 */
import { describe, expect, it } from "vitest";
import {
  type BirthdayFieldState,
  type BirthdayFieldStep,
  birthdayDisplayValue,
  birthdayFieldStateFromStored,
  birthdayPickerMaxDate,
  birthdayStorage,
  clearBirthday,
  dateFromLocalDateString,
  dateRowSeed,
  EMPTY_BIRTHDAY_FIELD_STATE,
  pickerResult,
  yearAskSeed,
  yearOffSeed,
  yearUnknownChanged,
} from "@/components/birthday-field-logic";
import {
  buildBirthdayForStorage,
  parseBirthdayForForm,
} from "@/screens/edit-contact-logic";

const TODAY = "2026-10-16";

/** Unwrap a step that must be a plain state change. */
function stateOf(step: BirthdayFieldStep): BirthdayFieldState {
  if (step.kind !== "state")
    throw new Error(`expected state, got ${step.kind}`);
  return step.state;
}

/** Unwrap a step that must ask for the year. */
function seedOf(step: BirthdayFieldStep): string {
  if (step.kind !== "ask-year")
    throw new Error(`expected ask, got ${step.kind}`);
  return step.seed;
}

/** The Edit host's load: parseBirthdayForForm, then the placeholder flag. */
function loadForEdit(stored: string | null): BirthdayFieldState {
  const parsed = parseBirthdayForForm(stored);
  return {
    input: parsed.birthdayInput,
    yearUnknown: parsed.birthdayYearUnknown,
    yearIsPlaceholder: parsed.birthdayYearUnknown,
  };
}

describe("yearAskSeed — most recent occurrence on or before today (U-08, T-05)", () => {
  it.each([
    ["12-31", "2026-10-16", "2025-12-31"],
    ["10-16", "2026-10-16", "2026-10-16"],
    ["10-17", "2026-10-16", "2025-10-17"],
    ["02-28", "2026-10-16", "2026-02-28"],
    ["01-01", "2026-01-01", "2026-01-01"],
    ["02-29", "2026-10-16", "2024-02-29"],
    ["02-29", "2028-01-15", "2024-02-29"],
    ["02-29", "2028-03-01", "2028-02-29"],
    ["02-29", "2028-02-29", "2028-02-29"],
    ["02-29", "2101-03-01", "2096-02-29"],
    ["02-29", "2000-03-01", "2000-02-29"],
  ])("yearAskSeed(%s, %s) = %s", (monthDay, today, expected) => {
    expect(yearAskSeed(monthDay, today)).toBe(expected);
  });

  it("is never after today and always keeps the month/day (property over every day of two years)", () => {
    const monthDays: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const days = m === 2 ? 29 : [4, 6, 9, 11].includes(m) ? 30 : 31;
      for (let d = 1; d <= days; d++) {
        monthDays.push(
          `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        );
      }
    }
    const todays: string[] = [];
    for (const year of [2026, 2028]) {
      for (const md of monthDays) {
        if (md === "02-29" && year % 4 !== 0) continue;
        todays.push(`${year}-${md}`);
      }
    }
    const failures: string[] = [];
    for (const today of todays) {
      for (const md of monthDays) {
        const seed = yearAskSeed(md, today);
        const year = Number(seed.slice(0, 4));
        // Never after today; same month/day (never 1 March for 02-29); a
        // 02-29 seed lands in a real leap year.
        const ok =
          seed <= today &&
          seed.slice(5) === md &&
          (md !== "02-29" ||
            (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)));
        if (!ok) failures.push(`${md}@${today} -> ${seed}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("Year unknown OFF asks for the year (D-61)", () => {
  it("a loaded year-unknown birthday asks with the yearAskSeed, never a 2000 seed", () => {
    const loaded = loadForEdit("05-04");
    expect(loaded).toEqual({
      input: "2000-05-04",
      yearUnknown: true,
      yearIsPlaceholder: true,
    });
    const step = yearUnknownChanged(loaded, false, TODAY);
    expect(seedOf(step)).toBe(yearAskSeed("05-04", TODAY));
    expect(seedOf(step)).toBe("2026-05-04");
    expect(yearOffSeed(loaded, TODAY)).toBe("2026-05-04");
  });

  it("the ask stores nothing: the state is unchanged until the picker sets a date (T-05)", () => {
    const loaded = loadForEdit("12-31");
    const step = yearUnknownChanged(loaded, false, TODAY);
    expect(step.kind).toBe("ask-year");
    // The host keeps its state; storage is still the year-unknown value.
    expect(birthdayStorage(loaded)).toBe("12-31");
  });

  it("set after the ask stores the picked full date, year known", () => {
    const loaded = loadForEdit("05-04");
    const next = pickerResult(loaded, "year", {
      type: "set",
      date: "1988-05-04",
    });
    expect(next).toEqual({
      input: "1988-05-04",
      yearUnknown: false,
      yearIsPlaceholder: false,
    });
    expect(birthdayStorage(next)).toBe("1988-05-04");
  });

  it("dismissed after the ask turns Year unknown back on with the input unchanged", () => {
    const loaded = loadForEdit("05-04");
    const next = pickerResult(loaded, "year", { type: "dismissed" });
    expect(next).toEqual(loaded);
    expect(next.yearUnknown).toBe(true);
    expect(birthdayStorage(next)).toBe("05-04");
  });

  it("OFF with no birthday set just turns the switch off, no picker", () => {
    const state: BirthdayFieldState = {
      input: null,
      yearUnknown: true,
      yearIsPlaceholder: true,
    };
    expect(stateOf(yearUnknownChanged(state, false, TODAY))).toEqual({
      input: null,
      yearUnknown: false,
      yearIsPlaceholder: true,
    });
  });

  it("ON keeps the input (storage drops the year) and leaves the placeholder flag", () => {
    const loaded = loadForEdit("1990-05-04");
    const on = stateOf(yearUnknownChanged(loaded, true, TODAY));
    expect(on).toEqual({
      input: "1990-05-04",
      yearUnknown: true,
      yearIsPlaceholder: false,
    });
    expect(birthdayStorage(on)).toBe("05-04");
  });

  it("an OFF while already off is a no-op state", () => {
    const loaded = loadForEdit("1990-05-04");
    expect(stateOf(yearUnknownChanged(loaded, false, TODAY))).toEqual(loaded);
  });
});

describe("real-year reseed (V-10)", () => {
  it("Edit 1990-05-04 → ON → OFF still asks, seeded on 1990-05-04", () => {
    const loaded = loadForEdit("1990-05-04");
    expect(loaded.yearIsPlaceholder).toBe(false);
    const on = stateOf(yearUnknownChanged(loaded, true, TODAY));
    const step = yearUnknownChanged(on, false, TODAY);
    expect(seedOf(step)).toBe("1990-05-04");
    expect(yearOffSeed(on, TODAY)).toBe("1990-05-04");
    // dismissed → Year unknown back on, input unchanged.
    expect(pickerResult(on, "year", { type: "dismissed" })).toEqual(on);
    // set → the picked date.
    expect(
      pickerResult(on, "year", { type: "set", date: "1991-05-04" }).input,
    ).toBe("1991-05-04");
  });

  it("a loaded 05-04 → OFF seeds yearAskSeed, not the 2000 placeholder", () => {
    const loaded = loadForEdit("05-04");
    expect(yearOffSeed(loaded, TODAY)).toBe(yearAskSeed("05-04", TODAY));
  });

  it("a real-year input after today falls back to yearAskSeed (never a future seed)", () => {
    const state: BirthdayFieldState = {
      input: "2027-03-01",
      yearUnknown: true,
      yearIsPlaceholder: false,
    };
    expect(yearOffSeed(state, TODAY)).toBe(yearAskSeed("03-01", TODAY));
    expect(yearOffSeed(state, TODAY) <= TODAY).toBe(true);
  });
});

describe("yearIsPlaceholder tracking (V-10)", () => {
  it("a date set while Year unknown is on is a placeholder year", () => {
    const state: BirthdayFieldState = {
      input: "1990-05-04",
      yearUnknown: true,
      yearIsPlaceholder: false,
    };
    expect(
      pickerResult(state, "date", { type: "set", date: "1990-06-01" }),
    ).toEqual({
      input: "1990-06-01",
      yearUnknown: true,
      yearIsPlaceholder: true,
    });
  });

  it("a date set while Year unknown is off is a real year", () => {
    expect(
      pickerResult(EMPTY_BIRTHDAY_FIELD_STATE, "date", {
        type: "set",
        date: "1985-01-02",
      }),
    ).toEqual({
      input: "1985-01-02",
      yearUnknown: false,
      yearIsPlaceholder: false,
    });
  });

  it("a dismissed date picker changes nothing", () => {
    const loaded = loadForEdit("1990-05-04");
    expect(pickerResult(loaded, "date", { type: "dismissed" })).toEqual(loaded);
  });

  it("birthdayFieldStateFromStored mirrors parseBirthdayForForm", () => {
    expect(birthdayFieldStateFromStored("05-04")).toEqual(loadForEdit("05-04"));
    expect(birthdayFieldStateFromStored("1990-05-04")).toEqual(
      loadForEdit("1990-05-04"),
    );
    expect(birthdayFieldStateFromStored(null)).toEqual(
      EMPTY_BIRTHDAY_FIELD_STATE,
    );
  });
});

describe("dateRowSeed — where Set birthday / the date trigger opens (W-02)", () => {
  it("year unknown with no input opens on 2000 + today's month/day", () => {
    expect(
      dateRowSeed(
        { input: null, yearUnknown: true, yearIsPlaceholder: true },
        TODAY,
      ),
    ).toBe("2000-10-16");
  });

  it("year unknown with an input opens on that input (placeholder or kept real date)", () => {
    expect(dateRowSeed(loadForEdit("12-25"), TODAY)).toBe("2000-12-25");
    expect(dateRowSeed(loadForEdit("02-29"), TODAY)).toBe("2000-02-29");
    expect(
      dateRowSeed(
        { input: "1990-05-04", yearUnknown: true, yearIsPlaceholder: false },
        TODAY,
      ),
    ).toBe("1990-05-04");
  });

  it("year known opens on the input, or today when there is none", () => {
    expect(dateRowSeed(loadForEdit("1990-05-04"), TODAY)).toBe("1990-05-04");
    expect(dateRowSeed(EMPTY_BIRTHDAY_FIELD_STATE, TODAY)).toBe(TODAY);
  });

  it("on Add with Year unknown on, 25 December and 29 February are pickable under the today cap", () => {
    const seed = dateRowSeed(
      { input: null, yearUnknown: true, yearIsPlaceholder: false },
      TODAY,
    );
    expect(seed).toBe("2000-10-16");
    // The year 2000 holds both days and both are before the max date.
    const max = birthdayPickerMaxDate(TODAY);
    expect(dateFromLocalDateString("2000-12-25").getTime()).toBeLessThan(
      max.getTime(),
    );
    expect(dateFromLocalDateString("2000-02-29").getMonth()).toBe(1);
    expect(dateFromLocalDateString("2000-02-29").getDate()).toBe(29);
  });
});

describe("birthdayPickerMaxDate — the picker stops at today (U-08; D-31 precedent)", () => {
  it("is the last millisecond of today's local day", () => {
    const max = birthdayPickerMaxDate(TODAY);
    expect(max.getFullYear()).toBe(2026);
    expect(max.getMonth()).toBe(9);
    expect(max.getDate()).toBe(16);
    expect(max.getHours()).toBe(23);
    expect(max.getMinutes()).toBe(59);
    // Tomorrow's local midnight is past the cap.
    expect(new Date(2026, 9, 17).getTime()).toBeGreaterThan(max.getTime());
    expect(new Date(2026, 9, 16).getTime()).toBeLessThanOrEqual(max.getTime());
  });

  it("dateFromLocalDateString builds local parts (no UTC shift)", () => {
    const d = dateFromLocalDateString("2024-02-29");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2024, 1, 29]);
  });
});

describe("Clear (D-49)", () => {
  it("clears the input and the Year unknown flag; storage is null", () => {
    const cleared = clearBirthday();
    expect(cleared).toEqual({
      input: null,
      yearUnknown: false,
      yearIsPlaceholder: false,
    });
    expect(birthdayStorage(cleared)).toBeNull();
    expect(buildBirthdayForStorage(cleared.input, cleared.yearUnknown)).toBe(
      null,
    );
  });
});

describe("display value", () => {
  it("shows MM-DD when the year is unknown and the full date otherwise", () => {
    expect(birthdayDisplayValue(loadForEdit("05-04"))).toBe("05-04");
    expect(birthdayDisplayValue(loadForEdit("1990-05-04"))).toBe("1990-05-04");
    expect(birthdayDisplayValue(EMPTY_BIRTHDAY_FIELD_STATE)).toBeNull();
  });
});

describe("02-29 round trips on both consumers (T-05)", () => {
  it("Edit: stored 02-29 → OFF → ask 2024-02-29 → set → stored 2024-02-29", () => {
    const loaded = loadForEdit("02-29");
    expect(seedOf(yearUnknownChanged(loaded, false, TODAY))).toBe("2024-02-29");
    const set = pickerResult(loaded, "year", {
      type: "set",
      date: "2024-02-29",
    });
    expect(buildBirthdayForStorage(set.input, set.yearUnknown)).toBe(
      "2024-02-29",
    );
  });

  it("Edit: stored 02-29 → OFF → dismissed → still stores 02-29", () => {
    const loaded = loadForEdit("02-29");
    const dismissed = pickerResult(loaded, "year", { type: "dismissed" });
    expect(dismissed.yearUnknown).toBe(true);
    expect(
      buildBirthdayForStorage(dismissed.input, dismissed.yearUnknown),
    ).toBe("02-29");
  });

  it("Add: Year unknown on, pick 29 Feb, then OFF → same seed; set stores it; dismissed keeps 02-29", () => {
    const yearUnknownOn = stateOf(
      yearUnknownChanged(EMPTY_BIRTHDAY_FIELD_STATE, true, TODAY),
    );
    expect(dateRowSeed(yearUnknownOn, TODAY)).toBe("2000-10-16");
    const picked = pickerResult(yearUnknownOn, "date", {
      type: "set",
      date: "2000-02-29",
    });
    expect(birthdayStorage(picked)).toBe("02-29");
    expect(seedOf(yearUnknownChanged(picked, false, TODAY))).toBe("2024-02-29");
    const set = pickerResult(picked, "year", {
      type: "set",
      date: "2024-02-29",
    });
    expect(birthdayStorage(set)).toBe("2024-02-29");
    const dismissed = pickerResult(picked, "year", { type: "dismissed" });
    expect(birthdayStorage(dismissed)).toBe("02-29");
  });
});

describe("never stores 2000 unless the user picked the year 2000 (D-61)", () => {
  /** A small deterministic PRNG so the sequences are reproducible. */
  function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
  }

  it("random event sequences from every starting state never store a silent 2000-", () => {
    const starts: Array<string | null> = [
      null,
      "05-04",
      "02-29",
      "12-31",
      "1990-05-04",
      "2024-02-29",
    ];
    const next = rng(42);
    const pick = <T>(items: readonly T[]): T =>
      items[Math.floor(next() * items.length)];
    const realYears = [1975, 1988, 1990, 2001, 2016, 2024];
    const monthDays = ["01-15", "02-28", "05-04", "10-16", "12-25"];

    for (let run = 0; run < 400; run++) {
      let state = birthdayFieldStateFromStored(pick(starts));
      let pendingAsk: string | null = null;
      for (let step = 0; step < 12; step++) {
        if (pendingAsk !== null) {
          // The picker opened for the year: the ask seed is never after today.
          expect(pendingAsk <= TODAY).toBe(true);
          state =
            next() < 0.5
              ? pickerResult(state, "year", { type: "dismissed" })
              : pickerResult(state, "year", {
                  type: "set",
                  date: `${pick(realYears)}-${pick(monthDays)}`,
                });
          pendingAsk = null;
        } else {
          const event = pick(["on", "off", "date", "dismiss", "clear"]);
          if (event === "on" || event === "off") {
            const result = yearUnknownChanged(state, event === "on", TODAY);
            if (result.kind === "ask-year") pendingAsk = result.seed;
            else state = result.state;
          } else if (event === "date") {
            // Under Year unknown the picker opens on a 2000 placeholder and
            // the user may only change the month/day; otherwise a real year.
            const year = state.yearUnknown ? 2000 : pick(realYears);
            state = pickerResult(state, "date", {
              type: "set",
              date: `${year}-${pick(monthDays)}`,
            });
          } else if (event === "dismiss") {
            state = pickerResult(state, "date", { type: "dismissed" });
          } else {
            state = clearBirthday();
          }
        }
        const stored = birthdayStorage(state);
        expect(stored?.startsWith("2000-") ?? false).toBe(false);
      }
    }
  });

  it("picking the year 2000 in the year ask does store 2000 (the user chose it)", () => {
    const loaded = loadForEdit("05-04");
    const set = pickerResult(loaded, "year", {
      type: "set",
      date: "2000-05-04",
    });
    expect(birthdayStorage(set)).toBe("2000-05-04");
  });
});
