/**
 * Bound/Unbound contact lifecycle commands.
 *
 * Lifecycle is deliberately independent of cadence assignment: Unbinding only
 * opts a contact out of active cadence treatment. It never clears a previously
 * assigned cadence or relationship-owned columns such as last_contact and
 * favourite_rank. Binding reuses a dormant cadence when one exists; a contact
 * that has never received a cadence must be given a positive one explicitly.
 */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { recordEventCore } from "@/db/events-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

function assertPositiveCadence(intervalDays: number): void {
  if (!Number.isInteger(intervalDays) || intervalDays <= 0) {
    throw new Error(
      `bindContact: intervalDays must be a positive integer, got ${intervalDays}`,
    );
  }
}

/**
 * Make an Unbound contact Bound. A dormant positive cadence is retained. A
 * never-assigned cadence must be provided for the first bind; this makes the
 * v11 Bound-plus-NULL constraint explicit at the command boundary.
 */
export function bindContact(
  exec: SqlExecutor,
  id: number,
  now: string,
  intervalDays?: number,
): Promise<void> {
  // Return a rejected Promise before opening the transaction, matching the
  // aggregate DAO's caller-facing async contract.
  if (intervalDays !== undefined) {
    try {
      assertPositiveCadence(intervalDays);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  return inWriteTransaction(exec, async () => {
    const current = await exec.getFirstAsync<{
      interval_days: number | null;
      tracking_enabled: number;
    }>("SELECT interval_days, tracking_enabled FROM contacts WHERE id = ?", [
      id,
    ]);
    if (current?.tracking_enabled !== 0) {
      throw new Error(`bindContact: no Unbound contact matched id=${id}`);
    }

    if (current.interval_days === null && intervalDays === undefined) {
      throw new Error(
        `bindContact: contact id=${id} requires a positive cadence before it can be Bound`,
      );
    }

    const result =
      current.interval_days === null
        ? await exec.runAsync(
            `UPDATE contacts
                SET tracking_enabled = 1, interval_days = ?, modified_at = ?
              WHERE id = ? AND tracking_enabled = 0 AND interval_days IS NULL`,
            [intervalDays, now, id],
          )
        : await exec.runAsync(
            `UPDATE contacts
                SET tracking_enabled = 1, modified_at = ?
              WHERE id = ? AND tracking_enabled = 0 AND interval_days IS NOT NULL`,
            [now, id],
          );
    if (result.changes !== 1) {
      throw new Error(
        `bindContact: no unchanged Unbound contact matched id=${id} (changed ${result.changes})`,
      );
    }
    // Record the immutable 'bind' lifecycle moment (D-08, ADR-025). Composed via
    // the NON-mutexed core inside this ALREADY-OPEN transaction — never a nested
    // inWriteTransaction (the write mutex is non-reentrant; nesting hangs). The
    // event's occurredAt is the bind moment `now`, not invented from another field.
    await recordEventCore(exec, {
      uid: newUid(),
      contactId: id,
      type: "bind",
      occurredAt: now,
      detail: null,
      now,
    });
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Make a Bound contact Unbound without changing its cadence, favourite rank, or
 * relationship history. The cadence remains dormant and is reused by bindContact.
 */
export function unbindContact(
  exec: SqlExecutor,
  id: number,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `UPDATE contacts
          SET tracking_enabled = 0, modified_at = ?
        WHERE id = ? AND tracking_enabled = 1`,
      [now, id],
    );
    if (result.changes !== 1) {
      throw new Error(
        `unbindContact: no Bound contact matched id=${id} (changed ${result.changes})`,
      );
    }
    // Record the immutable 'unbind' lifecycle moment (D-08, ADR-025). Same
    // composition rule as bindContact: NON-mutexed core inside this already-open
    // transaction, occurredAt = the unbind moment `now`.
    await recordEventCore(exec, {
      uid: newUid(),
      contactId: id,
      type: "unbind",
      occurredAt: now,
      detail: null,
      now,
    });
    await bumpDataRevisionCore(exec);
  });
}
