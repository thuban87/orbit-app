/**
 * Conversational-fuel read module (FUEL-01/FUEL-02) — the SINGLE shared,
 * user-facing / projection fuel read choke point. A pure, read-only SELECT: NO
 * transaction, every value `?`-bound, no network — and only static column names
 * are literal text (T-07-01). Modelled on `timeline-read.ts`.
 *
 * =============================================================================
 * LOAD-BEARING READ-PATH RULES — READ BEFORE ADDING A READER:
 *   1. This file is the ONLY user-facing / projection fuel read path. Every
 *      projection added later (getRankedFuel, Plan 02) lands HERE. (The standalone
 *      cross-contact `searchFuel` projection was retired in Phase 8 — dashboard
 *      search now lives in `dashboard-read.ts`'s `listDashboard`, which reuses the
 *      shared `RANKED_FUEL_EXCLUSIONS` / `escapeLike` exports below.) purge-dao's
 *      MAINTENANCE reads — the impact count at `purge-dao.ts:105`
 *      (`SELECT COUNT(*) … FROM fuel`) and the delete fan-out at `:188`
 *      (`DELETE FROM fuel …`) — are a SEPARATE maintenance path and are EXPLICITLY
 *      EXEMPT: do NOT "consolidate" them here (that would duplicate the purge
 *      path). (Addresses review LOW-6.)
 *   2. `listFuelForEditor` is the ONLY projection read that OMITS the off_limits
 *      predicate — you must be able to edit off_limits on the profile, so the
 *      editor list returns EVERY kind. Every OTHER projection (ranked line, search)
 *      MUST exclude off_limits IN-QUERY, never in the UI: the structural
 *      "off_limits never leaves the device / never surfaces at a glance" guarantee
 *      lives in SQL, not in a component that could be refactored away.
 * =============================================================================
 */
import type { FuelKind } from "@/db/fuel-dao";
import type { SqlExecutor } from "@/db/types";
import { FUEL_KIND_PRIORITY } from "@/services/fuel-ranking";

/** One fuel row as rendered by the profile editor. */
export interface FuelItem {
  id: number;
  contact_id: number;
  kind: FuelKind;
  label: string | null;
  text: string | null;
  url: string | null;
  created_at: string;
  /** Provenance (see `FuelSource` in fuel-dao) — a plain string, no CHECK. */
  source: string;
}

/**
 * The editor list: ALL of a contact's fuel, every kind INCLUDING off_limits and
 * every source INCLUDING 'ai', newest-first. `created_at DESC` is the canonical
 * order; `id DESC` is the deterministic tiebreak when two rows share a created_at.
 * `contact_id` is the sole `?`-bound value; only column names are literal text.
 */
const LIST_FUEL_FOR_EDITOR = `SELECT id, contact_id, kind, label, text, url, created_at, source
    FROM fuel
   WHERE contact_id = ?
   ORDER BY created_at DESC, id DESC`;

/**
 * Read a contact's full fuel list for the profile editor, newest-first. Returns
 * `[]` for a contact with no fuel (never throws); rows for other contacts are
 * excluded (`contact_id` bound). This is the ONE read that surfaces off_limits —
 * see the read-path rules above. Pure read — no transaction.
 */
export function listFuelForEditor(
  exec: SqlExecutor,
  contactId: number,
): Promise<FuelItem[]> {
  return exec.getAllAsync<FuelItem>(LIST_FUEL_FOR_EDITOR, [contactId]);
}

/**
 * The `ORDER BY` kind-priority CASE, built ONCE at module load FROM
 * `FUEL_KIND_PRIORITY` (the single ranking tunable in fuel-ranking.ts) — so the
 * SQL projection and the pure `compareFuel` can never drift (a parity test in
 * fuel-read.test.ts asserts they agree). Each kind maps to its index; anything
 * not listed (`off_limits` / unknown) falls to `ELSE = FUEL_KIND_PRIORITY.length`,
 * mirroring `compareFuel`'s default bucket.
 *
 * T-07-01 (SQL injection): every value interpolated here is a COMPILE-TIME code
 * constant from a closed hardcoded array — the kind strings and their integer
 * indices — never user input. `contact_id` remains the SOLE `?`-bound value in
 * `getRankedFuel`. There is therefore no injection surface; a `?`-bind is neither
 * possible (SQLite cannot bind an identifier / a CASE branch) nor needed.
 *
 * Reused by dashboard-read.ts (Phase 8) — the single source for the card fuel
 * line ORDER BY (exported so the dashboard card ranks fuel identically, no drift).
 */
export const RANK_CASE = `CASE kind
${FUEL_KIND_PRIORITY.map((kind, i) => `      WHEN '${kind}' THEN ${i}`).join("\n")}
      ELSE ${FUEL_KIND_PRIORITY.length}
    END`;

/**
 * The glanceable / prompt-facing ranked projection (FUEL-03). SELECTs the same 8
 * FuelItem columns but — UNLIKE `listFuelForEditor` — EXCLUDES three classes of
 * row IN THE QUERY (never a UI `.filter()`, which could be refactored away):
 *
 *   1. `kind != 'off_limits'` — private notes never reach a glanceable surface
 *      (T-07-02). This is the structural access control.
 *   2. `source != 'ai'` — an unconfirmed AI proposal never lands on a glance line
 *      reading as fact, nor feeds back into a prompt (T-07-03). Plan 03's confirm
 *      flips 'ai' → 'manual', after which the row ranks normally.
 *   3. non-blank text — `NULLIF(TRIM(text, <ws>), '') IS NOT NULL` drops a
 *      NULL/blank/whitespace-only row so it cannot top the ranking and render an
 *      EMPTY promoted strip (review MEDIUM-3). `fuel.text` is NULLable and Plan 01
 *      stores it NULL when blank. The `<ws>` set matches JS `String.trim()` beyond
 *      ASCII space/tab/LF/CR — it ALSO strips vertical-tab (11), form-feed (12),
 *      and NBSP (160) (review MEDIUM-2), so a whitespace-only row written by a
 *      non-UI path (seeded / imported / a confirmed AI row that never hit the UI's
 *      `String.trim()` boundary) can't survive here, top the ranking, and then
 *      render blank in `RankedFuelLine` (which trims with the wider JS set).
 *
 * Ordered by kind priority (RANK_CASE) then created_at DESC then id DESC, so
 * `rows[0]` is ALWAYS a usable, non-empty single ranked line. `contact_id` is the
 * sole `?`-bound value. Returns `[]` for a contact with no eligible fuel. Pure
 * read — no transaction.
 */

/**
 * The three glanceable-projection exclusion predicates, as ONE reusable SQL
 * fragment over the bare `kind` / `source` / `text` columns of a single `fuel`
 * table (or a subquery selecting from `fuel` with no alias):
 *
 *   1. `kind != 'off_limits'`  — private notes never reach a glanceable surface.
 *   2. `source != 'ai'`        — an unconfirmed AI proposal never reads as fact.
 *   3. non-blank text          — the extended-charset TRIM/NULLIF drop of a
 *      NULL/blank/whitespace-only row (VT 11, FF 12, NBSP 160 included), so a
 *      blank row cannot top the ranking and render an empty strip.
 *
 * Reused by dashboard-read.ts (Phase 8) — the single source for the card fuel
 * line + search exclusions. `RANKED_FUEL` below interpolates this constant so
 * getRankedFuel and every dashboard reuse are LITERALLY the same predicate text
 * (a parity test in fuel-read.test.ts guards against drift). Bare column names
 * (no table prefix) keep it splice-able into any single-fuel-table subquery.
 */
export const RANKED_FUEL_EXCLUSIONS = `kind != 'off_limits'
     AND source != 'ai'
     AND NULLIF(TRIM(text, char(9) || char(10) || char(11) || char(12) || char(13) || char(160) || ' '), '') IS NOT NULL`;

const RANKED_FUEL = `SELECT id, contact_id, kind, label, text, url, created_at, source
    FROM fuel
   WHERE contact_id = ?
     AND ${RANKED_FUEL_EXCLUSIONS}
   ORDER BY ${RANK_CASE}, created_at DESC, id DESC`;

/**
 * Read a contact's ranked fuel projection — the ONE line every glanceable surface
 * (card / notification / widget / compose / AI prompt) reuses. off_limits,
 * unconfirmed source='ai', and blank/NULL text are excluded IN-QUERY (see
 * `RANKED_FUEL`); `rows[0]` is the promoted top line. Pure read — no transaction.
 */
export function getRankedFuel(
  exec: SqlExecutor,
  contactId: number,
): Promise<FuelItem[]> {
  return exec.getAllAsync<FuelItem>(RANKED_FUEL, [contactId]);
}

/**
 * Escape a raw search term's LIKE metacharacters so `%` and `_` match ONLY a
 * row that literally contains that character — a `?`-bind stops SQL injection
 * but does NOT make `%`/`_` literal, so this escape + `ESCAPE '\'` is what makes
 * a term like "50%" a literal search rather than a glob (T-07-04).
 *
 * ORDER MATTERS: escape the backslash FIRST (it is the escape char), THEN `%`
 * and `_` — otherwise the backslashes we add for `%`/`_` would be re-escaped.
 *
 * Reused by dashboard-read.ts (Phase 8) — the single LIKE escaper for the
 * dashboard search term (exported so the card search escapes identically).
 */
export function escapeLike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
