/**
 * Pure Dashboard search composition. SQL eligibility and all tokenization live
 * elsewhere; this module only turns scorer-produced match information into the
 * stable presentation contract consumed by Dashboard renderers.
 */
import type {
  KnowledgeSearchCandidate,
  KnowledgeSearchEntry,
} from "@/db/knowledge-search-read";
import { MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import {
  type KnowledgeSearchEntryMatch,
  matchCandidateEntries,
  rankCandidatesWithCoverage,
} from "@/services/knowledge-search";

/**
 * Closed descriptor kinds. The four 38.10 section kinds (D-58, D-62) name the
 * Things to Remember section a hit came from (D-44), so the result line reads
 * e.g. "1 match · Off Limits".
 */
export type DashboardSearchSourceKind =
  | "identity"
  | "relationship"
  | "last-talked-about"
  | "current-location"
  | "memory-or-custom-field"
  | "thought-of-them"
  | "gift-idea"
  | "off-limits"
  | "note-or-body";

export interface DashboardSearchMatch {
  readonly sourceKind: DashboardSearchSourceKind;
  readonly fieldLabel: string;
  readonly snippet: string;
  readonly highlights: ReadonlyArray<{
    readonly start: number;
    readonly length: number;
  }>;
  readonly priority: number;
}

export interface DashboardSearchResult {
  readonly contactId: number;
  readonly score: number;
  readonly matches: ReadonlyArray<DashboardSearchMatch>;
  readonly totalMatchCount: number;
  /** Render-ready overflow copy; omitted when every match descriptor is shown. */
  readonly moreMatchesLabel?: string;
}

function sourceKind(entry: KnowledgeSearchEntry): DashboardSearchSourceKind {
  if (
    entry.source === "name" ||
    entry.source === "phone" ||
    entry.source === "email" ||
    entry.source === "category"
  ) {
    return "identity";
  }
  if (entry.source === "offLimits") return "off-limits";
  if (entry.source === "currentState") {
    return entry.currentStateField === "current_location"
      ? "current-location"
      : "last-talked-about";
  }
  // A Gift Ideas / Thought of Them hit names its own section, whichever part of
  // the item matched.
  if (entry.source === "memory" && entry.memoryType === "gift_idea") {
    return "gift-idea";
  }
  if (entry.source === "memory" && entry.memoryType === "thought_of_them") {
    return "thought-of-them";
  }
  if (entry.part === "note-or-body") return "note-or-body";
  if (entry.source === "relationship") return "relationship";
  return "memory-or-custom-field";
}

/**
 * Descriptor rank (lower shows first). Identity and Key People keep their lead;
 * the section kinds sit between them and notes in the D-44 section order.
 */
function priority(kind: DashboardSearchSourceKind): number {
  switch (kind) {
    case "identity":
      return 1;
    case "relationship":
      return 2;
    case "last-talked-about":
      return 3;
    case "current-location":
      return 4;
    case "memory-or-custom-field":
      return 5;
    case "thought-of-them":
      return 6;
    case "gift-idea":
      return 7;
    case "off-limits":
      return 8;
    case "note-or-body":
      return 9;
  }
}

function fieldLabel(entry: KnowledgeSearchEntry): string {
  return entry.source === "memory" && entry.memoryType
    ? MEMORY_TYPE_REGISTRY[entry.memoryType].displayName
    : entry.label;
}

function descriptor(
  match: KnowledgeSearchEntryMatch<KnowledgeSearchEntry>,
): DashboardSearchMatch {
  const kind = sourceKind(match.entry);
  const highlights = match.termMatches.flatMap(
    (termMatch) => termMatch.highlights,
  );
  const uniqueHighlights = highlights.filter(
    (highlight, index) =>
      highlights.findIndex(
        (other) =>
          other.start === highlight.start && other.length === highlight.length,
      ) === index,
  );
  return {
    sourceKind: kind,
    fieldLabel: fieldLabel(match.entry),
    snippet: match.entry.text,
    highlights: uniqueHighlights,
    priority: priority(kind),
  };
}

function buildResult(
  candidate: KnowledgeSearchCandidate,
  score: number,
  matches: readonly KnowledgeSearchEntryMatch<KnowledgeSearchEntry>[],
): DashboardSearchResult {
  const descriptors = matches
    .map(descriptor)
    .sort((left, right) => left.priority - right.priority);
  const shown = descriptors.slice(0, 3);
  const totalMatchCount = descriptors.length;
  const hidden = totalMatchCount - shown.length;
  return {
    contactId: candidate.contactId,
    score,
    matches: shown,
    totalMatchCount,
    ...(hidden > 0 ? { moreMatchesLabel: `+${hidden} more` } : {}),
  };
}

/** Build one display result from the scorer's offset-preserving match surface. */
export function buildDashboardSearchResult(
  candidate: KnowledgeSearchCandidate,
  term: string,
): DashboardSearchResult {
  const matches = matchCandidateEntries(term, candidate.entries);
  return buildResult(
    candidate,
    matches.reduce((total, match) => total + match.score, 0),
    matches,
  );
}

/**
 * Search the already-scoped corpus. Relevance remains primary; the fully
 * resolved Dashboard row order is used only when equally relevant results tie.
 */
export function searchDashboard(
  candidates: readonly KnowledgeSearchCandidate[],
  term: string,
  orderedEligibleIds: readonly number[],
): DashboardSearchResult[] {
  const dashboardRanks = new Map(
    orderedEligibleIds.map((contactId, index) => [contactId, index]),
  );
  return rankCandidatesWithCoverage(term, candidates)
    .sort(
      (left, right) =>
        right.coverage - left.coverage ||
        right.score - left.score ||
        (dashboardRanks.get(left.candidate.contactId) ??
          Number.MAX_SAFE_INTEGER) -
          (dashboardRanks.get(right.candidate.contactId) ??
            Number.MAX_SAFE_INTEGER),
    )
    .map((ranked) =>
      buildResult(ranked.candidate, ranked.score, ranked.matches),
    );
}
