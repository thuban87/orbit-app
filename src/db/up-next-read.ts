/**
 * Read-only Up Next candidate query for Digest.
 *
 * Status, progress, and reason come from the canonical query-time engine. The
 * population is non-archived contacts matching NEEDS_ATTENTION_WHERE, the one
 * needs-attention predicate the Dashboard filter also reads (38.13 D-61;
 * RESEARCH Pattern 10): the status cadence precondition (so Unbound people are
 * never included), progress at or beyond STABLE_MAX, and no active snooze. The
 * Digest's Up Next takes the first three rows and Overlooked is the rest
 * (`dedupOverlooked` in DigestScreen), so section and drill agree. Static SQL
 * only; async on-device SQLite only; no writer, migration, or network path.
 */
import {
  NEEDS_ATTENTION_WHERE,
  PROGRESS_SQL,
  REASON_SQL,
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
       AND ${NEEDS_ATTENTION_WHERE}
     ORDER BY progress DESC, c.name COLLATE NOCASE, c.id`,
  );
}
