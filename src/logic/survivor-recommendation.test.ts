import { describe, expect, it } from "vitest";
import { recommendSurvivor, type SurvivorRecommendationCandidate } from "@/logic/survivor-recommendation";

const candidate = (patch: Partial<SurvivorRecommendationCandidate> = {}): SurvivorRecommendationCandidate => ({
  id: 1,
  createdAt: "2026-01-01 00:00:00",
  interactionCount: 2,
  activeExternalLinkCount: 1,
  completeDataCount: 3,
  ...patch,
});

describe("recommendSurvivor", () => {
  it.each([
    ["older creation", candidate({ createdAt: "2025-01-01 00:00:00" }), candidate({ id: 2 }), "olderCreatedAt"],
    ["more interactions", candidate({ interactionCount: 3 }), candidate({ id: 2 }), "moreInteractions"],
    ["stronger external linkage", candidate({ activeExternalLinkCount: 2 }), candidate({ id: 2 }), "strongerExternalLinkage"],
    ["more complete data", candidate({ completeDataCount: 4 }), candidate({ id: 2 }), "moreCompleteData"],
  ] as const)("recommends the candidate with %s", (_label, a, b, signal) => {
    expect(recommendSurvivor(a, b)).toEqual({ candidateId: a.id, signals: [signal] });
  });

  it("breaks exact ties by stable contact id", () => {
    expect(recommendSurvivor(candidate({ id: 8 }), candidate({ id: 3 }))).toEqual({ candidateId: 3, signals: [] });
  });
});
