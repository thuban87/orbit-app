/**
 * The dashboard's cause-aware empty-state gate (DASH-07). A pure module with no
 * UI-framework imports (mirrors the `birthday-logic` / `favourites-reorder-logic`
 * convention) so every branch is node-tested off-device.
 *
 * It answers ONE question: given the four population counts, the current visible
 * row count, and the active filter/term, WHICH empty state (if any) should the
 * dashboard render? The SCREEN owns the copy + testIDs; this owns the decision,
 * so no inline count arithmetic leaks into HomeScreen (review HIGH-2).
 *
 * EXPLICIT PRECEDENCE, top to bottom (review MEDIUM-4 — the ordering IS the fix):
 *   (1) rowCount > 0            → 'none'   — a non-empty visible list is never an
 *                                            empty state, whatever else is true.
 *   (2) else hasTerm           → 'search-empty' — an active search that matched
 *                                            nothing wins over any filter or
 *                                            population copy (consistent with the
 *                                            LOW-2 term-wins rule in the DAO).
 *   (3) else activeFilter!=all → 'filter-empty'  — a category / battery /
 *                                            favourites / needs-attention /
 *                                            snoozed filter that yields nothing
 *                                            shows THAT filter's empty state; the
 *                                            screen picks the copy.
 *   (4) else (the UNFILTERED default list) the population-count decision:
 *         'firstrun' ONLY when live===0 && neverContacted===0 && snoozed===0 &&
 *         archived===0 (ALL FOUR empty), otherwise 'hidden'.
 *
 * Why (4) requires ALL FOUR zero (the HIGH-2 fix): the old
 * `no-live && no-archived` gate mislabelled a never-contacted-only or
 * snoozed-only user as first-run and showed "Add your first contact" — wrong,
 * they DO have people, just in a hidden bucket. Requiring all four populations
 * empty is robust regardless of how the "{N} contacts" header semantic is read.
 *
 * Why the precedence matters (the MEDIUM-4 fix): steps (2)/(3) fire BEFORE the
 * population fallback, so a zero-result category/favourites filter or a live
 * search over a NON-empty population resolves to 'filter-empty'/'search-empty' —
 * never wrongly falling through to the hidden-population copy.
 *
 * The error state is NOT decided here — it is the screen's load-throw flag, which
 * short-circuits ahead of this helper.
 */
import type { DashboardFilter } from "@/db/dashboard-read";

/** The empty-state outcomes this gate resolves (error is handled by the screen). */
export type DashboardEmptyState =
  | "none"
  | "firstrun"
  | "hidden"
  | "search-empty"
  | "filter-empty";

export interface DashboardEmptyInput {
  /** countLiveContacts — archived_at IS NULL AND last_contact IS NOT NULL. */
  live: number;
  /** countNeverContacted — archived_at IS NULL AND last_contact IS NULL. */
  neverContacted: number;
  /** countSnoozed — currently future-snoozed, non-archived. */
  snoozed: number;
  /** countArchived — archived_at IS NOT NULL. */
  archived: number;
  /** The number of rows the current visible list returned. */
  rowCount: number;
  /** The persisted dashboard filter (Plan 09 threads live chips through the same input). */
  activeFilter: DashboardFilter;
  /** Whether a non-empty search term is active (Plan 09 threads the live search box). */
  hasTerm: boolean;
}

/**
 * Resolve the dashboard empty state. Pure: same inputs → same output; no I/O;
 * never throws.
 */
export function selectDashboardEmptyState(
  input: DashboardEmptyInput,
): DashboardEmptyState {
  const { live, neverContacted, snoozed, archived, rowCount, activeFilter, hasTerm } =
    input;

  // (1) A non-empty visible list is never an empty state.
  if (rowCount > 0) {
    return "none";
  }

  // (2) An active search that matched nothing wins over filter/population copy.
  if (hasTerm) {
    return "search-empty";
  }

  // (3) A non-'all' filter that yields nothing shows that filter's empty state —
  // resolved BEFORE the population fallback so it never shows the hidden copy.
  if (activeFilter !== "all") {
    return "filter-empty";
  }

  // (4) The unfiltered default list: first-run ONLY when ALL FOUR populations are
  // empty; otherwise the people exist in a hidden bucket → point the user there.
  if (live === 0 && neverContacted === 0 && snoozed === 0 && archived === 0) {
    return "firstrun";
  }
  return "hidden";
}
