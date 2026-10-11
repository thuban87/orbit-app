import { describe, expect, it } from "vitest";
import {
  dedupOverlooked,
  filterUpcomingBirthdays,
  neverContactedConditional,
  pickUpNext,
  previewWithOverflow,
} from "@/logic/digest-composition";
import { formatLocalDate } from "@/utils/dates";

describe("digest composition", () => {
  it("caps Up Next at three and gives those ids first claim over Overlooked", () => {
    const candidates = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const upNext = pickUpNext(candidates);
    expect(upNext.map((row) => row.id)).toEqual([1, 2, 3]);
    expect(
      dedupOverlooked(
        [
          { id: 1, reason: "overdue" },
          { id: 4, reason: "overdue" },
        ],
        upNext.map((row) => row.id),
      ),
    ).toEqual([{ id: 4, reason: "overdue" }]);
  });

  it("keeps birthdays from today through day six, tags them, and drops day seven", () => {
    const today = new Date(2026, 8, 19);
    const rows = filterUpcomingBirthdays(
      [
        { id: 7, name: "Seven", birthday: "1990-09-26" },
        { id: 6, name: "Six", birthday: "1990-09-25" },
        { id: 1, name: "Today", birthday: "1990-09-19" },
        { id: 2, name: "Tomorrow", birthday: "1990-09-20" },
      ],
      today,
    );

    expect(rows.map((row) => row.id)).toEqual([1, 2, 6]);
    expect(rows.map((row) => row.tag)).toEqual(["Today", "Tomorrow", "Sep 25"]);
  });

  // 38.9 D-23 (review L6): the display tag and the storage-format day are
  // separate fields, so display output can never become the key.
  it("keeps a storage-format dateKey beside the display tag", () => {
    const rows = filterUpcomingBirthdays(
      [
        { id: 1, name: "Today", birthday: "1990-09-19" },
        { id: 6, name: "Six", birthday: "1990-09-25" },
      ],
      new Date(2026, 8, 19),
    );
    expect(rows.map((row) => row.dateKey)).toEqual([
      formatLocalDate(new Date(2026, 8, 19)),
      formatLocalDate(new Date(2026, 8, 25)),
    ]);
    expect(rows[1]?.dateKey).toBe("2026-09-25");
    expect(rows[1]?.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rows[1]?.tag).toBe("Sep 25");
    expect(rows[1]?.tag).not.toBe(rows[1]?.dateKey);
  });

  // C6-L1: the year rule follows the injected day, not the wall clock. A
  // birthday six days after Dec 28 lands in the next year and shows it.
  it("shows the year when the occurrence falls in the next year of the injected day", () => {
    const rows = filterUpcomingBirthdays(
      [{ id: 1, name: "Jan", birthday: "1990-01-02" }],
      new Date(2026, 11, 28),
    );
    expect(rows[0]?.tag).toBe("Jan 2, 2027");
    expect(rows[0]?.dateKey).toBe("2027-01-02");
  });

  it("sorts equal-day birthdays case-insensitively by name then id", () => {
    const rows = filterUpcomingBirthdays(
      [
        { id: 3, name: "bea", birthday: "1990-09-22" },
        { id: 2, name: "Alex", birthday: "1991-09-22" },
        { id: 1, name: "alex", birthday: "1992-09-22" },
      ],
      new Date(2026, 8, 19),
    );
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it("makes Never Contacted conditional and reports compact-preview overflow", () => {
    expect(neverContactedConditional(0)).toEqual({ present: false, count: 0 });
    expect(neverContactedConditional(4)).toEqual({ present: true, count: 4 });
    expect(previewWithOverflow([1, 2, 3, 4], 2)).toEqual({
      shown: [1, 2],
      overflow: 2,
    });
  });
});
