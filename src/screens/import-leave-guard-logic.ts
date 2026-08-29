import type { ImportSessionRowStatus } from "@/db/import-session-dao";
import type { ImportSessionRow } from "@/db/import-session-read";

/**
 * Must stay in sync with finalizeSessionIfTerminal's unresolved-row query.
 */
export const UNRESOLVED_ROW_STATUSES: readonly ImportSessionRowStatus[] = [
  "pending",
  "needs_review",
  "failed",
];

/** Whether leaving the review flow would abandon work that still needs resolution. */
export function hasUnresolvedRows(
  rows: ReadonlyArray<Pick<ImportSessionRow, "rowStatus">>,
): boolean {
  return rows.some((row) => UNRESOLVED_ROW_STATUSES.includes(row.rowStatus));
}
