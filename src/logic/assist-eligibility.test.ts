import { describe, expect, it } from "vitest";
import {
  applyAssistSkips,
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

  describe("applyAssistSkips (38.14 D-23 / D-77)", () => {
    const rows = [
      { uid: "a", id: 1 },
      { uid: "b", id: 2 },
      { uid: "c", id: 3 },
      { uid: "d", id: 4 },
    ];
    const none = new Set<string>();

    it("drops the panel-owned record and every Later'd record, keeping order", () => {
      expect(
        applyAssistSkips(rows, {
          panelOwnedUid: "b",
          laterUids: new Set(["d"]),
        }).map((row) => row.uid),
      ).toEqual(["a", "c"]);
    });

    it("drops the claimed record alone when nothing is Later'd", () => {
      expect(
        applyAssistSkips(rows, { panelOwnedUid: "c", laterUids: none }).map(
          (row) => row.uid,
        ),
      ).toEqual(["a", "b", "d"]);
    });

    it("drops Later'd records alone when nothing is claimed", () => {
      expect(
        applyAssistSkips(rows, {
          panelOwnedUid: null,
          laterUids: new Set(["a", "c"]),
        }).map((row) => row.uid),
      ).toEqual(["b", "d"]);
    });

    it("never mutates the input and is a no-op with no skips", () => {
      const input = [...rows];
      const snapshot = JSON.stringify(input);
      const out = applyAssistSkips(input, {
        panelOwnedUid: null,
        laterUids: none,
      });
      expect(out).toEqual(rows);
      expect(out).not.toBe(input);
      applyAssistSkips(input, {
        panelOwnedUid: "a",
        laterUids: new Set(["b"]),
      });
      expect(JSON.stringify(input)).toBe(snapshot);
    });
  });
});
