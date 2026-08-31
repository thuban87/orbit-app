import { describe, expect, it } from "vitest";
import {
  isAssistEligible,
  selectBannerState,
} from "@/logic/assist-eligibility";

const NOW = "2026-08-31 12:00:00";

describe("assist eligibility", () => {
  it("includes exactly 15 seconds through exactly 24 hours after handoff", () => {
    expect(isAssistEligible("2026-08-31 11:59:46", NOW)).toBe(false);
    expect(isAssistEligible("2026-08-31 11:59:45", NOW)).toBe(true);
    expect(isAssistEligible("2026-08-30 12:00:00", NOW)).toBe(true);
    expect(isAssistEligible("2026-08-30 11:59:59", NOW)).toBe(false);
  });

  it("returns the newest eligible row and the count remaining after it", () => {
    expect(selectBannerState([], NOW)).toEqual({
      newest: null,
      morePendingCount: 0,
    });

    const rows = [
      {
        id: 1,
        handoff_at: "2026-08-31 11:58:00",
        created_at: "2026-08-31 11:58:00",
      },
      {
        id: 2,
        handoff_at: "2026-08-31 11:59:45",
        created_at: "2026-08-31 11:59:45",
      },
      {
        id: 3,
        handoff_at: "2026-08-31 11:59:45",
        created_at: "2026-08-31 11:59:45",
      },
      {
        id: 4,
        handoff_at: "2026-08-31 11:59:50",
        created_at: "2026-08-31 11:59:50",
      },
    ];

    expect(selectBannerState(rows, NOW)).toEqual({
      newest: rows[2],
      morePendingCount: 2,
    });
  });
});
