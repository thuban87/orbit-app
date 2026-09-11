/**
 * Digest read chokepoint (DGST-02 / DGST-03) — the three READ-ONLY queries
 * behind the weekly "your week" screen: the retrospective ("reached this week"),
 * the overlooked (rogue split Drifting / Gone quiet), and the gentle "effortful"
 * line. Pure READ-ONLY: no transaction, no writer, no migration, no network —
 * async `getAllAsync` / `getFirstAsync` only (NEVER the sync variants).
 * On-device SQLite; local-first. The backlog count is NOT re-derived here — the
 * screen reuses `countNeverContacted` (dashboard-read.ts) verbatim.
 *
 * =============================================================================
 * IT RE-USES, NEVER RE-DERIVES:
 *   - status / progress / rogue reason: the CASE-wrapped `PROGRESS_SQL` /
 *     `STATUS_SQL` / `REASON_SQL` fragments from `status.ts` (the query-time
 *     engine — DERIVED-NEVER-STORED). Rogue is READ via the shared constant,
 *     never a second threshold (CLAUDE.md single-shared-rogue-constant rule).
 *   - the trailing-window modifier: `windowModifier` from `digest-logic.ts`,
 *     built from an INTEGER tunable — the only thing interpolated into these
 *     queries beyond the status fragments, and it can carry no user free-text.
 *
 * OVERLOOKED IS THE INVERSE OF DECAY-SUPPRESSION: it deliberately does NOT reuse
 * `DECAY_ELIGIBLE_WHERE` / the notification-read layer, which excludes rogue,
 * rarely_responds, muted, and never-contacted — exactly the populations this
 * section surfaces (RESEARCH Pitfall 3). It queries `STATUS_SQL = 'rogue'`
 * directly, OMITS the `reminders_off` mute filter (a muted rogue still appears —
 * mute governs decay PUSHES only), and pre-filters `last_contact IS NOT NULL`
 * (STATUS_SQL has no NULL branch — status.ts:52-57 — so a NULL would falsely
 * read 'stable'). Drifting vs Gone quiet is split by REASON in digest-logic.ts,
 * never by the raw progress value.
 *
 * TIMEZONE (matches status.ts / dashboard-read.ts): only `now` is converted to
 * local (`date('now','localtime', …)`); a STORED column (`occurred_at`,
 * `last_contact`) is already local wall-clock and is truncated with a BARE
 * `date(col)` — never re-run through 'localtime', which would shift a late-night
 * value a calendar day early. Never `toISOString().split` (the documented,
 * once-fixed UTC off-by-one; dates.ts).
 *
 * INJECTION (T-15-01): every query is a static string; the ONLY interpolated
 * values are closed code-constants (the status/reason fragments and the
 * integer-derived window modifier). There is no user free-text in any digest
 * read — matching the status.ts / dashboard-read.ts injection posture.
 * =============================================================================
 */
import { PROGRESS_SQL, REASON_SQL, STATUS_SQL } from "@/db/status";
import type { SqlExecutor } from "@/db/types";
import {
  EFFORTFUL_WINDOW_DAYS,
  RETROSPECTIVE_WINDOW_DAYS,
  windowModifier,
} from "@/logic/digest-logic";

/** One retrospective row — a person reached in the window + their latest touch. */
export interface RetrospectiveRow {
  id: number;
  name: string;
  photo: string | null;
  /** MAX(occurred_at) — the stored local wall-clock of the most-recent touch. */
  last_reached: string;
}

/** One overlooked (rogue) row — reason drives the Drifting / Gone-quiet split. */
export interface OverlookedRow {
  id: number;
  name: string;
  photo: string | null;
  rarely_responds: number;
  progress: number;
  status: string;
  /** 'overdue' (Drifting) | 'unresponsive' (Gone quiet) — never null for a rogue row. */
  reason: string | null;
}

/** The gentle-line tally + the distinct people with a hard mark in the window. */
export interface GentleLine {
  hard: number;
  total: number;
  people: { id: number; name: string }[];
}

/**
 * "Reached this week" — one row per NON-archived contact with ANY interaction in
 * the trailing inclusive window (no `connected` / `direction` predicate: an
 * inbound, an unconnected attempt, and a one-tap widget mark all count),
 * collapsed to their most-recent touch and ordered most-recent-first. The
 * "day reached" tag is derived in digest-logic.ts, not in SQL.
 */
export function readRetrospective(
  exec: SqlExecutor,
): Promise<RetrospectiveRow[]> {
  const sql = `SELECT c.id AS id,
    c.name AS name,
    c.photo AS photo,
    MAX(i.occurred_at) AS last_reached
   FROM interactions i
   JOIN contacts c ON c.id = i.contact_id
  WHERE c.archived_at IS NULL
    AND date(i.occurred_at) >= date('now','localtime','${windowModifier(RETROSPECTIVE_WINDOW_DAYS)}')
  GROUP BY c.id
  ORDER BY last_reached DESC, c.name COLLATE NOCASE, c.id`;
  return exec.getAllAsync<RetrospectiveRow>(sql);
}

/**
 * "The overlooked" — non-archived, contacted contacts that have gone rogue, with
 * the mute filter DELIBERATELY omitted. `last_contact IS NOT NULL` is
 * load-bearing (it is what makes STATUS_SQL safe over a possible NULL). Ordered
 * most-slipped first; the Drifting / Gone-quiet split is by `reason` in
 * digest-logic.ts.
 */
export function readOverlooked(exec: SqlExecutor): Promise<OverlookedRow[]> {
  const sql = `SELECT c.id AS id,
    c.name AS name,
    c.photo AS photo,
    c.rarely_responds AS rarely_responds,
    (${PROGRESS_SQL}) AS progress,
    (${STATUS_SQL}) AS status,
    (${REASON_SQL}) AS reason
   FROM contacts c
  WHERE c.archived_at IS NULL
    AND c.tracking_enabled = 1
    AND c.last_contact IS NOT NULL
    AND (${STATUS_SQL}) = 'rogue'
  ORDER BY progress DESC, c.name COLLATE NOCASE, c.id`;
  return exec.getAllAsync<OverlookedRow>(sql);
}

/** One raw quality-mark row for the gentle-line tally. */
interface QualityMarkRow {
  contact_id: number;
  name: string;
  quality: string;
}

/**
 * The gentle "effortful" line source — recent `interactions.quality` marks over
 * the (deliberately wider) effortful window, archived excluded, `quality NOT
 * NULL`. Returns the `hard` count (Negative marks), the `total` of
 * Positive/Neutral/Negative marks (the migrated Tone vocabulary, D-06), and the
 * distinct people (name-ordered) with at least one Negative mark. The SHOW
 * decision is left to `shouldShowEffortful` in the screen (this read stays
 * neutral). Tally idiom mirrors ai-context-read.ts.
 */
export async function readGentleLine(exec: SqlExecutor): Promise<GentleLine> {
  const rows = await exec.getAllAsync<QualityMarkRow>(
    `SELECT i.contact_id AS contact_id,
       c.name AS name,
       i.quality AS quality
     FROM interactions i
     JOIN contacts c ON c.id = i.contact_id
    WHERE c.archived_at IS NULL
      AND i.quality IS NOT NULL
      AND date(i.occurred_at) >= date('now','localtime','${windowModifier(EFFORTFUL_WINDOW_DAYS)}')
    ORDER BY c.name COLLATE NOCASE, i.contact_id`,
  );

  // Tally over the migrated Tone vocabulary (D-06): Positive/Neutral/Negative
  // replace good/fine/hard. Negative is the effortful ("hard") case. Comparing
  // the stale literals here would silently zero the gentle line after 025 lands.
  let hard = 0;
  let total = 0;
  const peopleById = new Map<number, string>();
  for (const r of rows) {
    if (
      r.quality === "Positive" ||
      r.quality === "Neutral" ||
      r.quality === "Negative"
    ) {
      total += 1;
    }
    if (r.quality === "Negative") {
      hard += 1;
      if (!peopleById.has(r.contact_id)) {
        peopleById.set(r.contact_id, r.name);
      }
    }
  }

  const people = [...peopleById.entries()].map(([id, name]) => ({ id, name }));
  return { hard, total, people };
}
