/**
 * Single-contact query-time status + reason read (LOG-05).
 *
 * DERIVED-NEVER-STORED, READ-ONLY: composes the PROGRESS_SQL / STATUS_SQL /
 * REASON_SQL fragments from `status.ts` into ONE by-id SELECT, so the profile's
 * status label reads the SAME computed number the dashboard scan does — never a
 * persisted column. No transaction (pure read). The sole runtime value,
 * `contactId`, is `?`-bound; only the threshold code-constants inside the SQL
 * fragments are interpolated (never user input). No network — on-device SQLite.
 *
 * These are QUERY-TIME types, NOT the legacy `src/types.ts OrbitStatus`
 * (stable|wobble|decay|snoozed — it excludes rogue and predates the rogue
 * threshold). `calculateStatus()` is likewise NOT used here; status comes from the
 * SQL engine so the profile and the dashboard can never diverge.
 */
import { PROGRESS_SQL, REASON_SQL, STATUS_SQL } from "@/db/status";
import type { SqlExecutor } from "@/db/types";

/** The four query-time status buckets, INCLUDING rogue (unlike OrbitStatus). */
export type ProfileStatus = "stable" | "wobble" | "decay" | "rogue";

/** Why a contact is rogue, or null when it is not rogue. */
export type RogueReason = "unresponsive" | "overdue" | null;

/** The assembled by-id status read. `null` for a missing contact id. */
export interface ContactStatusRow {
  status: ProfileStatus | null;
  reason: RogueReason;
  progress: number | null;
  rarely_responds: number;
  last_contact: string | null;
}

/** The raw SELECT shape before the NULL guard is applied. */
interface RawRow {
  status: ProfileStatus;
  reason: RogueReason;
  progress: number | null;
  rarely_responds: number;
  last_contact: string | null;
}

/**
 * Read a single contact's query-time status + rogue reason by id.
 *
 * Returns `null` for a missing id. For a NEVER-CONTACTED contact
 * (`last_contact IS NULL`) status/reason/progress are forced to `null`: a by-id
 * seek has no `last_contact IS NOT NULL` pre-filter (unlike STATUS_SCAN in
 * queries.ts), and STATUS_SQL alone would bucket a NULL row as 'stable' (every
 * comparison against NULL is false → ELSE). The guard lives here so no caller can
 * mislabel a never-contacted contact as stable.
 */
export async function getContactStatus(
  exec: SqlExecutor,
  contactId: number,
): Promise<ContactStatusRow | null> {
  const row = await exec.getFirstAsync<RawRow>(
    `SELECT rarely_responds,
            last_contact,
            (${PROGRESS_SQL}) AS progress,
            (${STATUS_SQL}) AS status,
            (${REASON_SQL}) AS reason
       FROM contacts
      WHERE id = ?`,
    [contactId],
  );
  if (!row) {
    return null;
  }
  // Never-contacted guard: STATUS_SQL would bucket a NULL last_contact as
  // 'stable', so force the whole derived triple to null here.
  if (row.last_contact === null) {
    return {
      status: null,
      reason: null,
      progress: null,
      rarely_responds: row.rarely_responds,
      last_contact: null,
    };
  }
  return {
    status: row.status,
    reason: row.reason,
    progress: row.progress,
    rarely_responds: row.rarely_responds,
    last_contact: row.last_contact,
  };
}
