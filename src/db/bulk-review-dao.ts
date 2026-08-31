import {
  type UpdateContactFullInput,
  updateContactMetadataCore,
} from "@/db/contacts-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

export interface ResolveBulkReviewFlagInput {
  importSessionRowId: number;
  contactId: number;
  /** Already normalized by the single birthday parser at the UI boundary. */
  birthday: string;
  now: string;
}

export interface IgnoreBulkReviewFlagInput {
  importSessionRowId: number;
  now: string;
}

interface ContactMetadataRow {
  id: number;
  name: string;
  category_id: number | null;
  interval_days: number | null;
  tracking_enabled: number;
  social_battery: string | null;
  rarely_responds: number;
  reminders_off: number;
}

function assertOneChange(
  result: { changes: number },
  operation: string,
  id: number,
): void {
  if (result.changes !== 1) {
    throw new Error(
      `${operation}: no row matched id=${id} (changed ${result.changes})`,
    );
  }
}

async function insertResolutionCore(
  exec: SqlExecutor,
  input: {
    importSessionRowId: number;
    resolution: "fixed" | "ignored";
    now: string;
  },
): Promise<void> {
  const result = await exec.runAsync(
    `INSERT INTO bulk_review_resolutions
       (uid, import_session_row_id, flag_type, resolution, resolved_at)
     VALUES (?, ?, 'birthday', ?, ?)`,
    [newUid(), input.importSessionRowId, input.resolution, input.now],
  );
  assertOneChange(
    result,
    "insertBulkReviewResolutionCore",
    input.importSessionRowId,
  );
}

/**
 * Non-mutexed Fix core for a caller-owned write transaction. It verifies that
 * the supplied contact still belongs to the import row before copying the full
 * current metadata snapshot through the authoritative metadata writer.
 */
export async function resolveBulkReviewFlagCore(
  exec: SqlExecutor,
  input: ResolveBulkReviewFlagInput,
): Promise<void> {
  const contact = await exec.getFirstAsync<ContactMetadataRow>(
    `SELECT c.id, c.name, c.category_id, c.interval_days, c.tracking_enabled,
            c.social_battery, c.rarely_responds, c.reminders_off
       FROM import_session_rows r
       JOIN contacts c ON c.id = r.contact_id
      WHERE r.id = ? AND r.contact_id = ?`,
    [input.importSessionRowId, input.contactId],
  );
  if (!contact) {
    throw new Error(
      `resolveBulkReviewFlagCore: import row ${input.importSessionRowId} is not linked to contact ${input.contactId}`,
    );
  }

  const metadata: UpdateContactFullInput = {
    id: contact.id,
    name: contact.name,
    categoryId: contact.category_id,
    intervalDays: contact.interval_days,
    trackingEnabled: contact.tracking_enabled === 1,
    socialBattery: contact.social_battery,
    birthday: input.birthday,
    rarelyResponds: contact.rarely_responds,
    remindersOff: contact.reminders_off,
    now: input.now,
  };
  await updateContactMetadataCore(exec, metadata);
  // updateContactMetadataCore deliberately does not bump. This makes the fixed
  // birthday visible to the automatic backup's data_revision freshness gate.
  await bumpDataRevisionCore(exec);
  await insertResolutionCore(exec, {
    importSessionRowId: input.importSessionRowId,
    resolution: "fixed",
    now: input.now,
  });
}

/** Non-mutexed Ignore core: it clears only the review flag, never contact data. */
export async function ignoreBulkReviewFlagCore(
  exec: SqlExecutor,
  input: IgnoreBulkReviewFlagInput,
): Promise<void> {
  await insertResolutionCore(exec, {
    importSessionRowId: input.importSessionRowId,
    resolution: "ignored",
    now: input.now,
  });
}

export function resolveBulkReviewFlag(
  exec: SqlExecutor,
  input: ResolveBulkReviewFlagInput,
): Promise<void> {
  return inWriteTransaction(exec, () => resolveBulkReviewFlagCore(exec, input));
}

export function ignoreBulkReviewFlag(
  exec: SqlExecutor,
  input: IgnoreBulkReviewFlagInput,
): Promise<void> {
  return inWriteTransaction(exec, () => ignoreBulkReviewFlagCore(exec, input));
}
