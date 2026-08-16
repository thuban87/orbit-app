/**
 * Dashboard read chokepoint (DASH-01/02/04/07) — the SINGLE parametrized card
 * read behind the home screen list, the never-contacted screen, the search box,
 * the birthday banner, and every population count. Pure READ-ONLY: no
 * transaction, no writer, no migration, no network — async `getAllAsync` /
 * `getFirstAsync` only (NEVER the sync variants). On-device SQLite; local-first.
 *
 * =============================================================================
 * IT RE-USES, NEVER RE-DERIVES:
 *   - status/progress: the CASE-wrapped `PROGRESS_SQL` / `STATUS_SQL` fragments
 *     from `status.ts` (the query-time engine — DERIVED-NEVER-STORED).
 *   - the ranked card fuel line: `RANKED_FUEL_EXCLUSIONS` + `RANK_CASE` from
 *     `fuel-read.ts` (Phase 8 Task 1 export), so the card's fuel line is the SAME
 *     row `getRankedFuel(contact)[0]` promotes — a parity test guards this.
 *   - the search escaper: `escapeLike` from `fuel-read.ts`.
 *   Thresholds, the fuel RANK_CASE, the exclusions, and the LIKE escaper are
 *   never re-typed here — importing them is what stops drift.
 *
 * HIGH-1 (never-contacted status): STATUS_SQL has NO NULL branch — over a NULL
 * `last_contact` every comparison is false → its ELSE buckets the row as the
 * literal 'stable' (status.ts:67-73). Every card projection here therefore wraps
 * status/progress in `CASE WHEN c.last_contact IS NULL THEN NULL ELSE (…) END`
 * (or selects literal `NULL` in listNeverContacted), so a never-contacted row —
 * surfaced by listNeverContacted, the favourites archived-only relaxation, or the
 * term-widened search — always reads status=null / progress=null, never 'stable'.
 * This mirrors the getContactStatus guard (contact-status-read.ts:70-80).
 *
 * TIMEZONE (matches status.ts): only `now` is converted to local
 * (`date('now','localtime')`); a STORED column (`last_contact`, `snooze_until`)
 * is already local wall-clock and is truncated with a BARE `date(col)` — never
 * re-run through 'localtime', which would shift a late-night value a day early.
 *
 * SNOOZE STORAGE CONTRACT (for Phase 11's future writer): `snooze_until` must be
 * written as a local `YYYY-MM-DD` (or `YYYY-MM-DD HH:MM:SS`) string comparable via
 * bare `date()`. The snoozed count + the 'snoozed' filter segment are LEGITIMATELY
 * empty until Phase 11 ships that writer — this is not a bug.
 *
 * SEARCH SCOPE (FLAGGED owner decision A3): when a term is present the
 * never-contacted + snooze exclusions RELAX to archived-only, so search finds
 * anyone non-archived (incl. never-contacted people saved via capture). The
 * default (no-term) list keeps the full exclusion.
 *
 * INJECTION (T-08-01/02): every query is a static string; the ONLY interpolated
 * values are closed code-constants (the status/threshold fragments, the fuel
 * fragments, and the closed category/battery/filter identifiers). EVERY runtime
 * value — the category id, the battery value, the escaped search term — is
 * `?`-bound. off_limits / unconfirmed source='ai' / blank fuel are excluded
 * IN-QUERY (RANKED_FUEL_EXCLUSIONS) for the card line, the snippet, AND the
 * search EXISTS predicate — never a UI `.filter()`. Archived is excluded
 * structurally in every population.
 * =============================================================================
 */
import type { ProfileStatus } from "@/db/contact-status-read";
import { escapeLike, RANK_CASE, RANKED_FUEL_EXCLUSIONS } from "@/db/fuel-read";
import { PROGRESS_SQL, STABLE_MAX, STATUS_SQL } from "@/db/status";
import type { SqlExecutor } from "@/db/types";

/** The dashboard filter chips — a closed set of code-constant identifiers. */
export type DashboardFilter =
  | "all"
  | "needs-attention"
  | "favourites"
  | "snoozed"
  | `category-${number}`
  | `battery-${string}`;

/** The dashboard sort modes. */
export type DashboardSort = "status" | "name" | "least-recent" | "most-recent";

/** The never-contacted screen's own sort modes. */
export type NeverContactedSort = "oldest" | "newest" | "name";

/**
 * One dashboard card row. `status` and `progress` are NULLABLE (per HIGH-1 they
 * are null for a never-contacted row) — declared `ProfileStatus | null` /
 * `number | null` (NOT bare) so the row type matches ContactCard's
 * `status: ProfileStatus | null` prop (08-04) and `tsc --noEmit` stays clean
 * without a cast (review MEDIUM-5).
 */
export interface DashboardRow {
  id: number;
  name: string;
  photo: string | null;
  modified_at: string;
  /** The category label via the LEFT JOIN, or null when uncategorised. */
  categoryLabel: string | null;
  favourite_rank: number | null;
  status: ProfileStatus | null;
  progress: number | null;
  /** The ranked top fuel line (== getRankedFuel[0].text), or null when none. */
  fuelText: string | null;
  /** A matching fuel snippet — non-null only when a term matched fuel text. */
  snippet: string | null;
}

/** A favourite row for the Manage-favourites reorder screen. */
export interface FavouriteRow {
  id: number;
  name: string;
  photo: string | null;
  modified_at: string;
  favourite_rank: number;
}

/** A birthday-banner candidate — non-archived contact with a birthday. */
export interface BirthdayCandidate {
  id: number;
  name: string;
  birthday: string;
}

/**
 * The ranked-fuel card-line subquery — reuses the fuel fragments verbatim so the
 * card line is the SAME row getRankedFuel promotes. Correlated on `c.id`; the
 * bare `text`/`kind`/`source`/`created_at`/`id` resolve to the inner `fuel` table.
 */
const FUEL_LINE = `(SELECT text
     FROM fuel
    WHERE contact_id = c.id
      AND ${RANKED_FUEL_EXCLUSIONS}
    ORDER BY ${RANK_CASE}, created_at DESC, id DESC
    LIMIT 1)`;

/**
 * The CASE-wrapped status/progress projection shared by ALL listDashboard
 * branches (HIGH-1). `cat.name` is aliased to `categoryLabel`; `c.name` is
 * qualified everywhere so the LEFT JOIN's `categories.name` can never shadow it.
 */
const CARD_STATUS = `CASE WHEN c.last_contact IS NULL THEN NULL ELSE (${PROGRESS_SQL}) END AS progress,
    CASE WHEN c.last_contact IS NULL THEN NULL ELSE (${STATUS_SQL}) END AS status`;

/** The FROM + LEFT JOIN common to the card reads. */
const CARD_FROM = `FROM contacts c
   LEFT JOIN categories cat ON cat.id = c.category_id`;

/**
 * The restrictive DEFAULT population: live, contacted, NOT currently snoozed.
 * `last_contact IS NOT NULL` is load-bearing (it is what makes STATUS_SQL safe —
 * see HIGH-1). The snooze clause uses a BARE `date(c.snooze_until)` vs
 * `date('now','localtime')`.
 */
const BASE_WHERE = `c.archived_at IS NULL
     AND c.last_contact IS NOT NULL
     AND (c.snooze_until IS NULL OR date(c.snooze_until) <= date('now','localtime'))`;

/** Sort clause per DashboardSort — each ends with the `c.name, c.id` tiebreak. */
const SORT: Record<DashboardSort, string> = {
  // A-1: model STATUS_SCAN's `ORDER BY progress DESC`; SQLite sorts a NULL
  // progress LAST in a DESC order, so a relaxation-surfaced never-contacted row
  // (null progress) lands deterministically at the end. Do NOT map a
  // status-STRING CASE — it has no NULL branch and would mis-bucket a null row.
  status: "progress DESC, c.name COLLATE NOCASE, c.id",
  name: "c.name COLLATE NOCASE, c.id",
  "least-recent": "c.last_contact ASC, c.name COLLATE NOCASE, c.id",
  "most-recent": "c.last_contact DESC, c.name COLLATE NOCASE, c.id",
};

/** Never-contacted sort clause per NeverContactedSort. */
const NC_SORT: Record<NeverContactedSort, string> = {
  oldest: "c.created_at ASC, c.id ASC",
  newest: "c.created_at DESC, c.id DESC",
  name: "c.name COLLATE NOCASE, c.id",
};

/**
 * The dashboard card list. Chooses its WHERE among FOUR MUTUALLY-EXCLUSIVE
 * population branches (NOT a fixed restrictive base + APPENDED filter predicate —
 * that construction is internally contradictory: appending `snooze_until > now`
 * onto a base requiring `snooze_until <= now` is always-empty, and appending
 * `favourite_rank IS NOT NULL` onto a base excluding never-contacted hides a
 * never-contacted favourite). All branches share the IDENTICAL card projection
 * (CASE-wrapped status/progress, the ranked fuel line, the term-only snippet) and
 * the `c.name COLLATE NOCASE, c.id` tiebreak; they differ only in WHERE and — for
 * favourites — the ORDER BY. Precedence:
 *
 *   1. term present  — HIGHEST (review LOW-2; wins even over filter='favourites').
 *                      Archived-only + name-OR-fuel EXISTS (A3 widening).
 *   2. favourites    — archived-only + favourite_rank IS NOT NULL, ordered
 *                      favourite_rank ASC (REVEALS never-contacted / snoozed favs).
 *   3. snoozed       — archived-only + FUTURE snooze_until (REVEALS the hidden
 *                      population; empty until Phase 11 writes snooze_until).
 *   4. default       — the restrictive BASE_WHERE, with needs-attention / category
 *                      / battery narrowing WITHIN it (never relaxing it).
 */
export function listDashboard(
  exec: SqlExecutor,
  opts: { filter: DashboardFilter; sort: DashboardSort; term?: string },
): Promise<DashboardRow[]> {
  const term = opts.term?.trim() ?? "";
  const hasTerm = term !== "";
  const params: unknown[] = [];

  // The snippet subquery renders WHENEVER an eligible fuel row matches the term,
  // INDEPENDENT of a concurrent name match (MEDIUM-6) — mirrors searchFuel. Its
  // `?` sits in the SELECT list, so its bind is pushed FIRST. On a name-only match
  // (no matching fuel) the subquery yields null.
  const snippet = hasTerm
    ? `(SELECT text FROM fuel WHERE contact_id = c.id AND ${RANKED_FUEL_EXCLUSIONS} AND text LIKE ? ESCAPE '\\' LIMIT 1)`
    : "NULL";

  const head = `SELECT c.id AS id,
    c.name AS name,
    c.photo AS photo,
    c.modified_at AS modified_at,
    cat.name AS categoryLabel,
    c.favourite_rank AS favourite_rank,
    ${CARD_STATUS},
    ${FUEL_LINE} AS fuelText,
    ${snippet} AS snippet
   ${CARD_FROM}`;

  let where: string;
  let orderBy: string;

  if (hasTerm) {
    // Branch 1 — term wins over everything. Relax to archived-only (A3).
    const like = `%${escapeLike(term)}%`;
    params.push(like); // snippet subquery (SELECT clause — appears first)
    where = `c.archived_at IS NULL
     AND (
       c.name LIKE ? ESCAPE '\\'
       OR EXISTS (SELECT 1 FROM fuel WHERE contact_id = c.id AND ${RANKED_FUEL_EXCLUSIONS} AND text LIKE ? ESCAPE '\\')
     )`;
    params.push(like, like); // name LIKE, then EXISTS text LIKE
    orderBy = SORT[opts.sort];
  } else if (opts.filter === "favourites") {
    // Branch 2 — archived-only relaxation: a never-contacted OR currently-snoozed
    // favourite is STILL shown (its status/progress read null via the CASE wrap).
    where = "c.archived_at IS NULL AND c.favourite_rank IS NOT NULL";
    orderBy = "c.favourite_rank ASC, c.name COLLATE NOCASE, c.id";
  } else if (opts.filter === "snoozed") {
    // Branch 3 — REVEAL the future-snoozed population the default hides.
    where =
      "c.archived_at IS NULL AND c.snooze_until IS NOT NULL AND date(c.snooze_until) > date('now','localtime')";
    orderBy = SORT[opts.sort];
  } else {
    // Branch 4 — the restrictive base, with a narrowing predicate ANDed WITHIN it.
    where = BASE_WHERE;
    if (opts.filter === "needs-attention") {
      // wobble/decay/rogue: progress past the stable ceiling.
      where += ` AND (${PROGRESS_SQL}) >= ${STABLE_MAX}`;
    } else if (opts.filter.startsWith("category-")) {
      where += " AND c.category_id = ?";
      params.push(Number(opts.filter.slice("category-".length)));
    } else if (opts.filter.startsWith("battery-")) {
      where += " AND c.social_battery = ?";
      params.push(opts.filter.slice("battery-".length));
    }
    // filter === 'all' adds no extra predicate.
    orderBy = SORT[opts.sort];
  }

  const sql = `${head}\n  WHERE ${where}\n  ORDER BY ${orderBy}`;
  return exec.getAllAsync<DashboardRow>(sql, params);
}

/**
 * The never-contacted inverse population (`archived_at IS NULL AND last_contact
 * IS NULL`). Selects LITERAL `NULL AS status, NULL AS progress` — NOT STATUS_SQL
 * over these rows, which would label every row 'stable' (HIGH-1). Same card
 * projection otherwise (category label + ranked fuel line); snippet is always
 * null (no search here).
 */
export function listNeverContacted(
  exec: SqlExecutor,
  opts: { sort: NeverContactedSort },
): Promise<DashboardRow[]> {
  const sql = `SELECT c.id AS id,
    c.name AS name,
    c.photo AS photo,
    c.modified_at AS modified_at,
    cat.name AS categoryLabel,
    c.favourite_rank AS favourite_rank,
    NULL AS progress,
    NULL AS status,
    ${FUEL_LINE} AS fuelText,
    NULL AS snippet
   ${CARD_FROM}
   WHERE c.archived_at IS NULL AND c.last_contact IS NULL
   ORDER BY ${NC_SORT[opts.sort]}`;
  return exec.getAllAsync<DashboardRow>(sql);
}

/**
 * All non-archived favourites, ordered `favourite_rank ASC` — the Manage-
 * favourites reorder screen source.
 */
export function listFavourites(exec: SqlExecutor): Promise<FavouriteRow[]> {
  return exec.getAllAsync<FavouriteRow>(
    `SELECT id, name, photo, modified_at, favourite_rank
       FROM contacts
      WHERE archived_at IS NULL AND favourite_rank IS NOT NULL
      ORDER BY favourite_rank ASC`,
  );
}

/** Count helper — a single-row COUNT(*). */
async function count(exec: SqlExecutor, where: string): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM contacts WHERE ${where}`,
  );
  return row?.n ?? 0;
}

/** Count of never-contacted (live) contacts — the never-contacted screen badge. */
export function countNeverContacted(exec: SqlExecutor): Promise<number> {
  return count(exec, "archived_at IS NULL AND last_contact IS NULL");
}

/**
 * Count of currently-snoozed contacts — legitimately 0 until Phase 11 writes
 * `snooze_until` (there is no writer yet).
 */
export function countSnoozed(exec: SqlExecutor): Promise<number> {
  return count(
    exec,
    "archived_at IS NULL AND snooze_until IS NOT NULL AND date(snooze_until) > date('now','localtime')",
  );
}

/** Count of archived contacts. */
export function countArchived(exec: SqlExecutor): Promise<number> {
  return count(exec, "archived_at IS NOT NULL");
}

/**
 * The live-CONTACTED total — the "{N} contacts" header source AND the Plan-07
 * first-run empty-state gate input. PINNED to `archived_at IS NULL AND
 * last_contact IS NOT NULL` (excludes never-contacted AND archived); HIGH-2.
 */
export function countLiveContacts(exec: SqlExecutor): Promise<number> {
  return count(exec, "archived_at IS NULL AND last_contact IS NOT NULL");
}

/** Non-archived contacts with a birthday — the birthday banner candidates. */
export function listBirthdayCandidates(
  exec: SqlExecutor,
): Promise<BirthdayCandidate[]> {
  return exec.getAllAsync<BirthdayCandidate>(
    `SELECT id, name, birthday
       FROM contacts
      WHERE archived_at IS NULL AND birthday IS NOT NULL`,
  );
}
