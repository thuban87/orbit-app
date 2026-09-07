/**
 * Ring-seq write layer (ORR-06) — the FIRST writer of `contacts.ring_seq`.
 *
 * A near-verbatim clone of the retired favourites rank-rewrite writer:
 * the same THREE guards, N raw `?`-bound UPDATEs inside ONE `inWriteTransaction`,
 * a `changes===1` assertion per row. Two swaps from the favourites original:
 *   (1) the column `favourite_rank → ring_seq`;
 *   (2) the scope predicate `favourite_rank IS NOT NULL → last_contact IS NOT
 *       NULL AND tracking_enabled = 1` (the Bound ORBITING set, not the
 *       favourites set), PLUS an optional `excludeContactId` occupant exclusion.
 *
 * OCCUPANT EXCLUSION (the fixed contract seam): when a contact is the sun,
 * `excludeContactId` is passed and BOTH Guard 2's COUNT and every Guard 3 UPDATE
 * append `AND id <> ?` (`?`-bound; omitted entirely, no id bound, when the param
 * is null). So the guard's EFFECTIVE set == `orrery-read`'s RENDERED orbiting set
 * — the orbiting WHERE (`last_contact IS NOT NULL AND archived_at IS NULL AND
 * tracking_enabled = 1`) minus the sun occupant — and the sun-excluded (N−1)
 * drag list agrees with the count.
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
 *       AND archived_at IS NULL AND tracking_enabled = 1 [AND id <> ?]` with
 *       `changes===1`, so a STALE id (never-contacted, Unbound, archived,
 *       non-existent, or the excluded sun) fails and rolls back — a seq can NEVER
 *       land on a non-orbiting / Unbound / archived / sun row.
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

import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { listOrbitingContacts } from "@/db/orrery-read";
import {
  type ContactIdentity,
  readOrrerySystemMembersCore,
} from "@/db/orrery-system-read";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import type { OrrerySystemRef } from "@/logic/orrery-system-logic";
import { mergeVisibleRingOrder } from "@/logic/ring-reorder-logic";

export interface RingReorderRequest {
  system: OrrerySystemRef;
  expectedFullOrderedIds: number[];
  expectedSavedSunContactId: number | null;
  expectedEligibleVisibleIds: number[];
  expectedContactIdentities: ContactIdentity[];
  reorderedVisibleIds: number[];
}

const sameIds = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/** Delayed gestures enter here. All authority is rechecked on the locked executor. */
export function commitRingReorder(
  exec: SqlExecutor,
  request: RingReorderRequest,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const saved = await exec.getFirstAsync<{ sun_contact_id: number | null }>(
      "SELECT sun_contact_id FROM app_settings WHERE id=1",
    );
    if (!saved || saved.sun_contact_id !== request.expectedSavedSunContactId)
      throw new Error("Stale ring sun");
    const full = (
      await listOrbitingContacts(exec, {
        excludeContactId: saved.sun_contact_id ?? undefined,
      })
    ).map((row) => row.id);
    if (!sameIds(full, request.expectedFullOrderedIds))
      throw new Error("Stale complete ring order");
    const identities = await exec.getAllAsync<ContactIdentity>(
      `SELECT id,uid FROM contacts WHERE (last_contact IS NOT NULL AND archived_at IS NULL AND tracking_enabled=1) OR id=?`,
      [saved.sun_contact_id],
    );
    const expected = request.expectedContactIdentities;
    if (
      new Set(expected.map((row) => row.id)).size !== expected.length ||
      expected.length !== identities.length ||
      identities.some(
        (row) =>
          !expected.some((old) => old.id === row.id && old.uid === row.uid),
      )
    )
      throw new Error("Stale ring identities");
    const members = await readOrrerySystemMembersCore(exec, request.system);
    const eligible = members.members
      .filter((row) => full.includes(row.id))
      .map((row) => row.id);
    if (
      members.status !== "ready" ||
      !sameIds(eligible, request.expectedEligibleVisibleIds)
    )
      throw new Error("Stale ring System membership");
    const ordered = mergeVisibleRingOrder(
      full,
      eligible,
      request.reorderedVisibleIds,
    );
    if (sameIds(full, ordered)) return;
    await rewriteRingSeqCore(exec, ordered, now, saved.sun_contact_id);
  });
}

export function rewriteRingSeq(
  exec: SqlExecutor,
  orderedIds: number[],
  now: string,
  excludeContactId: number | null,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    rewriteRingSeqCore(exec, orderedIds, now, excludeContactId),
  );
}

/** Existing uniqueness/count/scoped-update guards, composed without a nested mutex. */
async function rewriteRingSeqCore(
  exec: SqlExecutor,
  orderedIds: number[],
  now: string,
  excludeContactId: number | null,
): Promise<void> {
  // The occupant-exclusion term + its bound param — appended to BOTH the count
  // guard and every scoped UPDATE ONLY when a sun contact is set.
  const excludeSql = excludeContactId !== null ? " AND id <> ?" : "";
  const excludeParams: unknown[] =
    excludeContactId !== null ? [excludeContactId] : [];

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
        WHERE last_contact IS NOT NULL AND archived_at IS NULL
          AND tracking_enabled = 1${excludeSql}`,
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
          WHERE id = ? AND last_contact IS NOT NULL AND archived_at IS NULL
            AND tracking_enabled = 1${excludeSql}`,
      [seq, now, orderedIds[seq], ...excludeParams],
    );
    if (result.changes !== 1) {
      throw new Error(
        `rewriteRingSeq: id=${orderedIds[seq]} is not a live orbiting contact (changed ${result.changes})`,
      );
    }
  }
  if (orderedIds.length > 0) {
    await bumpDataRevisionCore(exec);
  }
}
