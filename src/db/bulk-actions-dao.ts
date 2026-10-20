/**
 * Atomic N-contact write composers for dashboard card selection. Every mutation
 * enters the shared non-reentrant write transaction once, composes transaction
 * cores per selected row, and advances data revision once after all writes.
 */
import { isContactInBinError } from "@/db/contact-lifecycle-dao";
import {
  archiveContactCore,
  setContactCategoryCore,
  setContactFrequencyCore,
} from "@/db/contacts-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import {
  clearFavouriteRankCore,
  setFavouriteRankCore,
} from "@/db/favourites-dao";
import { rejectFutureOccurredAt } from "@/db/log-guards";
import {
  deleteInteractionCore,
  insertInteractionCore,
  recomputeLastContactCore,
} from "@/db/recency-dao";
import {
  assertFutureLocalSnoozeDate,
  clearSnoozeCore,
  resolveSnoozeUntil,
  type SnoozePreset,
  snoozeContactCore,
} from "@/db/snooze-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "bulk-actions";

export type QuickLogBatchReceipt = Array<{
  contactId: number;
  interactionId: number;
}>;

function rejectInvalidFrequency(intervalDays: number): void {
  if (!Number.isInteger(intervalDays) || intervalDays <= 0) {
    throw new Error(
      `intervalDays must be a positive integer, got ${intervalDays}`,
    );
  }
}

/**
 * Bulk Quick Log (ADR-103): one outbound, connected interaction per id in one
 * transaction, with one revision bump and an exact receipt for Undo / Edit.
 * `channel` is the resolved Default Interaction Channel (38.14 D-59, amending
 * ADR-103's canonical shape), read by the caller BEFORE this transaction with
 * `readResolvedInteractionChannel` — never inside the non-reentrant mutex.
 */
export function bulkQuickLog(
  exec: SqlExecutor,
  ids: number[],
  now: string,
  channel: string,
): Promise<QuickLogBatchReceipt> {
  try {
    rejectFutureOccurredAt(now, now);
  } catch (error) {
    return Promise.reject(error);
  }
  if (ids.length === 0) return Promise.resolve([]);

  return inWriteTransaction(exec, async () => {
    const receipt: QuickLogBatchReceipt = [];
    for (const contactId of ids) {
      const interactionId = await insertInteractionCore(exec, contactId, now, {
        uid: newUid(),
        occurredAt: now,
        channel,
        direction: "outbound",
        connected: 1,
        quality: null,
        source: "manual",
      });
      receipt.push({ contactId, interactionId });
      await recomputeLastContactCore(exec, contactId, now);
    }
    await bumpDataRevisionCore(exec);
    return receipt;
  });
}

export function undoBulkQuickLog(
  exec: SqlExecutor,
  receipt: QuickLogBatchReceipt,
  now: string,
): Promise<void> {
  if (receipt.length === 0) return Promise.resolve();
  return inWriteTransaction(exec, async () => {
    for (const { contactId, interactionId } of receipt) {
      await deleteInteractionCore(exec, { contactId, interactionId, now });
    }
    await bumpDataRevisionCore(exec);
  });
}

/**
 * One per-id favourite/snooze write in a bulk batch (38.12 D-34, convergence
 * c3 D-5). The Bin guard refuses before any write, so a binned id — reachable
 * here only through a race with Move to Bin — is skipped and the loop goes on;
 * any other error still rolls the whole batch back.
 */
async function skipIfInBin(
  contactId: number,
  write: () => Promise<void>,
): Promise<void> {
  try {
    await write();
  } catch (error) {
    if (!isContactInBinError(error)) throw error;
    Logger.debug(LOG_SCOPE, `skipped a contact in the Bin: id=${contactId}`);
  }
}

export function bulkArchive(
  exec: SqlExecutor,
  ids: number[],
  now: string,
): Promise<void> {
  if (ids.length === 0) return Promise.resolve();
  return inWriteTransaction(exec, async () => {
    for (const id of ids) await archiveContactCore(exec, id, now);
    await bumpDataRevisionCore(exec);
  });
}

export function bulkAddFavourites(
  exec: SqlExecutor,
  ids: number[],
  now: string,
): Promise<void> {
  if (ids.length === 0) return Promise.resolve();
  return inWriteTransaction(exec, async () => {
    for (const id of ids) {
      await skipIfInBin(id, () => setFavouriteRankCore(exec, id, now));
    }
    await bumpDataRevisionCore(exec);
  });
}

export function bulkRemoveFavourites(
  exec: SqlExecutor,
  ids: number[],
  now: string,
): Promise<void> {
  if (ids.length === 0) return Promise.resolve();
  return inWriteTransaction(exec, async () => {
    for (const id of ids) {
      await skipIfInBin(id, () => clearFavouriteRankCore(exec, id, now));
    }
    await bumpDataRevisionCore(exec);
  });
}

export function bulkSnooze(
  exec: SqlExecutor,
  ids: number[],
  preset: SnoozePreset,
  now: string,
): Promise<void> {
  if (ids.length === 0) return Promise.resolve();
  return resolveSnoozeUntil(exec, preset).then((until) =>
    inWriteTransaction(exec, async () => {
      for (const contactId of ids) {
        await skipIfInBin(contactId, () =>
          snoozeContactCore(exec, {
            contactId,
            uid: newUid(),
            until,
            now,
          }),
        );
      }
      await bumpDataRevisionCore(exec);
    }),
  );
}

/**
 * Bulk Choose date (38.11 D-45): snooze every id until one custom local date.
 * The date is validated as a future local date (the same check as the Profile
 * writer) BEFORE the transaction; then `snoozeContactCore` per id and one
 * revision bump, mirroring `bulkSnooze`.
 */
export function bulkSnoozeUntil(
  exec: SqlExecutor,
  ids: number[],
  until: string,
  now: string,
): Promise<void> {
  try {
    assertFutureLocalSnoozeDate(until, now);
  } catch (error) {
    return Promise.reject(error);
  }
  if (ids.length === 0) return Promise.resolve();
  return inWriteTransaction(exec, async () => {
    for (const contactId of ids) {
      await skipIfInBin(contactId, () =>
        snoozeContactCore(exec, {
          contactId,
          uid: newUid(),
          until,
          now,
        }),
      );
    }
    await bumpDataRevisionCore(exec);
  });
}

export function bulkUnsnooze(
  exec: SqlExecutor,
  ids: number[],
  now: string,
): Promise<void> {
  if (ids.length === 0) return Promise.resolve();
  return inWriteTransaction(exec, async () => {
    for (const contactId of ids) {
      await skipIfInBin(contactId, () =>
        clearSnoozeCore(exec, { contactId, uid: newUid(), now }),
      );
    }
    await bumpDataRevisionCore(exec);
  });
}

export function bulkSetCategory(
  exec: SqlExecutor,
  ids: number[],
  categoryId: number | null,
  now: string,
): Promise<void> {
  if (ids.length === 0) return Promise.resolve();
  return inWriteTransaction(exec, async () => {
    for (const id of ids)
      await setContactCategoryCore(exec, id, categoryId, now);
    await bumpDataRevisionCore(exec);
  });
}

export function bulkSetFrequency(
  exec: SqlExecutor,
  ids: number[],
  intervalDays: number,
  now: string,
): Promise<void> {
  try {
    rejectInvalidFrequency(intervalDays);
  } catch (error) {
    return Promise.reject(error);
  }
  if (ids.length === 0) return Promise.resolve();
  return inWriteTransaction(exec, async () => {
    for (const id of ids) {
      await setContactFrequencyCore(exec, id, intervalDays, now);
    }
    await bumpDataRevisionCore(exec);
  });
}
