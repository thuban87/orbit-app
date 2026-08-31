/**
 * Pure, advisory continuity heuristic for the merge survivor picker.  The
 * weights intentionally live here so product tuning remains a one-number edit.
 */
export const OLDER_CREATED_AT_WEIGHT = 4;
export const INTERACTION_WEIGHT = 2;
export const EXTERNAL_LINK_WEIGHT = 3;
export const COMPLETE_DATA_WEIGHT = 1;

export type SurvivorContinuitySignal =
  | "olderCreatedAt"
  | "moreInteractions"
  | "strongerExternalLinkage"
  | "moreCompleteData";

export interface SurvivorRecommendationCandidate {
  id: number;
  createdAt: string;
  interactionCount: number;
  activeExternalLinkCount: number;
  completeDataCount: number;
}

export interface SurvivorRecommendation {
  candidateId: number;
  signals: SurvivorContinuitySignal[];
}

function scoreCandidate(
  candidate: SurvivorRecommendationCandidate,
  other: SurvivorRecommendationCandidate,
): { score: number; signals: SurvivorContinuitySignal[] } {
  const signals: SurvivorContinuitySignal[] = [];
  let score = 0;
  if (candidate.createdAt < other.createdAt) {
    score += OLDER_CREATED_AT_WEIGHT;
    signals.push("olderCreatedAt");
  }
  if (candidate.interactionCount > other.interactionCount) {
    score += INTERACTION_WEIGHT;
    signals.push("moreInteractions");
  }
  if (candidate.activeExternalLinkCount > other.activeExternalLinkCount) {
    score += EXTERNAL_LINK_WEIGHT;
    signals.push("strongerExternalLinkage");
  }
  if (candidate.completeDataCount > other.completeDataCount) {
    score += COMPLETE_DATA_WEIGHT;
    signals.push("moreCompleteData");
  }
  return { score, signals };
}

/**
 * Returns an advisory selection, never a score. Exact ties use the stable,
 * smaller contact id so the UI is deterministic while remaining overridable.
 */
export function recommendSurvivor(
  a: SurvivorRecommendationCandidate,
  b: SurvivorRecommendationCandidate,
): SurvivorRecommendation {
  const aResult = scoreCandidate(a, b);
  const bResult = scoreCandidate(b, a);
  if (aResult.score > bResult.score || (aResult.score === bResult.score && a.id < b.id)) {
    return { candidateId: a.id, signals: aResult.signals };
  }
  return { candidateId: b.id, signals: bResult.signals };
}
