import { describe, expect, it } from "vitest";
import {
  buildRowAccessibilityDescription,
  formatLine2,
  formatListRecency,
} from "@/components/list-row-content";

describe("ListRow content", () => {
  const now = "2026-08-15 12:00:00";

  it("formats local-calendar recency compactly", () => {
    expect(formatListRecency(null, now)).toBe("No interactions yet");
    expect(formatListRecency("2026-08-15 00:00:00", now)).toBe("Today");
    expect(formatListRecency("2026-08-14 23:00:00", now)).toBe("Yesterday");
    expect(formatListRecency("2026-07-28", now)).toBe("18d ago");
  });

  it("composes recency and the one displayed category", () => {
    expect(formatLine2("18d ago", "Friend")).toBe("18d ago · Friend");
    expect(formatLine2("No interactions yet", null)).toBe("No interactions yet");
  });

  it.each([
    ["stable", "Stable"],
    ["wobble", "Wobbling"],
    ["decay", "Decaying"],
    ["rogue", "Rogue"],
    ["snoozed", "Snoozed"],
    [null, "Not yet contacted"],
  ] as const)("describes %s status without relying on colour", (displayState, label) => {
    expect(
      buildRowAccessibilityDescription({
        name: "Ada Lovelace",
        category: "Friend",
        recency: "Yesterday",
        isFavourite: true,
        displayState,
      }),
    ).toBe(`Ada Lovelace. Friend. Yesterday. Favourite. ${label}.`);
  });

  it("describes missing category and non-favourite membership", () => {
    expect(
      buildRowAccessibilityDescription({
        name: "Grace Hopper",
        category: null,
        recency: "No interactions yet",
        isFavourite: false,
        displayState: null,
      }),
    ).toBe(
      "Grace Hopper. No category. No interactions yet. Not favourite. Not yet contacted.",
    );
  });
});
