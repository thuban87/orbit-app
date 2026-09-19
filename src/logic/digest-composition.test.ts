import { describe, expect, it } from "vitest";
import {
  dedupOverlooked,
  filterUpcomingBirthdays,
  neverContactedConditional,
  pickUpNext,
  previewWithOverflow,
} from "@/logic/digest-composition";

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
    expect(rows.map((row) => row.tag)).toEqual([
      "Today",
      "Tomorrow",
      "2026-09-25",
    ]);
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
