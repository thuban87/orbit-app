/**
 * List-only Dashboard search composition. This module joins the already-built
 * local corpus scorer to the Dashboard eligibility and name reads without
 * duplicating SQL predicates or tokenizer behaviour. Every knowledge home the
 * corpus covers (memories, Key People, custom fields, Last Talked About,
 * Current Location, Off Limits) is matched there, never by a LIKE.
 */
import {
  type DashboardRow,
  listDashboardSearch,
  listDashboardSearchEligible,
} from "@/db/dashboard-read";
import { listKnowledgeSearchCandidates } from "@/db/knowledge-search-read";
import type { SqlExecutor } from "@/db/types";
import type { DashboardQueryState } from "@/logic/dashboard-query-logic";
import {
  type DashboardSearchResult,
  searchDashboard,
} from "@/logic/dashboard-search-match";

/** A Dashboard row plus its corpus descriptor; null marks a name-LIKE-only row. */
export interface DashboardSearchRow {
  readonly row: DashboardRow;
  readonly match: DashboardSearchResult | null;
}

/**
 * Compose corpus relevance results with the shipped Dashboard name search.
 * Corpus matches always retain `searchDashboard`'s relevance-first ordering;
 * name-only rows (a substring the corpus scorer did not match) are appended in
 * the resolved eligible Dashboard order.
 */
export async function composeDashboardSearch(
  exec: SqlExecutor,
  query: DashboardQueryState,
  term: string,
  now: string,
): Promise<DashboardSearchRow[]> {
  if (term.trim() === "") return [];

  const eligibleRows = await listDashboardSearchEligible(exec, query, now);
  const orderedEligibleIds = eligibleRows.map((row) => row.id);
  const [candidates, nameRows] = await Promise.all([
    listKnowledgeSearchCandidates(exec, { eligibleIds: orderedEligibleIds }),
    listDashboardSearch(exec, query, term, now),
  ]);
  const eligibleById = new Map(eligibleRows.map((row) => [row.id, row]));
  const corpusResults = searchDashboard(candidates, term, orderedEligibleIds);
  const corpusIds = new Set(corpusResults.map((result) => result.contactId));
  const corpusRows = corpusResults.flatMap((match) => {
    const row = eligibleById.get(match.contactId);
    return row ? [{ row, match }] : [];
  });
  const nameById = new Map(nameRows.map((row) => [row.id, row]));
  const nameOnlyRows = orderedEligibleIds.flatMap((contactId) => {
    if (corpusIds.has(contactId)) return [];
    const row = nameById.get(contactId);
    return row ? [{ row, match: null }] : [];
  });

  return [...corpusRows, ...nameOnlyRows];
}
