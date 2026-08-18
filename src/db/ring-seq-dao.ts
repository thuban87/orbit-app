/**
 * Ring-seq write layer (ORR-06) — the FIRST writer of `contacts.ring_seq`.
 *
 * A near-VERBATIM clone of `rewriteFavouriteRanks` (favourites-dao.ts:105-143):
 * the same THREE guards, N raw `?`-bound UPDATEs inside ONE `inWriteTransaction`,
 * a `changes===1` assertion per row. Two swaps from the favourites original:
 *   (1) the column `favourite_rank → ring_seq`;
 *   (2) the scope predicate `favourite_rank IS NOT NULL → last_contact IS NOT
 *       NULL` (the ORBITING set, not the favourites set), PLUS an optional
 *       `excludeContactId` occupant exclusion.
 *
 * OCCUPANT EXCLUSION (the fixed contract seam): when a contact is the sun,
 * `excludeContactId` is passed and BOTH Guard 2's COUNT and every Guard 3 UPDATE
 * append `AND id <> ?` (`?`-bound; omitted entirely, no id bound, when the param
 * is null). So the guard's EFFECTIVE set == `orrery-read`'s RENDERED orbiting set
 * — the orbiting WHERE (`last_contact IS NOT NULL AND archived_at IS NULL`) minus
 * the sun occupant — and the sun-excluded (N−1) drag list agrees with the count.
 * When `excludeContactId` is null the scope is the full orbiting set (the self-sun
 * path, identical to the favourites clone). A caller that wrongly passes the full
 * N-length list while a sun is set fails Guard 2 (N ≠ N−1) and writes nothing.
 *
 * THREE guards (each a loud failure rolling back the WHOLE batch so a partial /
 * duplicate / stale list can never leave stale ring_seq or rank a non-orbiting /
 * archived / sun row):
 *   (1) UNIQUE ids — a duplicate → throw (Set size !== length).
 *   (2) COUNT MATCH — `orderedIds.length` must equal the EFFECTIVE orbiting count
 *       (orbiting WHERE, minus the excluded sun), so an omitted contact can't be
 *       left at a stale seq and an over-long list can't smuggle in a non-orbiting.
 *   (3) SCOPED UPDATE — every UPDATE is `WHERE id = ? AND last_contact IS NOT NULL
 *       AND archived_at IS NULL [AND id <> ?]` with `changes===1`, so a STALE id
 *       (never-contacted, archived, non-existent, or the excluded sun) fails and
 *       rolls back — a seq can NEVER land on a non-orbiting / archived / sun row.
 *
 * M3 (why a stale stored seq is harmless): the render rank is derived DENSELY at
 * READ by `listOrbitingContacts` (`ORDER BY COALESCE(ring_seq, 1e9), created_at,
 * id` — row index IS the rank), never from the stored value. So a contact left
 * with a stale/duplicate `ring_seq` while it was the hidden sun sorts back into a
 * dense, deterministic order when the sun returns to self — no renumber sweep on
 * sun-ownership change (option (a)).
 *
 * NON-REENTRANCY (transaction.ts): the mutex is non-reentrant — calling a wrapped
 * single-write DAO inside this loop would PERMANENTLY hang. This issues N RAW
 * UPDATEs directly inside the ONE outer transaction. Keep it exactly as-is.
 *
 * An empty `orderedIds` (`[]`) is an ACCEPTED no-op (uniqueness 0===0, count
 * matches when the effective orbiting count is also 0) — harmless, unreachable
 * from the drag UI.
 *
 * `last_contact` is NEVER WRITTEN here — it appears only in the read-scope guard
 * WHERE, never in a SET clause (the single-writer recency invariant is intact).
 * `now` is `localDateTime()` (never `toISOString()`); only `modified_at` is bumped.
 */
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

export function rewriteRingSeq(
  exec: SqlExecutor,
  orderedIds: number[],
  now: string,
  excludeContactId: number | null,
): Promise<void> {
  // The occupant-exclusion term + its bound param — appended to BOTH the count
  // guard and every scoped UPDATE ONLY when a sun contact is set.
  const excludeSql = excludeContactId !== null ? " AND id <> ?" : "";
  const excludeParams: unknown[] = excludeContactId !== null ? [excludeContactId] : [];

  return inWriteTransaction(exec, async () => {
    // Guard 1: reject a non-unique list BEFORE any write.
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new Error(
        `rewriteRingSeq: orderedIds contains duplicate ids (${orderedIds.length} ids, ${new Set(orderedIds).size} unique)`,
      );
    }
    // Guard 2: the supplied list must be the COMPLETE effective orbiting set (the
    // orbiting WHERE minus the excluded sun occupant).
    const countRow = await exec.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM contacts
        WHERE last_contact IS NOT NULL AND archived_at IS NULL${excludeSql}`,
      excludeParams,
    );
    const current = countRow?.n ?? 0;
    if (current !== orderedIds.length) {
      throw new Error(
        `rewriteRingSeq: orderedIds length ${orderedIds.length} != effective orbiting count ${current}`,
      );
    }
    // Guard 3: each UPDATE is scoped to a LIVE orbiting contact (changes===1) —
    // a stale id (or the excluded sun) fails here and rolls back the batch.
    for (let seq = 0; seq < orderedIds.length; seq++) {
      const result = await exec.runAsync(
        `UPDATE contacts
            SET ring_seq = ?, modified_at = ?
          WHERE id = ? AND last_contact IS NOT NULL AND archived_at IS NULL${excludeSql}`,
        [seq, now, orderedIds[seq], ...excludeParams],
      );
      if (result.changes !== 1) {
        throw new Error(
          `rewriteRingSeq: id=${orderedIds[seq]} is not a live orbiting contact (changed ${result.changes})`,
        );
      }
    }
  });
}
