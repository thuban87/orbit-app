import { describe, expect, it } from "vitest";
import {
  computeContactGravity,
  computeContactIntensity,
} from "@/services/impact";

const NOW = "2026-08-28 12:00:00";
const HISTORY = [
  {
    occurredAt: "2026-08-20 12:00:00",
    connected: 1,
    direction: "outbound" as const,
  },
];

describe("Bound-aware impact orchestration", () => {
  it("keeps Bound contact intensity behavior unchanged", () => {
    const intensity = computeContactIntensity(
      {
        trackingEnabled: 1,
        intervalDays: 30,
        rarelyResponds: 0,
        interactions: HISTORY,
      },
      NOW,
    );

    expect(intensity).toMatchObject({
      periodDays: 30,
      currentCount: 1,
      intendedPerPeriod: 1,
      multiple: 1,
    });
  });

  it.each([
    ["dormant cadence", 30],
    ["never-assigned cadence", null],
  ])(
    "keeps gravity but marks intensity unavailable for an Unbound contact with %s",
    (_caseName, intervalDays) => {
      const inputs = {
        trackingEnabled: 0,
        intervalDays,
        rarelyResponds: 0,
        interactions: HISTORY,
      };

      expect(computeContactGravity(inputs, NOW).raw).toBeGreaterThan(0);
      expect(computeContactIntensity(inputs, NOW)).toEqual({
        available: false,
      });
    },
  );
});
