/**
 * Favourites write layer (DASH-06) — the ONLY new writer Phase 8 introduces.
 *
 * Mirrors the shipped `setContactPhoto` / `clearContactPhoto` single-column-writer
 * pattern (contacts-dao.ts:518-563) EXACTLY: one `inWriteTransaction`, a `?`-bound
 * single-column UPDATE, and a `changes===1` loud-failure guard (a bad id throws →
 * rollback). NONE of these functions writes the recency column (`contacts`.<the
 * last-spoke timestamp>) — the recency DAO stays the SINGLE writer of that column
 * (DATA-04 invariant intact by construction; grep-verified: this file never
 * references the recency column at all).
 *
 * `favourite_rank` already exists (migration 001) — no migration ships here.
 * ADR-075 retires rank as a user-facing order: this vestigial storage is retained
 * only for membership and internal picker reads, so no rank-rewrite writer exists.
 */
import { inWriteTransaction } from "@/db/transaction";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import type { SqlExecutor } from "@/db/types";

/**
 * Mark a contact a favourite by APPENDING it at the end of the rank order:
 * `favourite_rank = MAX(favourite_rank) + 1` over the whole table (the first
 * favourite → 0, since `COALESCE(MAX(...), -1) + 1`). One `?`-bound single-column
 * UPDATE + `modified_at` bump inside ONE transaction; asserts exactly one row
 * changed (a bad id throws → rollback). The recency column is untouched.
 *
 * Idempotency is not a concern here: the profile star only calls this on a
 * NON-favourite contact (the toggle's other half is `clearFavouriteRank`).
 * Re-marking an already-ranked contact would move it to the end — harmless and
 * unreachable from the star UI.
 */
export function setFavouriteRank(
  exec: SqlExecutor,
  id: number,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `UPDATE contacts
          SET favourite_rank = (SELECT COALESCE(MAX(favourite_rank), -1) + 1 FROM contacts),
              modified_at = ?
        WHERE id = ?`,
      [now, id],
    );
    if (result.changes !== 1) {
      throw new Error(
        `setFavouriteRank: no contact matched id=${id} (changed ${result.changes})`,
      );
    }
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Clear a contact's favourite mark (`favourite_rank = NULL`) + bump `modified_at`.
 * One `?`-bound single-column UPDATE inside ONE transaction; asserts exactly one
 * row changed (a bad id throws → rollback). The recency column is untouched.
 */
export function clearFavouriteRank(
  exec: SqlExecutor,
  id: number,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE contacts SET favourite_rank = NULL, modified_at = ? WHERE id = ?",
      [now, id],
    );
    if (result.changes !== 1) {
      throw new Error(
        `clearFavouriteRank: no contact matched id=${id} (changed ${result.changes})`,
      );
    }
    await bumpDataRevisionCore(exec);
  });
}
