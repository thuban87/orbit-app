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
  matchCandidateEntries,
  rankCandidatesWithCoverage,
  type KnowledgeSearchEntryMatch,
} from "@/services/knowledge-search";

export type DashboardSearchSourceKind =
  | "identity"
  | "relationship"
  | "memory-or-custom-field"
  | "note-or-body";

export interface DashboardSearchMatch {
  readonly sourceKind: DashboardSearchSourceKind;
  readonly fieldLabel: string;
  readonly snippet: string;
  readonly highlights: ReadonlyArray<{ readonly start: number; readonly length: number }>;
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
  if (entry.part === "note-or-body") return "note-or-body";
  if (entry.source === "relationship") return "relationship";
  return "memory-or-custom-field";
}

function priority(kind: DashboardSearchSourceKind): number {
  switch (kind) {
    case "identity":
      return 1;
    case "relationship":
      return 2;
    case "memory-or-custom-field":
      return 3;
    case "note-or-body":
      return 4;
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
  const highlights = match.termMatches.flatMap((termMatch) => termMatch.highlights);
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
        (dashboardRanks.get(left.candidate.contactId) ?? Number.MAX_SAFE_INTEGER) -
          (dashboardRanks.get(right.candidate.contactId) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((ranked) =>
      buildResult(ranked.candidate, ranked.score, ranked.matches),
    );
}
