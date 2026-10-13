/**
 * Off Limits writer (Phase 38.10, D-09, D-11, D-36, D-69).
 *
 * Off Limits is its own table since migration 033. It has no AI column and no
 * AI read path (D-09): nothing here, or anywhere, may route an Off Limits row
 * toward AI egress.
 *
 * Core / wrapper split (transaction.ts): the `*Core` functions never open a
 * transaction; the mutexed wrappers each own exactly one. Every write is
 * scoped by `(id, contact_id)` with assertOneChange, so a mismatched pair
 * changes zero rows and rolls back instead of touching another contact (D-11).
 *
 * Revision bumps (PLAN-MAP §5): one user-level write advances `data_revision`
 * by exactly 1. `deleteOffLimitsCore` forwards `bumpRevision` (default true) to
 * its tombstone write; an aggregate that bumps once itself passes false.
 */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { deleteTombstoneCore, insertTombstoneCore } from "@/db/tombstones-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { deleteStampAt, undoModifiedAt } from "@/db/undo-restore";

export interface NewOffLimitsInput {
  /** Merge-key uid for the new row (caller-minted). */
  uid: string;
  contactId: number;
  label?: string | null;
  text?: string | null;
  url?: string | null;
  now: string;
  /** Defaults to `now`; a move keeps the source's creation time. */
  createdAt?: string;
  /** D-102 Group Note copy marker; default 0. */
  groupNoteCopy?: 0 | 1;
  /** D-108 share-origin marker; default 0. */
  fromShare?: 0 | 1;
}

/** A patch: only the fields present (`!== undefined`) are written. */
export interface EditOffLimitsInput {
  id: number;
  contactId: number;
  label?: string | null;
  text?: string | null;
  url?: string | null;
  now: string;
}

/** Everything a deleted Off Limits row needs to come back on Undo. */
export interface OffLimitsSnapshot {
  id: number;
  uid: string;
  contact_id: number;
  label: string | null;
  text: string | null;
  url: string | null;
  group_note_copy: number;
  from_share: number;
  created_at: string;
  modified_at: string;
  /** The tombstone stamp (never named `deleted_at`; convergence c2 G-D1). */
  tombstoned_at: string;
}

function assertValidId(op: string, name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${op}: invalid ${name} ${String(value)}`);
  }
}

function assertOneChange(
  op: string,
  id: number,
  contactId: number,
  changes: number,
): void {
  if (changes !== 1) {
    throw new Error(
      `${op}: no Off Limits entry matched id=${id} for contactId=${contactId} (changed ${changes})`,
    );
  }
}

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

function assertMarker(name: string, value: number): void {
  if (value !== 0 && value !== 1) {
    throw new Error(`off-limits-dao: ${name} must be 0 or 1`);
  }
}

// --- Non-mutexed cores ------------------------------------------------------

/** Insert one Off Limits entry; rejects a row with no label, text or url. */
export async function addOffLimitsCore(
  exec: SqlExecutor,
  input: NewOffLimitsInput,
): Promise<number> {
  assertValidId("addOffLimits", "contactId", input.contactId);
  if (isBlank(input.label) && isBlank(input.text) && isBlank(input.url)) {
    throw new Error("off-limits-dao: label, text or url is required");
  }
  const groupNoteCopy = input.groupNoteCopy ?? 0;
  const fromShare = input.fromShare ?? 0;
  assertMarker("groupNoteCopy", groupNoteCopy);
  assertMarker("fromShare", fromShare);
  const result = await exec.runAsync(
    `INSERT INTO off_limits
       (uid, contact_id, label, text, url, group_note_copy, from_share,
        created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.uid,
      input.contactId,
      input.label ?? null,
      input.text ?? null,
      input.url ?? null,
      groupNoteCopy,
      fromShare,
      input.createdAt ?? input.now,
      input.now,
    ],
  );
  return result.lastInsertRowId;
}

/** Patch one entry scoped by `(id, contact_id)`; `created_at` never changes. */
export async function editOffLimitsCore(
  exec: SqlExecutor,
  input: EditOffLimitsInput,
): Promise<void> {
  assertValidId("editOffLimits", "id", input.id);
  assertValidId("editOffLimits", "contactId", input.contactId);
  const sets: string[] = [];
  const params: (string | null)[] = [];
  if (input.label !== undefined) {
    sets.push("label = ?");
    params.push(input.label);
  }
  if (input.text !== undefined) {
    sets.push("text = ?");
    params.push(input.text);
  }
  if (input.url !== undefined) {
    sets.push("url = ?");
    params.push(input.url);
  }
  sets.push("modified_at = ?");
  params.push(input.now);
  const result = await exec.runAsync(
    `UPDATE off_limits
        SET ${sets.join(", ")}
      WHERE id = ? AND contact_id = ?`,
    [...params, input.id, input.contactId],
  );
  assertOneChange("editOffLimits", input.id, input.contactId, result.changes);
}

/**
 * Hard-delete one entry with a tombstone, returning the snapshot Undo needs.
 * The tombstone and `tombstoned_at` use `deleteStampAt(now, row.modified_at)`
 * so a delete right after an Undo never stamps older than the row (c9).
 */
export async function deleteOffLimitsCore(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string; bumpRevision?: boolean },
): Promise<OffLimitsSnapshot> {
  assertValidId("deleteOffLimits", "id", input.id);
  assertValidId("deleteOffLimits", "contactId", input.contactId);
  const row = await exec.getFirstAsync<
    Omit<OffLimitsSnapshot, "tombstoned_at">
  >(
    `SELECT id, uid, contact_id, label, text, url, group_note_copy, from_share,
            created_at, modified_at
       FROM off_limits
      WHERE id = ? AND contact_id = ?`,
    [input.id, input.contactId],
  );
  if (!row) {
    throw new Error(
      `deleteOffLimits: no Off Limits entry matched id=${input.id} for contactId=${input.contactId} (changed 0)`,
    );
  }
  const tombstonedAt = deleteStampAt(input.now, row.modified_at);
  await insertTombstoneCore(
    exec,
    { entityType: "off_limits", entityUid: row.uid, deletedAt: tombstonedAt },
    { bumpRevision: input.bumpRevision ?? true },
  );
  const result = await exec.runAsync(
    "DELETE FROM off_limits WHERE id = ? AND contact_id = ?",
    [input.id, input.contactId],
  );
  assertOneChange("deleteOffLimits", input.id, input.contactId, result.changes);
  return { ...row, tombstoned_at: tombstonedAt };
}

/**
 * Re-insert a deleted entry with its uid and every column (D-102, D-108
 * markers included), a `modified_at` strictly newer than its tombstone
 * (F-D4), then remove the tombstone. The old id is reused only when it is
 * still free (checker W6). Returns the restored id. Never bumps.
 */
export async function undoDeleteOffLimitsCore(
  exec: SqlExecutor,
  snapshot: OffLimitsSnapshot,
  now: string,
): Promise<number> {
  const modifiedAt = undoModifiedAt(now, snapshot.tombstoned_at);
  const idFree =
    (await exec.getFirstAsync<{ one: number }>(
      "SELECT 1 AS one FROM off_limits WHERE id = ?",
      [snapshot.id],
    )) === null;
  const columns = [
    "uid",
    "contact_id",
    "label",
    "text",
    "url",
    "group_note_copy",
    "from_share",
    "created_at",
    "modified_at",
  ];
  const values: (string | number | null)[] = [
    snapshot.uid,
    snapshot.contact_id,
    snapshot.label,
    snapshot.text,
    snapshot.url,
    snapshot.group_note_copy,
    snapshot.from_share,
    snapshot.created_at,
    modifiedAt,
  ];
  if (idFree) {
    columns.unshift("id");
    values.unshift(snapshot.id);
  }
  const result = await exec.runAsync(
    `INSERT INTO off_limits (${columns.join(", ")})
     VALUES (${columns.map(() => "?").join(", ")})`,
    values,
  );
  await deleteTombstoneCore(exec, {
    entityType: "off_limits",
    entityUid: snapshot.uid,
  });
  return idFree ? snapshot.id : result.lastInsertRowId;
}

// --- Mutexed wrappers (one transaction, exactly one revision bump) ----------

export function addOffLimits(
  exec: SqlExecutor,
  input: NewOffLimitsInput,
): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await addOffLimitsCore(exec, input);
    await bumpDataRevisionCore(exec);
    return id;
  });
}

export function editOffLimits(
  exec: SqlExecutor,
  input: EditOffLimitsInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await editOffLimitsCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

/** The core's tombstone write is the single bump; no second bump here. */
export function deleteOffLimits(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string },
): Promise<OffLimitsSnapshot> {
  return inWriteTransaction(exec, () => deleteOffLimitsCore(exec, input));
}

export function undoDeleteOffLimits(
  exec: SqlExecutor,
  snapshot: OffLimitsSnapshot,
  now: string,
): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await undoDeleteOffLimitsCore(exec, snapshot, now);
    await bumpDataRevisionCore(exec);
    return id;
  });
}
