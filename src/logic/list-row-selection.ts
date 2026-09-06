/** Pure, deterministic Dashboard List line-3 selection. */
import type { Line3Candidate } from "@/db/dashboard-knowledge-read";

/** UI-SPEC Copywriting Contract canon; selection is stable, never random. */
export const PROMPTS = [
  "Add something to remember about {name}",
  "What should you remember about {name}?",
  "Add a detail about {name}",
  "Fill in a little more about {name}",
  "What's useful to know about {name}?",
  "Add some context about {name}",
  "Save something worth remembering about {name}",
  "Add a note, detail, or memory about {name}",
  "Tell Orbit a little more about {name}",
  "Nothing remembered about {name} yet",
] as const;

/** Tunable local-calendar window for time-sensitive meaningful dates. */
export const IMMINENT_DAYS = 30;

export type Line3Selection =
  | {
      readonly kind: "candidate";
      readonly text: string;
      readonly type: string;
      readonly candidate: Line3Candidate;
    }
  | { readonly kind: "prompt"; readonly text: string };

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

function firstStable(candidates: readonly Line3Candidate[]): Line3Candidate | undefined {
  return [...candidates].sort(compareCandidates)[0];
}

function selectedCandidate(candidate: Line3Candidate): Line3Selection {
  return {
    kind: "candidate",
    text: candidate.value,
    type: candidate.type,
    candidate,
  };
}

/**
 * Select one adaptive row item: imminent information, then pinned knowledge,
 * then other useful knowledge, and finally a stable gentle completeness cue.
 */
export function selectLine3(
  candidates: readonly Line3Candidate[],
  contactId: number,
  name: string,
  now: Date,
): Line3Selection {
  // The read excludes birthdays already; keep this pure boundary defensive so a
  // future caller cannot accidentally reintroduce birthday context.
  const useful = candidates.filter(
    (candidate) => !isBirthday(candidate) && candidate.value.trim().length > 0,
  );
  const imminent = firstStable(useful.filter((candidate) => isImminent(candidate, now)));
  if (imminent) return selectedCandidate(imminent);

  const pinned = firstStable(useful.filter((candidate) => candidate.pinned));
  if (pinned) return selectedCandidate(pinned);

  const other = firstStable(useful);
  if (other) return selectedCandidate(other);

  const promptIndex = ((contactId % PROMPTS.length) + PROMPTS.length) % PROMPTS.length;
  return {
    kind: "prompt",
    text: PROMPTS[promptIndex].replace("{name}", name),
  };
}
