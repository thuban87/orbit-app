/**
 * Read queries — dashboard status scan + newest-interaction-per-contact (DATA-05 / DATA-07).
 *
 * Read-only SQL string constants over the query-time status engine. Status and
 * progress are DERIVED-NEVER-STORED (see `status.ts`): STATUS_SCAN composes the
 * PROGRESS_SQL / STATUS_SQL fragments so the dashboard sort and (later) the
 * orrery angle read the SAME computed number, never a persisted one.
 *
 * INJECTION SURFACE (T-02-09): every SQL here is a static fragment — only the
 * threshold CODE-CONSTANTS from status.ts are interpolated (inside those
 * fragments). The ONLY runtime value is `contact_id` in NEWEST_FOR_CONTACT,
 * which is `?`-bound, never interpolated.
 */
import { PROGRESS_SQL, STATUS_SQL } from "@/db/status";

/**
 * Dashboard status scan: one row per LIVE, CONTACTED contact with its computed
 * progress + status, most-overdue first.
 *
 * `last_contact IS NOT NULL` is the never-contacted predicate ([data→dashboard])
 * and is ALSO what makes STATUS_SQL safe here — STATUS_SQL alone would bucket a
 * NULL last_contact as 'stable' (every comparison false → ELSE), so this filter
 * is load-bearing, not merely cosmetic. `archived_at IS NULL` drops archived
 * rows (archived is excluded everywhere).
 */
export const STATUS_SCAN = `SELECT id, name, (${PROGRESS_SQL}) AS progress, (${STATUS_SQL}) AS status
    FROM contacts
   WHERE last_contact IS NOT NULL AND archived_at IS NULL
   ORDER BY progress DESC`;

/**
 * Newest interaction per contact — the all-contacts scan form (channel for AI,
 * timeline head). ROW_NUMBER() partitions by contact and orders newest-first,
 * breaking a same-day tie by `id DESC` (the later-recorded row wins). Prefer
 * this window form for the full scan; use NEWEST_FOR_CONTACT for a single seek.
 */
export const NEWEST_PER_CONTACT = `SELECT contact_id, occurred_at, channel FROM (
    SELECT contact_id, occurred_at, channel,
           ROW_NUMBER() OVER (PARTITION BY contact_id
                              ORDER BY occurred_at DESC, id DESC) AS rn
      FROM interactions
  ) WHERE rn = 1`;

/**
 * Single-contact newest-interaction head — the cheapest form, a per-contact seek
 * on the `(contact_id, occurred_at DESC)` recency index. `contact_id` is the sole
 * bound value (`?`); the `occurred_at DESC, id DESC` order matches NEWEST_PER_CONTACT's
 * tiebreak so both agree on which row is "newest".
 */
export const NEWEST_FOR_CONTACT = `SELECT contact_id, occurred_at, channel
    FROM interactions
   WHERE contact_id = ?
   ORDER BY occurred_at DESC, id DESC
   LIMIT 1`;

/**
 * Status sort rank — most-urgent first for a JS `.sort()`. Extends the plugin's
 * OrbitIndex order (decay < wobble < stable < snoozed) with `rogue` ahead of
 * everything (the 4th, most-overdue threshold). `snoozed` is a suppression
 * state, so it sorts last.
 */
export const statusOrder = {
  rogue: 0,
  decay: 1,
  wobble: 2,
  stable: 3,
  snoozed: 4,
} as const;
