/**
 * The Contacts header count (D-55, owner 2026-09-27; OA-E1).
 *
 * The header shows what is actually on screen: the number of contacts the
 * ACTIVE VIEW displays for the active population, filters and search — the
 * List's rows, or the Card grid's rows (in Card selection mode, the frozen
 * subset it shows). One helper serves both views, so List and Card always
 * agree. This supersedes the Phase 26 total-live header rule (`26-UAT.md`
 * "Product observation") and D-51's "record, don't change".
 *
 * The live count (`countLiveContacts`) stays for the cause-aware empty state
 * only (`selectDashboardEmptyState`); the header never reads it.
 *
 * Pure: no React, no react-native.
 */
import type { DashboardViewMode } from "@/logic/dashboard-query-logic";

export interface DashboardHeaderCountInput {
  /** The latest read failed; the error state renders instead of rows. */
  error: boolean;
  /** The initial skeleton is showing (no read has published yet). */
  initialLoading: boolean;
  viewMode: DashboardViewMode;
  /** Rows the List view renders. */
  listRowCount: number;
  /** Rows the Card view renders (the frozen subset in selection mode). */
  cardRowCount: number;
}

/**
 * The displayed contact count, or `null` when the header count is hidden: on a
 * read error, during the initial skeleton, and when the view displays nothing
 * (the cause-aware empty state speaks then).
 */
export function dashboardHeaderCount({
  error,
  initialLoading,
  viewMode,
  listRowCount,
  cardRowCount,
}: DashboardHeaderCountInput): number | null {
  if (error || initialLoading) return null;
  const displayed = viewMode === "card" ? cardRowCount : listRowCount;
  return displayed > 0 ? displayed : null;
}

/** "1 contact" / "{n} contacts" — the header copy. */
export function dashboardHeaderCountLabel(count: number): string {
  return `${count} contact${count === 1 ? "" : "s"}`;
}
