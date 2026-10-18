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

/**
 * A lifecycle, snooze, favourite or Edit-participation write was refused
 * because the contact is in the Bin (38.12 D-34; fixes 38.11 IN-04). The one
 * typed error every Bin guard throws, BEFORE any write, so a caller can catch
 * it per id (bulk actions skip that id; the notification Snooze treats it as
 * a no-op).
 */
export class ContactInBinError extends Error {
  readonly contactId: number;
  constructor(operation: string, contactId: number) {
    super(`${operation}: contact id=${contactId} is in the Bin`);
    this.name = "ContactInBinError";
    this.contactId = contactId;
  }
}

/**
 * True for the Bin refusal. The name check also matches an instance from a
 * re-evaluated module copy (a test's `vi.resetModules`).
 */
export function isContactInBinError(
  error: unknown,
): error is ContactInBinError {
  return (
    error instanceof ContactInBinError ||
    (error instanceof Error && error.name === "ContactInBinError")
  );
}

/**
 * The Bin guard (38.12 D-34): run inside the caller's open write transaction,
 * before any write. Refuses a contact whose `archived_at` is set. A missing id
 * passes through, so the writer's own `changes === 1` check still reports it.
 * Modelled on Move to Bin's live-only refusal (`archiveContactCore`).
 */
export async function assertContactNotInBinCore(
  exec: SqlExecutor,
  contactId: number,
  operation: string,
): Promise<void> {
  const row = await exec.getFirstAsync<{ archived_at: string | null }>(
    "SELECT archived_at FROM contacts WHERE id = ?",
    [contactId],
  );
  if (row != null && row.archived_at !== null) {
    throw new ContactInBinError(operation, contactId);
  }
}

function assertPositiveCadence(intervalDays: number): void {
  if (!Number.isInteger(intervalDays) || intervalDays <= 0) {
    throw new Error(
      `bindContact: intervalDays must be a positive integer, got ${intervalDays}`,
    );
  }
}

/** Record the immutable transition inside the caller's existing transaction. */
export async function recordLifecycleTransitionCore(
  exec: SqlExecutor,
  contactId: number,
  direction: "bind" | "unbind",
  now: string,
): Promise<void> {
  await recordEventCore(exec, {
    uid: newUid(),
    contactId,
    type: direction,
    occurredAt: now,
    detail: null,
    now,
  });
}

/**
 * Make an Unbound contact Bound. A dormant positive cadence is retained. A
 * never-assigned cadence must be provided for the first bind; this makes the
 * v11 Bound-plus-NULL constraint explicit at the command boundary.
 *
 * `options.replaceCadence` (38.12 D-95 "Change" on the Bind card; review
 * C-WR-05): `intervalDays` is required and becomes the person's frequency in
 * the SAME transaction as the bind, replacing a dormant cadence, so a bind
 * that fails leaves the saved frequency unchanged.
 */
export function bindContact(
  exec: SqlExecutor,
  id: number,
  now: string,
  intervalDays?: number,
  options: { replaceCadence?: boolean } = {},
): Promise<void> {
  const replaceCadence = options.replaceCadence === true;
  if (replaceCadence && intervalDays === undefined) {
    return Promise.reject(
      new Error("bindContact: replaceCadence needs intervalDays"),
    );
  }
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
      archived_at: string | null;
    }>(
      "SELECT interval_days, tracking_enabled, archived_at FROM contacts WHERE id = ?",
      [id],
    );
    // 38.12 D-34: a person in the Bin is never bound.
    if (current != null && current.archived_at !== null) {
      throw new ContactInBinError("bindContact", id);
    }
    if (current?.tracking_enabled !== 0) {
      throw new Error(`bindContact: no Unbound contact matched id=${id}`);
    }

    if (current.interval_days === null && intervalDays === undefined) {
      throw new Error(
        `bindContact: contact id=${id} requires a positive cadence before it can be Bound`,
      );
    }

    const result = replaceCadence
      ? await exec.runAsync(
          `UPDATE contacts
              SET tracking_enabled = 1, interval_days = ?, modified_at = ?
            WHERE id = ? AND tracking_enabled = 0`,
          [intervalDays, now, id],
        )
      : current.interval_days === null
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
    await recordLifecycleTransitionCore(exec, id, "bind", now);
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
    // 38.12 D-34: a person in the Bin is never unbound.
    await assertContactNotInBinCore(exec, id, "unbindContact");
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
    await recordLifecycleTransitionCore(exec, id, "unbind", now);
    await bumpDataRevisionCore(exec);
  });
}
