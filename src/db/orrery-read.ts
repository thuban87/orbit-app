/**
 * Orrery orbiting-contact read chokepoint (ORR-01) — the SINGLE scan behind the
 * orrery render (13-05/13-07). Pure READ-ONLY: no transaction, no writer, no
 * migration, no network — async `getAllAsync` only. On-device SQLite; local-first.
 *
 * =============================================================================
 * IT RE-USES, NEVER RE-DERIVES status/progress: the `PROGRESS_SQL` / `STATUS_SQL`
 * fragments from `status.ts` (the query-time engine — DERIVED-NEVER-STORED) are
 * IMPORTED and composed here, never re-typed. A parity test asserts the built
 * SELECT embeds both fragments verbatim (Pitfall 1), so status can never drift.
 *
 * ORBITING SET: `archived_at IS NULL AND last_contact IS NOT NULL` — the live
 * CONTACTED sky. `last_contact IS NOT NULL` is load-bearing (it is what makes
 * STATUS_SQL safe — a NULL last_contact would bucket 'stable', status.ts NULL
 * note); it also excludes the never-contacted, who cannot orbit until they have a
 * first interaction. Archived contacts are excluded structurally.
 *
 * L11 — SNOOZE DIVERGENCE (deliberate, locked by a test): unlike the dashboard's
 * BASE_WHERE (dashboard-read.ts:142-144), the orrery does NOT filter
 * `snooze_until` — a snoozed-but-contacted contact IS shown. The orrery renders
 * the whole live-contacted sky; a later "consistency with the dashboard" refactor
 * must not silently re-add the snooze clause.
 *
 * M3 — DENSE READ-TIME RANK (option (a), no renumber sweep on sun change): the
 * DISPLAY rank is the 0-based ROW INDEX of `ORDER BY COALESCE(ring_seq, 1e9),
 * created_at, id`, NOT the stored `ring_seq` VALUE. A set ring_seq sorts before a
 * NULL one; ties break by created_at then id. Because the rank is derived densely
 * at read, a STALE or DUPLICATE stored ring_seq — e.g. one left behind on a
 * contact that was the hidden sun during a reorder — is HARMLESS: when the sun
 * returns to self the render order stays dense and deterministic. No renumber
 * sweep runs on sun-ownership change (nothing watches a timestamp anyway).
 *
 * OCCUPANT EXCLUSION: when a contact is the sun (`excludeContactId` passed), it is
 * omitted from the orbiting scan — it does not also orbit. The term is `?`-bound
 * and appended ONLY when non-null; null/undefined excludes nobody.
 *
 * PHOTO (C2-1): `photo` is returned as the RAW relative path (or null) — this read
 * never resolves it. The consumer (13-05 OrbitBody/SunBody) MUST null-guard before
 * `resolvePhotoUri`: `photo ? resolvePhotoUri(photo) : null`.
 *
 * INJECTION: the query is a static string; the only interpolated values are the
 * closed status fragments. The sole runtime value (`excludeContactId`) is `?`-bound.
 * =============================================================================
 */
import type { ProfileStatus } from "@/db/contact-status-read";
import { PROGRESS_SQL, STATUS_SQL } from "@/db/status";
import type { SqlExecutor } from "@/db/types";

/**
 * One orbiting body. `status`/`progress` are non-null: the orbiting WHERE pins
 * `last_contact IS NOT NULL`, so STATUS_SQL/PROGRESS_SQL always resolve a real
 * bucket (never the never-contacted null case). `ring_seq` is nullable — it only
 * ORDERS the rows; the render rank is the row index, never this value (M3).
 */
export interface OrbitingContact {
  id: number;
  name: string;
  /** Raw relative path or null — never resolved here (C2-1). */
  photo: string | null;
  ring_seq: number | null;
  status: ProfileStatus;
  progress: number;
  rarely_responds: number;
}

/**
 * The composed SELECT projection + FROM/ORDER for the orbiting scan. Exported so
 * the parity test can assert it embeds the imported STATUS_SQL/PROGRESS_SQL
 * fragments verbatim (status can never drift). Bare column names resolve to
 * `contacts` (single-table read); the fragments reference bare `last_contact`,
 * `interval_days`, `rarely_responds` — all present on `contacts`.
 */
export const ORBITING_SELECT = `SELECT id,
    name,
    photo,
    ring_seq,
    (${PROGRESS_SQL}) AS progress,
    (${STATUS_SQL}) AS status,
    rarely_responds
   FROM contacts`;

/**
 * Scan the orbiting set — one row per live, contacted, non-archived contact,
 * status single-sourced from status.ts, ordered densely so the row index is the
 * render rank (M3). Pass `excludeContactId` to omit the sun occupant.
 */
export function listOrbitingContacts(
  exec: SqlExecutor,
  opts?: { excludeContactId?: number | null },
): Promise<OrbitingContact[]> {
  const exclude = opts?.excludeContactId;
  const params: unknown[] = [];
  let where = "archived_at IS NULL AND last_contact IS NOT NULL";
  if (exclude !== null && exclude !== undefined) {
    where += " AND id <> ?";
    params.push(exclude);
  }
  const sql = `${ORBITING_SELECT}\n  WHERE ${where}\n  ORDER BY COALESCE(ring_seq, 1e9), created_at, id`;
  return exec.getAllAsync<OrbitingContact>(sql, params);
}
