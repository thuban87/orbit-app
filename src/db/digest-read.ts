/**
 * Digest read chokepoint (DGST-02 / DGST-03): the READ-ONLY retrospective
 * ("reached this week") and gentle "effortful" line queries. Pure READ-ONLY: no
 * transaction, no writer, no migration, no network; async `getAllAsync` /
 * `getFirstAsync` only (NEVER the sync variants). On-device SQLite; local-first.
 *
 * The Digest's Overlooked section is no longer read here. Since 38.13 D-61 it is
 * everyone needing attention minus Up Next, derived in DigestScreen from
 * `readUpNextCandidates` (up-next-read.ts, NEEDS_ATTENTION_WHERE). The former
 * rogue-only read and its Drifting / Gone-quiet split were retired with it
 * (D-61, D-68).
 *
 * =============================================================================
 * IT RE-USES, NEVER RE-DERIVES the trailing-window modifier: `windowModifier`
 * from `digest-logic.ts`, built from an INTEGER tunable, the only thing
 * interpolated into these queries, and it can carry no user free-text.
 *
 * TIMEZONE (matches status.ts / dashboard-read.ts): only `now` is converted to
 * local (`date('now','localtime', …)`); a STORED column (`occurred_at`,
 * `last_contact`) is already local wall-clock and is truncated with a BARE
 * `date(col)` — never re-run through 'localtime', which would shift a late-night
 * value a calendar day early. Never `toISOString().split` (the documented,
 * once-fixed UTC off-by-one; dates.ts).
 *
 * INJECTION (T-15-01): every query is a static string; the ONLY interpolated
 * value is a closed code-constant (the integer-derived window modifier). There
 * is no user free-text in any digest read, matching the status.ts /
 * dashboard-read.ts injection posture.
 * =============================================================================
 */
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
