/**
 * Atomic N-contact write composers for dashboard card selection. Every mutation
 * enters the shared non-reentrant write transaction once, composes transaction
 * cores per selected row, and advances data revision once after all writes.
 */
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
  clearSnoozeCore,
  snoozeContactCore,
  type SnoozePreset,
} from "@/db/snooze-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

export type QuickLogBatchReceipt = Array<{
  contactId: number;
  interactionId: number;
}>;

function rejectInvalidFrequency(intervalDays: number): void {
  if (!Number.isInteger(intervalDays) || intervalDays <= 0) {
    throw new Error(`intervalDays must be a positive integer, got ${intervalDays}`);
  }
}

export function bulkQuickLog(
  exec: SqlExecutor,
  ids: number[],
  now: string,
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
        channel: "unspecified",
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
    for (const id of ids) await setFavouriteRankCore(exec, id, now);
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
    for (const id of ids) await clearFavouriteRankCore(exec, id, now);
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
  return inWriteTransaction(exec, async () => {
    for (const contactId of ids) {
      await snoozeContactCore(exec, {
        contactId,
        uid: newUid(),
        preset,
        now,
      });
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
      await clearSnoozeCore(exec, { contactId, uid: newUid(), now });
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
    for (const id of ids) await setContactCategoryCore(exec, id, categoryId, now);
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
