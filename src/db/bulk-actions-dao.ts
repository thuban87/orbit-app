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
  editTouchpointFullCore,
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
  /**
   * The row's stable uid (38.14 review A-WR-03). The re-channel finds the row
   * by `interactionId` AND `uid`, so it follows a row a contact merge moved to
   * the survivor, and never matches a different row that later reused the id
   * (`interactions.id` is a plain rowid, without AUTOINCREMENT).
   */
  uid: string;
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
      const uid = newUid();
      const interactionId = await insertInteractionCore(exec, contactId, now, {
        uid,
        occurredAt: now,
        channel,
        direction: "outbound",
        connected: 1,
        quality: null,
        source: "manual",
      });
      receipt.push({ contactId, interactionId, uid });
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
 * Bulk Quick Log's "Edit" (38.14 D-62, D-82): re-channel every interaction
 * from one batch, by its receipt, in ONE transaction with ONE revision bump.
 *
 * - Per row through the single interaction-edit core (`editTouchpointFullCore`,
 *   ADR-122 :18), never a set-based UPDATE over the receipt. Each row is read
 *   by `id` AND its `uid` and rewritten under its CURRENT `contact_id` with
 *   only `channel` replaced; every other column is passed as stored
 *   (`lockNoteAi` omitted, so an existing note AI lock is kept). Reading by
 *   the current contact (review A-WR-03) follows a row that a contact merge
 *   moved to the survivor (`merge-dao.ts` reparents `interactions`), so a
 *   merge is not a third skip, and the core's recency recompute hits the
 *   person who holds the row now. The core still scopes its UPDATE by
 *   (id, contact_id) and asserts one changed row. The stored direction is kept: changing it would
 *   reopen the withdrawn In Person-as-Mutual rule (former D-57).
 * - Resolves to the number of rows re-channelled (0 when every row was
 *   skipped, or for an empty receipt).
 * - The only skips are D-82's two: a row deleted since the log, and a row
 *   converted into an event (`group_event_id` set). A row edited in Edit
 *   interaction during the Undo window is NOT skipped: Edit re-channels
 *   "every interaction from that batch" (D-62), so its channel is overwritten.
 * - All-or-nothing: any failing row rolls every earlier row and the revision
 *   bump back.
 * - No future-date guard: `occurred_at` is passed through unchanged, so this
 *   never writes a new date (a Quick Log row is stamped at log time, and Edit
 *   interaction refuses a future date). `editTouchpointFull`'s guard exists
 *   for writes that set a date.
 * - Linked notes: `editTouchpointFullCore` throws `LinkedNoteBlankError` only
 *   when a note-linked entry exists AND the passed note is blank. The stored
 *   note is passed through, and no writer can leave a note-linked interaction
 *   with a blank note (checked 38.14-03): links are created only with
 *   non-blank text equal to the note (`insertLinkedEntryCore`, from
 *   `recordTouchpointWithLinkedEntry` / `saveNoteWithLinkedEntry`); every note
 *   edit goes through `editTouchpointFullCore`, which refuses a blank note
 *   while linked (Edit interaction, `editInteractionNoteCore` from the memory
 *   and Last Talked About editors, the group cascades, the knowledge move's
 *   AI lock); Undo restore relinks only to a non-blank note
 *   (`resolveUndoLinkCore`); backup restore detaches a note link whose
 *   interaction note is blank (`repairKnowledgeLinks`). So the throw is not
 *   reachable here and there is no third skip category.
 */
export function rechannelBulkQuickLog(
  exec: SqlExecutor,
  receipt: QuickLogBatchReceipt,
  channel: string,
  now: string,
): Promise<number> {
  if (receipt.length === 0) return Promise.resolve(0);
  return inWriteTransaction(exec, async () => {
    let changed = 0;
    for (const { interactionId, uid } of receipt) {
      const row = await exec.getFirstAsync<{
        contact_id: number;
        occurred_at: string;
        direction: string | null;
        connected: number;
        quality: string | null;
        note: string | null;
        duration: number | null;
        allow_ai: number;
        group_event_id: number | null;
      }>(
        `SELECT contact_id, occurred_at, direction, connected, quality, note,
                duration, allow_ai, group_event_id
           FROM interactions WHERE id = ? AND uid = ?`,
        [interactionId, uid],
      );
      // D-82: deleted, or converted into an event, since the log.
      if (!row || row.group_event_id !== null) continue;
      await editTouchpointFullCore(exec, {
        interactionId,
        contactId: row.contact_id,
        now,
        occurredAt: row.occurred_at,
        channel,
        direction: row.direction,
        connected: row.connected,
        quality: row.quality,
        note: row.note,
        duration: row.duration,
        allowAi: row.allow_ai,
      });
      changed += 1;
    }
    if (changed > 0) await bumpDataRevisionCore(exec);
    return changed;
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
