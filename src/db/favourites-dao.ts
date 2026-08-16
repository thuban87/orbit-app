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
 * Ordering is `favourite_rank ASC`; ranks need not be gap-free.
 */
import { inWriteTransaction } from "@/db/transaction";
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
  });
}

/**
 * Rewrite the favourite ranks of the CURRENT live-favourite set to match
 * `orderedIds` (rank = array index 0..n-1) inside ONE transaction — the drag-end
 * (Manage-favourites, Plan 08) write half. `orderedIds` is the FULL reordered
 * favourites list, computed off-DB by `computeReorder` (favourites-reorder-logic).
 *
 * THREE guards (review MEDIUM-2), each a loud failure that rolls back the WHOLE
 * batch so a partial / duplicate / stale list can never leave stale ranks or
 * assign a rank to a non-favourite / archived row:
 *   (1) UNIQUE ids — a duplicate id → throw (Set size !== length).
 *   (2) COUNT MATCH — `orderedIds.length` must equal the CURRENT count of
 *       non-archived favourites, so an omitted favourite can't be left at a stale
 *       rank and an over-long list can't smuggle in a non-favourite.
 *   (3) SCOPED UPDATE — every UPDATE is `WHERE id = ? AND favourite_rank IS NOT
 *       NULL AND archived_at IS NULL` with a `changes===1` assertion, so a STALE
 *       id (since-unfavourited, archived, or never a favourite) fails loudly and
 *       rolls back — a rank can NEVER land on a non-favourite / archived contact.
 *
 * NON-REENTRANCY (transaction.ts): the mutex is non-reentrant — calling a wrapped
 * single-write DAO (e.g. `setFavouriteRank`) inside this loop would PERMANENTLY
 * hang. This issues N RAW UPDATEs directly inside the ONE outer transaction; it
 * MUST NOT call `setFavouriteRank`. Keep this exactly as-is.
 *
 * An empty `orderedIds` (`[]`) is an ACCEPTED no-op, NOT a missing guard (review
 * A-2): the uniqueness check passes (size 0 === length 0) and the count check
 * passes when the current non-archived favourite count is also 0 (0 === 0), so
 * zero UPDATEs commit and nothing changes — harmless, and unreachable from the
 * drag UI, which only reorders an existing non-empty favourites list.
 *
 * The recency column is untouched.
 */
export function rewriteFavouriteRanks(
  exec: SqlExecutor,
  orderedIds: number[],
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    // Guard 1: reject a non-unique list BEFORE any write.
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new Error(
        `rewriteFavouriteRanks: orderedIds contains duplicate ids (${orderedIds.length} ids, ${new Set(orderedIds).size} unique)`,
      );
    }
    // Guard 2: the supplied list must be the COMPLETE current live-favourite set.
    const countRow = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM contacts WHERE favourite_rank IS NOT NULL AND archived_at IS NULL",
    );
    const current = countRow?.n ?? 0;
    if (current !== orderedIds.length) {
      throw new Error(
        `rewriteFavouriteRanks: orderedIds length ${orderedIds.length} != current live-favourite count ${current}`,
      );
    }
    // Guard 3: each UPDATE is scoped to a LIVE favourite (changes===1 per row) —
    // a stale id fails here and rolls back the batch.
    for (let rank = 0; rank < orderedIds.length; rank++) {
      const result = await exec.runAsync(
        `UPDATE contacts
            SET favourite_rank = ?, modified_at = ?
          WHERE id = ? AND favourite_rank IS NOT NULL AND archived_at IS NULL`,
        [rank, now, orderedIds[rank]],
      );
      if (result.changes !== 1) {
        throw new Error(
          `rewriteFavouriteRanks: id=${orderedIds[rank]} is not a live favourite (changed ${result.changes})`,
        );
      }
    }
  });
}
