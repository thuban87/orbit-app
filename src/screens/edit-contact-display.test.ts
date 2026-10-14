import { describe, expect, it } from "vitest";
import { mostRecentEntryCard } from "./edit-contact-display";

describe("mostRecentEntryCard (D-135; D-41, D-48)", () => {
  const thisYear = new Date().getFullYear();
  const entry = (over: { entry_date?: string; created_at?: string } = {}) => ({
    value: "The garden",
    entry_date: `${thisYear}-09-05`,
    created_at: `${thisYear}-09-07 18:30:00`,
    ...over,
  });

  it("is null when the field has no entry", () => {
    expect(mostRecentEntryCard(null)).toBeNull();
    expect(mostRecentEntryCard(undefined)).toBeNull();
  });

  it("shows the value and the entry date, date only", () => {
    expect(mostRecentEntryCard(entry())).toEqual({
      value: "The garden",
      dateLabel: "Sep 5",
    });
  });

  it("falls back to created_at's date when the entry date is missing", () => {
    const card = mostRecentEntryCard(entry({ entry_date: "" }));
    expect(card?.dateLabel).toBe("Sep 7");
    expect(card?.dateLabel).not.toMatch(/\d:\d/);
  });

  it("shows another year's date with the year, and a bad date raw", () => {
    expect(
      mostRecentEntryCard(entry({ entry_date: `${thisYear - 1}-06-02` }))
        ?.dateLabel,
    ).toMatch(String(thisYear - 1));
    expect(
      mostRecentEntryCard(entry({ entry_date: "2026-02-31" }))?.dateLabel,
    ).toBe("2026-02-31");
  });
});
