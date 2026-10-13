/**
 * Capture picker read (CAP-01) — the SINGLE parametrized read behind the
 * share-sheet contact picker. Pure READ-ONLY: no transaction, no writer, no
 * migration, no network — async `getAllAsync` only (NEVER the sync variants).
 * On-device SQLite; local-first. Mirrors the `dashboard-read.ts` chokepoint idiom.
 *
 * =============================================================================
 * PICKER SCOPE (D-CAP picker-scope decision, CAP-01; 38.10 D-12):
 *   `WHERE c.archived_at IS NULL` ONLY. This deliberately does NOT inherit
 *   dashboard-read's BASE_WHERE (which carries `last_contact IS NOT NULL`) — the
 *   picker must surface NEVER-CONTACTED people too, because capture is the fast
 *   path for stashing a link onto someone you have never logged an interaction
 *   with. Never add `last_contact IS NOT NULL` here, and never import BASE_WHERE.
 *
 * SHARE RECENCY is DERIVED, not stored (38.10 D-30, D-108): `SHARE_RECENCY_JOIN`
 *   takes, per contact, the newest `created_at` over every home a share can
 *   live in —
 *     - memories with `provenance = 'share'` that are not in the trash
 *       (Thought of Them, or wherever a move put them);
 *     - current-state entries (Last Talked About / Current Location) carrying
 *       the `from_share` marker;
 *     - Off Limits entries carrying the `from_share` marker.
 *   A move keeps the share's `created_at` and carries its marker (plan 03), so a
 *   moved share keeps its place. Entries the user typed (no share marker) never
 *   count. Order is favourites (by rank) → share recency DESC → the rest, stable
 *   by name COLLATE NOCASE.
 *
 * ROW SHAPE: each row carries every `PickerOrderRow` field (`last_contact`,
 *   `snooze_until`, `archived_at`) so the shared ContactPicker can render these
 *   rows directly.
 *
 * CONCURRENCY (RESEARCH Q4): this read takes NO mutex and opens NO transaction,
 *   which is safe alongside the concurrent launch sweep because it reads
 *   `contacts` and the three share homes (not `custom_field_values`, the
 *   sweep's target).
 *
 * INJECTION: no runtime value reaches the SQL; the only interpolation is the
 * static `SHARE_RECENCY_JOIN` constant.
 * =============================================================================
 */
import type { SqlExecutor } from "@/db/types";

/**
 * Per-contact share recency: a LEFT JOIN aliased `m` exposing
 * `m.contact_id` / `m.last_captured`. A static fragment (no bound values).
 */
export const SHARE_RECENCY_JOIN = `LEFT JOIN (SELECT contact_id, MAX(created_at) AS last_captured
                    FROM (SELECT contact_id, created_at
                            FROM memories
                           WHERE provenance = 'share' AND deleted_at IS NULL
                          UNION ALL
                          SELECT contact_id, created_at
                            FROM current_state_entries
                           WHERE from_share = 1
                          UNION ALL
                          SELECT contact_id, created_at
                            FROM off_limits
                           WHERE from_share = 1)
                   GROUP BY contact_id) m ON m.contact_id = c.id`;

/**
 * One row of the capture picker. `last_captured` is the contact's most recent
 * share (NULL when none) and drives the recency band. `last_contact`,
 * `snooze_until` and `archived_at` complete the `PickerOrderRow` shape
 * (`archived_at` is always NULL here). `modified_at` is the row timestamp only
 * (Avatar freshness comes from the display revision, 38.6 D-01).
 */
export interface CapturePickRow {
  id: number;
  name: string;
  photo: string | null;
  modified_at: string;
  favourite_rank: number | null;
  last_contact: string | null;
  snooze_until: string | null;
  archived_at: string | null;
  last_captured: string | null;
}

/**
 * List every non-archived contact for the capture picker, ordered
 * favourites → share recency → rest. Includes never-contacted people; excludes
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
            c.last_contact AS last_contact,
            c.snooze_until AS snooze_until,
            c.archived_at AS archived_at,
            m.last_captured AS last_captured
       FROM contacts c
       ${SHARE_RECENCY_JOIN}
      WHERE c.archived_at IS NULL
      ORDER BY (c.favourite_rank IS NULL),
               c.favourite_rank ASC,
               (m.last_captured IS NULL),
               m.last_captured DESC,
               c.name COLLATE NOCASE ASC`,
  );
}
