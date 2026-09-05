import { describe, expect, it, vi } from "vitest";
import { filterByGravity } from "@/logic/dashboard-gravity-filter";
import type { ImpactInputs } from "@/db/impact-read";

const NOW = "2026-09-04 10:00:00";

function inputs(interactionCount: number): ImpactInputs {
  return {
    trackingEnabled: 1,
    intervalDays: 30,
    rarelyResponds: 0,
    interactions: Array.from({ length: interactionCount }, () => ({
      occurredAt: NOW,
      connected: 1,
      direction: "outgoing",
    })),
  };
}

describe("filterByGravity", () => {
  it("retains selected tiers in SQL order", async () => {
    const loadInputs = vi.fn(async (id: number) => {
      if (id === 1) return inputs(18); // deep
      if (id === 2) return inputs(0); // thin
      return inputs(3); // building
    });

    await expect(
      filterByGravity([3, 1, 2], ["deep", "building"], loadInputs, NOW),
    ).resolves.toEqual([3, 1]);
  });

  it("passes through an unfiltered gravity family without loading candidates", async () => {
    const loadInputs = vi.fn();
    const candidateIds = [9, 2, 5];

    await expect(filterByGravity(candidateIds, [], loadInputs, NOW)).resolves.toEqual(
      candidateIds,
    );
    expect(loadInputs).not.toHaveBeenCalled();
  });

  it("maps a never-contacted candidate with raw zero to thin", async () => {
    await expect(
      filterByGravity([1], ["thin"], async () => inputs(0), NOW),
    ).resolves.toEqual([1]);
  });
});
