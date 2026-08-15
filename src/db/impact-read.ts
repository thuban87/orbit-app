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
 * but has no touchpoints (never throws). Two read-only `?`-bound SELECTs, no
 * transaction.
 */
export async function getImpactInputs(
  exec: SqlExecutor,
  contactId: number,
): Promise<ImpactInputs | null> {
  const contact = await exec.getFirstAsync<{
    interval_days: number;
    rarely_responds: number;
  }>("SELECT interval_days, rarely_responds FROM contacts WHERE id = ?", [
    contactId,
  ]);
  if (!contact) {
    return null;
  }

  const rows = await exec.getAllAsync<{
    occurred_at: string;
    connected: number;
    direction: string | null;
  }>(
    `SELECT occurred_at, connected, direction
       FROM interactions
      WHERE contact_id = ?
      ORDER BY occurred_at DESC, id DESC`,
    [contactId],
  );

  return {
    intervalDays: contact.interval_days,
    rarelyResponds: contact.rarely_responds,
    interactions: rows.map((r) => ({
      occurredAt: r.occurred_at,
      connected: r.connected,
      direction: r.direction,
    })),
  };
}
