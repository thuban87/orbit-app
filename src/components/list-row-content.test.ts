import { describe, expect, it } from "vitest";
import { formatLine2, formatListRecency } from "@/components/list-row-content";

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
});
