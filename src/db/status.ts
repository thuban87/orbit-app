/**
 * Query-time status engine — thresholds + SQL fragments (DATA-05).
 *
 * Status and continuous progress are DERIVED-NEVER-STORED: they are computed in
 * the SELECT from `date('now','localtime')` and `interval_days`, never written
 * to a column. A stored status/progress column would rot silently with the mere
 * passage of time (nothing fires a trigger on the clock advancing), so this
 * module exports only SQL STRING CONSTANTS and threshold numbers and issues NO
 * write statement (no ALTER / UPDATE / INSERT).
 *
 * TIMESTAMPS ARE STORED LOCAL WALL-CLOCK. Both `interactions.occurred_at` and
 * `contacts.last_contact` are written as local wall-clock strings by the single-
 * writer recency DAO (via formatLocalDate() — RESEARCH §Code Example 1b/2,
 * DATA-04/05). The STORED column is therefore ALREADY local and MUST NOT be
 * re-run through the 'localtime' modifier: doing so would make SQLite interpret
 * an already-local value as UTC and shift late-night rows a calendar day early
 * (the review HIGH "status SQL timezone double-conversion"). Only `now` — a true
 * UTC instant — is converted to local. This deliberately DEPARTS from RESEARCH
 * §Code Example 3, which wrongly applied 'localtime' to `last_contact`.
 *
 * DRIFT NOTE — thresholds are shared with `src/types.ts`. STABLE_MAX (0.8) and
 * WOBBLE_MAX (1.0) are the SAME buckets that `calculateStatus()` in
 * `src/types.ts` hardcodes INLINE (`threshold * 0.8` at src/types.ts:112 and
 * `< threshold` at :117). SQL cannot import the TS function, and no exported
 * constant exists on that side, so this is a documented single-source
 * convention: if you tune one side, tune the other. (Review LOW
 * "threshold-constant duplication drift" — the documented-convention mitigation
 * is intentional.)
 */

/**
 * Top-of-file tunable thresholds — the ONLY place these buckets are defined for
 * the query-time engine. Counterpart: `src/types.ts calculateStatus()` (see the
 * DRIFT NOTE above). `progress` is elapsed ÷ interval (a continuous quantity):
 *   - `< STABLE_MAX`            → stable
 *   - `[STABLE_MAX, WOBBLE_MAX)`→ wobble
 *   - `[WOBBLE_MAX, ROGUE_K)`   → decay
 *   - `>= ROGUE_K`              → rogue (a 4th threshold, plus the rarely_responds path)
 */
export const STABLE_MAX = 0.8;
export const WOBBLE_MAX = 1.0;
export const ROGUE_K = 3;

/**
 * Continuous progress = elapsed ÷ interval, DAY-GRANULAR at local midnight.
 *
 * `date('now','localtime')` truncates the current UTC instant to the LOCAL day;
 * `date(last_contact)` (NO modifier) truncates the already-local stored value.
 * Truncating both sides makes two contacts last-contacted the same calendar day
 * yield identical progress regardless of the wall-clock time-of-day stored, and
 * avoids double-converting the stored column (the fixed review HIGH).
 *
 * NULL note: when `last_contact IS NULL` this expression is NULL, which every
 * comparison in STATUS_SQL treats as false → STATUS_SQL alone would bucket a
 * never-contacted row as 'stable'. That is only safe because the sole Phase-2
 * consumer (STATUS_SCAN in queries.ts) pre-filters `last_contact IS NULL`. Any
 * future STANDALONE caller of STATUS_SQL MUST filter NULL first.
 */
export const PROGRESS_SQL = `CAST(julianday(date('now','localtime')) - julianday(date(last_contact)) AS REAL) / interval_days`;

/**
 * Query-time status bucket over PROGRESS_SQL. `rogue` is a 4th threshold
 * (`progress >= ROGUE_K`) OR the "Rarely responds" non-time path
 * (`rarely_responds = 1 AND progress >= WOBBLE_MAX`). Only code CONSTANTS are
 * interpolated — never user input. See the NULL note on PROGRESS_SQL.
 */
export const STATUS_SQL = `CASE
    WHEN rarely_responds = 1 AND (${PROGRESS_SQL}) >= ${WOBBLE_MAX} THEN 'rogue'
    WHEN (${PROGRESS_SQL}) >= ${ROGUE_K}    THEN 'rogue'
    WHEN (${PROGRESS_SQL}) >= ${WOBBLE_MAX} THEN 'decay'
    WHEN (${PROGRESS_SQL}) >= ${STABLE_MAX} THEN 'wobble'
    ELSE 'stable'
  END`;

/**
 * Query-time rogue REASON over PROGRESS_SQL — WHY a contact is rogue, or NULL.
 *
 * The branch order is IDENTICAL to STATUS_SQL (the rarely_responds branch FIRST,
 * then the beyond-decay ROGUE_K branch) so status and reason can NEVER disagree:
 * whichever branch STATUS_SQL takes to reach 'rogue', REASON_SQL takes the same
 * branch to name it. A rarely_responds contact past ROGUE_K therefore reads
 * 'unresponsive' (branch 1 wins in both), matching STATUS_SQL's 'rogue' via its
 * own branch 1. Non-rogue buckets (decay / wobble / stable) map to NULL.
 *
 * Only the existing code CONSTANTS (WOBBLE_MAX, ROGUE_K, PROGRESS_SQL) are
 * interpolated — never user input, matching this module's injection posture. See
 * the NULL note on PROGRESS_SQL: a NULL last_contact makes every comparison false
 * → ELSE NULL here, but a standalone by-id caller must still guard NULL itself
 * (STATUS_SQL alone would bucket it 'stable').
 *
 * The BRANCH LOGIC (rarely_responds-first, ROGUE_K threshold) is CITED and firm;
 * the reason VALUE NAMING ('overdue' / 'unresponsive') is the RESEARCH A4
 * assumption for the in-app label copy.
 */
export const REASON_SQL = `CASE
    WHEN rarely_responds = 1 AND (${PROGRESS_SQL}) >= ${WOBBLE_MAX} THEN 'unresponsive'
    WHEN (${PROGRESS_SQL}) >= ${ROGUE_K} THEN 'overdue'
    ELSE NULL
  END`;
