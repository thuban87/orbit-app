/** Pure, deterministic compact Dashboard Card line-3 selection. */
import type { Line3Candidate } from "@/db/dashboard-knowledge-read";
import { formatLocalDate } from "@/utils/dates";

/** Compact Card-only completeness cues; never reuse List's sentence-length prompts. */
export const CARD_PROMPTS = [
  "Add a detail",
  "Remember something",
  "Add some context",
  "Add a detail about {name}",
] as const;

const IMMINENT_DAYS = 30;

export type CardLine3Selection =
  | {
      readonly kind: "candidate";
      readonly text: string;
      readonly type: string;
      readonly candidate: Line3Candidate;
    }
  | { readonly kind: "prompt"; readonly text: string };

function imminentWindowEnd(now: Date): string {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + IMMINENT_DAYS);
  return formatLocalDate(end);
}

function isBirthday(candidate: Line3Candidate): boolean {
  return candidate.type.toLowerCase() === "birthday";
}

function isImminent(candidate: Line3Candidate, now: Date): boolean {
  if (isBirthday(candidate) || candidate.meaningfulDate === null) return false;
  const meaningfulDate = candidate.meaningfulDate.slice(0, 10);
  return meaningfulDate >= formatLocalDate(now) && meaningfulDate <= imminentWindowEnd(now);
}

/** Stable identity ties, never SQL/query input order. */
function compareCandidates(left: Line3Candidate, right: Line3Candidate): number {
  if (left.createdAt !== right.createdAt) return right.createdAt.localeCompare(left.createdAt);
  if (left.id !== right.id) return right.id - left.id;
  if (left.kind !== right.kind) return left.kind.localeCompare(right.kind);
  return left.type.localeCompare(right.type);
}

/** Lower values are more naturally compact/recognizable at Card density. */
function compactnessClass(candidate: Line3Candidate): number {
  const value = candidate.value.trim();
  if (candidate.kind === "relationship") return 0;
  if (
    candidate.kind === "current-state" &&
    (/^(children|pets)$/i.test(candidate.type) || /^\d{1,2}\b/.test(value))
  ) {
    return 0;
  }
  if (candidate.kind === "memory" && candidate.pinned && Array.from(value).length <= 48) {
    return 0;
  }
  return Array.from(value).length <= 32 ? 1 : 2;
}

/** Compactness only breaks ties inside the already-selected priority tier. */
function compareWithinTier(left: Line3Candidate, right: Line3Candidate): number {
  const leftClass = compactnessClass(left);
  const rightClass = compactnessClass(right);
  if (leftClass !== rightClass) return leftClass - rightClass;

  const leftLength = Array.from(left.value.trim()).length;
  const rightLength = Array.from(right.value.trim()).length;
  if (leftLength !== rightLength) return leftLength - rightLength;

  return compareCandidates(left, right);
}

function firstCompact(candidates: readonly Line3Candidate[]): Line3Candidate | undefined {
  return [...candidates].sort(compareWithinTier)[0];
}

function selectedCandidate(candidate: Line3Candidate): CardLine3Selection {
  return {
    kind: "candidate",
    text: candidate.value,
    type: candidate.type,
    candidate,
  };
}

/**
 * Keep List's strict semantic tiers: imminent, pinned, then other context.
 * Card compactness picks only the best presentation within one of those tiers.
 */
export function selectCardLine3(
  candidates: readonly Line3Candidate[],
  contactId: number,
  name: string,
  now: Date,
): CardLine3Selection {
  const useful = candidates.filter(
    (candidate) => !isBirthday(candidate) && candidate.value.trim().length > 0,
  );

  const imminent = firstCompact(useful.filter((candidate) => isImminent(candidate, now)));
  if (imminent) return selectedCandidate(imminent);

  const pinned = firstCompact(useful.filter((candidate) => candidate.pinned));
  if (pinned) return selectedCandidate(pinned);

  const other = firstCompact(useful);
  if (other) return selectedCandidate(other);

  const promptIndex = ((contactId % CARD_PROMPTS.length) + CARD_PROMPTS.length) % CARD_PROMPTS.length;
  return {
    kind: "prompt",
    text: CARD_PROMPTS[promptIndex].replace("{name}", name),
  };
}
