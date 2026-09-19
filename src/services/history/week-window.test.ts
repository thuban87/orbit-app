import { describe, expect, it } from "vitest";
import { buildYourWeekWindow } from "@/services/history/week-window";
import { buildWindow } from "@/services/history/window";

describe("buildYourWeekWindow", () => {
  it("delegates rolling7 geometry to the canonical seven-day window", () => {
    const today = "2026-09-16";
    expect(buildYourWeekWindow("rolling7", today)).toEqual(
      buildWindow("7days", today, today),
    );
  });

  it("builds a Sunday-first calendar week from Expo firstWeekday 1", () => {
    const window = buildYourWeekWindow("calendar_week", "2026-09-16", 1);
    expect(window).toMatchObject({
      lens: "7days",
      ref: "2026-09-16",
      start: "2026-09-13",
      end: "2026-09-19",
    });
    expect(window.cells.map((cell) => cell.date)).toEqual([
      "2026-09-13",
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
    ]);
    expect(window.cells.map((cell) => cell.isFuture)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
  });

  it("converts Expo firstWeekday 2 to a Monday start", () => {
    const window = buildYourWeekWindow("calendar_week", "2026-09-16", 2);
    expect(window.start).toBe("2026-09-14");
    expect(window.end).toBe("2026-09-20");
    expect(window.cells.map((cell) => cell.date)).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
  });

  it.each([undefined, 0, 8])(
    "falls back to Sunday-first when firstWeekday is %s",
    (firstWeekday) => {
      expect(buildYourWeekWindow("calendar_week", "2026-09-16", firstWeekday).start).toBe(
        "2026-09-13",
      );
    },
  );
});
