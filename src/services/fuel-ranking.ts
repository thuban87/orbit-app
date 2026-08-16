/**
 * PURE conversational-fuel ranking (FUEL-03) — the ONE precedence rule every
 * glanceable surface (card / notification / widget / compose / AI prompt) reuses,
 * written ONCE so two code paths can never drift.
 *
 * No react-native, no Skia, no expo, no DB import: node-unit-tested
 * (`fuel-ranking.test.ts`) exactly like `gravity-logic.ts`. `compareFuel` is
 * generic over a STRUCTURAL shape so it stays reusable by the SQL parity test in
 * `fuel-read.test.ts` without importing the DB layer.
 *
 * =============================================================================
 * THE DECISION (docs/dossier/03-fuel.md Cluster D — owner [DECIDED]):
 *
 *   ONE ranked projection: KIND PRIORITY FIRST, THEN RECENCY. Precedence is
 *   newest `recent`, else `gift`, else `topic`, else `fact`.
 *   [REJECTED] "Newest item regardless of kind" — a `fact` from yesterday would
 *   outrank a `recent` from last week. So kind ALWAYS dominates recency: a
 *   week-old `recent` beats a day-old `fact`.
 *
 * DERIVED-CONSTANT CONTRACT: the SQL `RANK_CASE` in `fuel-read.getRankedFuel`
 * is built FROM `FUEL_KIND_PRIORITY` (imported there), and a parity test in
 * `fuel-read.test.ts` asserts the SQL order == `compareFuel` order over an
 * eligible-only fixture (RESEARCH Pitfall 3). Change the tunable in ONE place
 * and both the pure comparator and the SQL projection move together.
 *
 * ORDER DETERMINISM: kind index → created_at DESC → id DESC. `created_at` is
 * compared as a STRING, matching SQLite's TEXT ordering on the stored
 * `YYYY-MM-DD HH:MM:SS` local wall-clock stamp — so the comparator and the SQL
 * `ORDER BY created_at DESC` agree byte-for-byte (no Date parse, no UTC).
 * =============================================================================
 */

/**
 * The 4 RANKABLE fuel kinds in precedence order (tunable — top-of-file per
 * CLAUDE.md: retuning ranking is a single-line edit here). `off_limits` is NOT
 * listed: it is excluded from the ranked projection IN-QUERY, so it never needs a
 * rank — any kind not in this list falls to the last bucket (see `kindRank`).
 */
export const FUEL_KIND_PRIORITY: readonly string[] = [
  "recent",
  "gift",
  "topic",
  "fact",
];

/** The structural shape `compareFuel` ranks — a subset of `FuelItem`. */
export interface RankableFuel {
  id: number;
  kind: string;
  created_at: string;
}

/**
 * A kind's rank = its index in `FUEL_KIND_PRIORITY`; any unlisted kind
 * (`off_limits` / unknown) defaults to `FUEL_KIND_PRIORITY.length` so it sorts
 * LAST. This mirrors the SQL `ELSE FUEL_KIND_PRIORITY.length` in the RANK_CASE.
 */
function kindRank(kind: string): number {
  const i = FUEL_KIND_PRIORITY.indexOf(kind);
  return i === -1 ? FUEL_KIND_PRIORITY.length : i;
}

/**
 * Order two fuel rows for the ranked projection: kind priority FIRST (lower rank
 * = higher precedence), THEN created_at DESC (newer first, string-compared to
 * match SQLite TEXT ordering), THEN id DESC (deterministic tiebreak). Pure and
 * side-effect-free — a `[...rows].sort(compareFuel)` yields the same order as
 * `getRankedFuel`'s SQL over the same eligible rows.
 */
export function compareFuel(a: RankableFuel, b: RankableFuel): number {
  const rankDelta = kindRank(a.kind) - kindRank(b.kind);
  if (rankDelta !== 0) {
    return rankDelta;
  }
  if (a.created_at !== b.created_at) {
    // DESC: the lexically-greater (newer) stamp sorts first.
    return a.created_at < b.created_at ? 1 : -1;
  }
  // DESC id tiebreak.
  return b.id - a.id;
}
