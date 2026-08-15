/**
 * Shared impact-inputs read (LOG-03) — the SINGLE read that feeds BOTH derived
 * quantities on the profile: gravity (Plan 06-05) and intensity (Plan 06-06).
 * Reading once means both see the SAME interaction rows, so they can never
 * disagree about the contact's touchpoint history.
 *
 * Read-only (NO transaction); every value `?`-bound, no string interpolation
 * (T-06-04). No `react-native`/`expo` import — node-pure over `exec:
 * SqlExecutor`, node-unit-tested (`impact-read.test.ts`). No write statement:
 * gravity and intensity are DERIVED-NEVER-STORED, so nothing here mutates.
 * On the read path there is NO network (local-first, CLAUDE.md).
 */

import type { SqlExecutor } from "@/db/types";

/**
 * The rows both derived quantities consume. `intervalDays` / `rarelyResponds`
 * come from the `contacts` row; `interactions` is the contact's touchpoint
 * history (newest-first). `occurredAt` is the stored local wall-clock
 * `YYYY-MM-DD HH:MM:SS` string (DATA-05) — the pure math parses it with local
 * components, never `toISOString`.
 */
export interface ImpactInputs {
  intervalDays: number;
  rarelyResponds: number;
  interactions: {
    occurredAt: string;
    connected: number;
    direction: string | null;
  }[];
}

/**
 * Load the impact inputs for one contact: the `contacts` row's `interval_days`
 * + `rarely_responds`, and every interaction row (`occurred_at` / `connected` /
 * `direction`) ordered `occurred_at DESC, id DESC` for a deterministic order
 * (the id tiebreak makes identical-timestamp rows stable). Returns null when the
 * contact row is missing; an empty interactions array when the contact exists
 * but has no touchpoints (never throws).
 *
 * MED-2 SINGLE-SNAPSHOT: policy (interval_days / rarely_responds) and the
 * interaction history are read in ONE `?`-bound `LEFT JOIN` statement, not two
 * un-transactioned SELECTs. A concurrent write (a touchpoint insert, or an
 * `updateContactFull` flipping `rarely_responds`) committing BETWEEN two separate
 * reads would otherwise yield a mixed-state input set until the next refresh;
 * one statement guarantees gravity and intensity see a consistent snapshot. Still
 * read-only — no write, no transaction; the `LEFT JOIN` preserves the "contact
 * exists but has no interactions" case as a single row whose interaction columns
 * are NULL (filtered out below), distinct from a missing contact (zero rows).
 */
export async function getImpactInputs(
  exec: SqlExecutor,
  contactId: number,
): Promise<ImpactInputs | null> {
  const rows = await exec.getAllAsync<{
    interval_days: number;
    rarely_responds: number;
    occurred_at: string | null;
    connected: number | null;
    direction: string | null;
  }>(
    `SELECT c.interval_days, c.rarely_responds,
            i.occurred_at, i.connected, i.direction
       FROM contacts c
       LEFT JOIN interactions i ON i.contact_id = c.id
      WHERE c.id = ?
      ORDER BY i.occurred_at DESC, i.id DESC`,
    [contactId],
  );

  // Zero rows → no such contact. One-or-more rows → the contact exists; a lone
  // row with a NULL occurred_at is the no-interactions case (LEFT JOIN filler).
  if (rows.length === 0) {
    return null;
  }

  return {
    intervalDays: rows[0].interval_days,
    rarelyResponds: rows[0].rarely_responds,
    interactions: rows
      .filter((r) => r.occurred_at !== null)
      .map((r) => ({
        occurredAt: r.occurred_at as string,
        connected: r.connected as number,
        direction: r.direction,
      })),
  };
}
