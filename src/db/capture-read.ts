/**
 * Capture picker read (CAP-01) — the SINGLE parametrized read behind the
 * share-sheet contact picker. Pure READ-ONLY: no transaction, no writer, no
 * migration, no network — async `getAllAsync` only (NEVER the sync variants).
 * On-device SQLite; local-first. Mirrors the `dashboard-read.ts` chokepoint idiom.
 *
 * =============================================================================
 * PICKER SCOPE (D-CAP picker-scope decision, CAP-01):
 *   `WHERE c.archived_at IS NULL` ONLY. This deliberately does NOT inherit
 *   dashboard-read's BASE_WHERE (which carries `last_contact IS NOT NULL`) — the
 *   picker must surface NEVER-CONTACTED people too, because capture is the fast
 *   path for stashing a link onto someone you have never logged an interaction
 *   with. Never add `last_contact IS NOT NULL` here, and never import BASE_WHERE.
 *
 * CAPTURE-MRU ordering is DERIVED, not stored: a LEFT JOIN onto
 *   `(SELECT contact_id, MAX(created_at) FROM fuel GROUP BY contact_id)` yields
 *   each contact's most-recent fuel stamp. There is NO new column, NO migration,
 *   and NO index — the MRU reads the EXISTING `fuel.created_at`. Order is
 *   favourites (rank present) → capture-MRU DESC (has any fuel) → the rest,
 *   stable by name COLLATE NOCASE.
 *
 * CONCURRENCY (RESEARCH Q4): this read takes NO mutex and opens NO transaction,
 *   which is safe alongside the concurrent launch sweep because it reads
 *   `contacts` / `fuel` (not `contact_custom_values`, the sweep's target).
 *
 * INJECTION: the query is a single static string with no interpolated values.
 * =============================================================================
 */
import type { SqlExecutor } from "@/db/types";

/**
 * One row of the capture picker grid. `last_captured` is the contact's most
 * recent `fuel.created_at` (NULL when never captured) and drives the MRU band;
 * `modified_at` is the Avatar `cacheBust` key.
 */
export interface CapturePickRow {
  id: number;
  name: string;
  photo: string | null;
  modified_at: string;
  favourite_rank: number | null;
  last_captured: string | null;
}

/**
 * List every non-archived contact for the capture picker, ordered
 * favourites → capture-MRU → rest. Includes never-contacted people; excludes
 * archived. Single async `getAllAsync`, no transaction, no mutex, no migration.
 */
export function listCapturePickContacts(
  exec: SqlExecutor,
): Promise<CapturePickRow[]> {
  return exec.getAllAsync<CapturePickRow>(
    `SELECT c.id AS id,
            c.name AS name,
            c.photo AS photo,
            c.modified_at AS modified_at,
            c.favourite_rank AS favourite_rank,
            m.last_captured AS last_captured
       FROM contacts c
       LEFT JOIN (SELECT contact_id, MAX(created_at) AS last_captured
                    FROM fuel
                   GROUP BY contact_id) m ON m.contact_id = c.id
      WHERE c.archived_at IS NULL
      ORDER BY (c.favourite_rank IS NULL),
               c.favourite_rank ASC,
               (m.last_captured IS NULL),
               m.last_captured DESC,
               c.name COLLATE NOCASE ASC`,
  );
}
