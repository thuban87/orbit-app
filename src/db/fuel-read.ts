/**
 * Conversational-fuel read module (FUEL-01/FUEL-02) — the SINGLE shared,
 * user-facing / projection fuel read choke point. A pure, read-only SELECT: NO
 * transaction, every value `?`-bound, no network — and only static column names
 * are literal text (T-07-01). Modelled on `timeline-read.ts`.
 *
 * =============================================================================
 * LOAD-BEARING READ-PATH RULES — READ BEFORE ADDING A READER:
 *   1. This file is the ONLY user-facing / projection fuel read path. Every
 *      projection added later (getRankedFuel, Plan 02; searchFuel, Plan 04) lands
 *      HERE. purge-dao's MAINTENANCE reads — the impact count at `purge-dao.ts:105`
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
 */
const RANK_CASE = `CASE kind
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
 *      stores it NULL when blank.
 *
 * Ordered by kind priority (RANK_CASE) then created_at DESC then id DESC, so
 * `rows[0]` is ALWAYS a usable, non-empty single ranked line. `contact_id` is the
 * sole `?`-bound value. Returns `[]` for a contact with no eligible fuel. Pure
 * read — no transaction.
 */
const RANKED_FUEL = `SELECT id, contact_id, kind, label, text, url, created_at, source
    FROM fuel
   WHERE contact_id = ?
     AND kind != 'off_limits'
     AND source != 'ai'
     AND NULLIF(TRIM(text, char(9) || char(10) || char(13) || ' '), '') IS NOT NULL
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

/** One cross-contact search hit: a matching contact + one matching snippet. */
export interface FuelSearchResult {
  contactId: number;
  name: string;
  /** A matching non-off_limits, non-'ai' fuel text, or null on a name-only match. */
  snippet: string | null;
}

/**
 * Escape a raw search term's LIKE metacharacters so `%` and `_` match ONLY a
 * row that literally contains that character — a `?`-bind stops SQL injection
 * but does NOT make `%`/`_` literal, so this escape + `ESCAPE '\'` is what makes
 * a term like "50%" a literal search rather than a glob (T-07-04).
 *
 * ORDER MATTERS: escape the backslash FIRST (it is the escape char), THEN `%`
 * and `_` — otherwise the backslashes we add for `%`/`_` would be re-escaped.
 */
function escapeLike(term: string): string {
  return term
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Cross-contact fuel search (FUEL-05). A contact matches when its `name` LIKE
 * %term% OR it has a non-off_limits, non-'ai' fuel row whose `text` LIKE %term%;
 * `snippet` is one such matching fuel text (NULL when the match was on name
 * only). One row per matching contact, ordered by `name`.
 *
 * COHERENCE WITH getRankedFuel (Addresses review HIGH-1): search excludes BOTH
 * off_limits AND unconfirmed source='ai', exactly mirroring `getRankedFuel`'s
 * exclusions — FUEL-05 mandates only off_limits, so the AI exclusion is a safe
 * SUPERSET that keeps an unconfirmed AI proposal a profile-only concept until
 * Plan 03's confirm flips 'ai' → 'manual', after which the row becomes
 * searchable. The two exclusions live IN THE QUERY (both the snippet subquery
 * AND the EXISTS predicate), never as a UI `.filter()` that could be refactored
 * away — the "off_limits never surfaces at a glance" guarantee is structural.
 *
 * ASCII-only case folding is EXPECTED, not a bug: SQLite's built-in LIKE folds
 * only ASCII (ICU is absent — dossier Cluster F). Do NOT "fix" it.
 *
 * SECURITY: the term is `?`-bound AND its LIKE metacharacters are escaped, with
 * `LIKE ? ESCAPE '\'` on ALL THREE predicates (name, snippet subquery, EXISTS)
 * — binding alone does not make `%`/`_` literal (T-07-04). The query is a static
 * string; no identifier or value is interpolated. Archived contacts
 * (`archived_at IS NOT NULL`) are excluded. Pure read — no transaction, no
 * network. An empty/whitespace term returns `[]` before querying.
 */
const SEARCH_FUEL = `SELECT c.id AS contactId,
         c.name AS name,
         (SELECT f.text
            FROM fuel f
           WHERE f.contact_id = c.id
             AND f.kind != 'off_limits'
             AND f.source != 'ai'
             AND f.text LIKE ? ESCAPE '\\'
           LIMIT 1) AS snippet
    FROM contacts c
   WHERE c.archived_at IS NULL
     AND (
       c.name LIKE ? ESCAPE '\\'
       OR EXISTS (SELECT 1
                    FROM fuel f2
                   WHERE f2.contact_id = c.id
                     AND f2.kind != 'off_limits'
                     AND f2.source != 'ai'
                     AND f2.text LIKE ? ESCAPE '\\')
     )
   ORDER BY c.name`;

export function searchFuel(
  exec: SqlExecutor,
  term: string,
): Promise<FuelSearchResult[]> {
  if (term.trim() === "") return Promise.resolve([]);
  const like = `%${escapeLike(term)}%`;
  return exec.getAllAsync<FuelSearchResult>(SEARCH_FUEL, [like, like, like]);
}
