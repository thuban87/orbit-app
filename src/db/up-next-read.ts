/**
 * Read-only Up Next candidate query for Digest.
 *
 * Status, progress, and reason come from the canonical query-time engine. The
 * population boundary exactly matches Dashboard's needs-attention filter:
 * progress at or beyond STABLE_MAX with active snoozes excluded. Static SQL
 * only; async on-device SQLite only; no writer, migration, or network path.
 */
import {
  PROGRESS_SQL,
  REASON_SQL,
  STABLE_MAX,
  STATUS_CADENCE_PRECONDITION,
  STATUS_SQL,
} from "@/db/status";
import type { SqlExecutor } from "@/db/types";

export interface UpNextCandidateRow {
  id: number;
  name: string;
  photo: string | null;
  progress: number;
  status: "stable" | "wobble" | "decay" | "rogue";
  reason: "overdue" | "unresponsive" | null;
}

export function readUpNextCandidates(
  exec: SqlExecutor,
): Promise<UpNextCandidateRow[]> {
  return exec.getAllAsync<UpNextCandidateRow>(
    `SELECT c.id AS id,
      c.name AS name,
      c.photo AS photo,
      (${PROGRESS_SQL}) AS progress,
      (${STATUS_SQL}) AS status,
      (${REASON_SQL}) AS reason
     FROM contacts c
     WHERE c.archived_at IS NULL
       AND ${STATUS_CADENCE_PRECONDITION}
       AND (${PROGRESS_SQL}) >= ${STABLE_MAX}
       AND (c.snooze_until IS NULL OR date(c.snooze_until) <= date('now','localtime'))
     ORDER BY progress DESC, c.name COLLATE NOCASE, c.id`,
  );
}
