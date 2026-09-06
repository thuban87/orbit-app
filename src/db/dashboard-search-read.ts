/**
 * List-only Dashboard search composition. This module joins the already-built
 * local corpus scorer to the Dashboard eligibility and name/fuel reads without
 * duplicating SQL predicates or tokenizer behaviour.
 */
import {
  listDashboardSearch,
  listDashboardSearchEligible,
  type DashboardRow,
} from "@/db/dashboard-read";
import { listKnowledgeSearchCandidates } from "@/db/knowledge-search-read";
import type { SqlExecutor } from "@/db/types";
import {
  searchDashboard,
  type DashboardSearchResult,
} from "@/logic/dashboard-search-match";
import type { DashboardQueryState } from "@/logic/dashboard-query-logic";

/** A Dashboard row plus its corpus descriptor; null retains the fuel fallback. */
export interface DashboardSearchRow {
  readonly row: DashboardRow;
  readonly match: DashboardSearchResult | null;
}

/**
 * Compose corpus relevance results with the shipped Dashboard name/fuel search.
 * Corpus matches always retain `searchDashboard`'s relevance-first ordering;
 * fuel-only rows are appended in the resolved eligible Dashboard order.
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
  const [candidates, fuelRows] = await Promise.all([
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
  const fuelById = new Map(fuelRows.map((row) => [row.id, row]));
  const fuelOnlyRows = orderedEligibleIds.flatMap((contactId) => {
    if (corpusIds.has(contactId)) return [];
    const row = fuelById.get(contactId);
    return row ? [{ row, match: null }] : [];
  });

  return [...corpusRows, ...fuelOnlyRows];
}
