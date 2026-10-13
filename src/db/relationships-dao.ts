/** Writers for structured contact relationships (KNOW-05). */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { deleteTombstoneCore, insertTombstoneCore } from "@/db/tombstones-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { deleteStampAt, undoModifiedAt } from "@/db/undo-restore";

export interface NewRelationshipInput {
  contactId: number;
  personName: string;
  relationType?: string | null;
  linkedContactId?: number | null;
  note?: string | null;
  pinned?: boolean | number;
  hidden?: 0 | 1 | null;
  createdAt: string;
  now: string;
}

export interface EditRelationshipInput {
  id: number;
  contactId: number;
  personName?: string;
  relationType?: string | null;
  linkedContactId?: number | null;
  note?: string | null;
  pinned?: boolean | number;
  hidden?: 0 | 1 | null;
  now: string;
}

/**
 * Everything a hard-deleted key person needs to come back on Undo: every
 * column except the live `deleted_at`, the tombstone stamp as `tombstoned_at`
 * (convergence c2 G-D1), and the linked contact's uid. Undo never trusts the
 * integer `linked_contact_id` across the window (convergence c4, Codex C-03).
 */
export interface RelationshipSnapshot {
  id: number;
  uid: string;
  contact_id: number;
  person_name: string;
  relation_type: string | null;
  linked_contact_id: number | null;
  note: string | null;
  pinned: number;
  hidden: number | null;
  created_at: string;
  modified_at: string;
  linked_contact_uid: string | null;
  tombstoned_at: string;
}

export interface RelationshipCandidate {
  id: number;
  contactId: number;
}

function assertOneChange(
  op: string,
  id: number,
  contactId: number,
  changes: number,
): void {
  if (changes !== 1) {
    throw new Error(
      `${op}: no relationship matched id=${id} for contactId=${contactId} (changed ${changes})`,
    );
  }
}

function assertPersonName(personName: string): void {
  if (personName.trim().length === 0) {
    throw new Error("relationships-dao: person_name is required");
  }
}

function assertNullableBinaryVisibility(hidden: unknown): void {
  if (hidden !== null && hidden !== 0 && hidden !== 1) {
    throw new Error("relationships-dao: hidden must be 0, 1, or null");
  }
}

/** Reject a relationship whose optional contact link points to its owner. */
export function assertNotSelfLink(
  contactId: number,
  linkedContactId: number | null | undefined,
): void {
  if (linkedContactId != null && linkedContactId === contactId) {
    throw new Error("relationships-dao: a contact cannot be linked to itself");
  }
}

/** Insert a relationship while the caller owns the write transaction. */
export async function addRelationshipCore(
  exec: SqlExecutor,
  input: NewRelationshipInput,
): Promise<number> {
  assertPersonName(input.personName);
  assertNotSelfLink(input.contactId, input.linkedContactId);
  if (input.hidden !== undefined) assertNullableBinaryVisibility(input.hidden);
  const result = await exec.runAsync(
    `INSERT INTO relationships
       (uid, contact_id, person_name, relation_type, linked_contact_id, note,
        pinned, hidden, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUid(),
      input.contactId,
      input.personName,
      input.relationType ?? null,
      input.linkedContactId ?? null,
      input.note ?? null,
      input.pinned ? 1 : 0,
      input.hidden ?? null,
      input.createdAt,
      input.now,
    ],
  );
  return result.lastInsertRowId;
}

/** Patch a relationship while the caller owns the write transaction. */
export async function editRelationshipCore(
  exec: SqlExecutor,
  input: EditRelationshipInput,
): Promise<void> {
  if (input.personName !== undefined) assertPersonName(input.personName);
  if (input.linkedContactId !== undefined) {
    assertNotSelfLink(input.contactId, input.linkedContactId);
  }
  if (input.hidden !== undefined) assertNullableBinaryVisibility(input.hidden);

  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (input.personName !== undefined) {
    sets.push("person_name = ?");
    params.push(input.personName);
  }
  if (input.relationType !== undefined) {
    sets.push("relation_type = ?");
    params.push(input.relationType);
  }
  if (input.linkedContactId !== undefined) {
    sets.push("linked_contact_id = ?");
    params.push(input.linkedContactId);
  }
  if (input.note !== undefined) {
    sets.push("note = ?");
    params.push(input.note);
  }
  if (input.pinned !== undefined) {
    sets.push("pinned = ?");
    params.push(input.pinned ? 1 : 0);
  }
  if (input.hidden !== undefined) {
    sets.push("hidden = ?");
    params.push(input.hidden);
  }
  sets.push("modified_at = ?");
  params.push(input.now);

  const result = await exec.runAsync(
    `UPDATE relationships
        SET ${sets.join(", ")}
      WHERE id = ? AND contact_id = ?`,
    [...params, input.id, input.contactId],
  );
  assertOneChange(
    "editRelationship",
    input.id,
    input.contactId,
    result.changes,
  );
}

/** Soft-delete a relationship while the caller owns the write transaction. */
export async function deleteRelationshipCore(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string },
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE relationships
        SET deleted_at = ?, modified_at = ?
      WHERE id = ? AND contact_id = ?`,
    [input.now, input.now, input.id, input.contactId],
  );
  assertOneChange(
    "deleteRelationship",
    input.id,
    input.contactId,
    result.changes,
  );
}

/** Restore a soft-deleted relationship while the caller owns the write transaction. */
export async function restoreRelationshipCore(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string },
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE relationships
        SET deleted_at = NULL, modified_at = ?
      WHERE id = ? AND contact_id = ?`,
    [input.now, input.id, input.contactId],
  );
  assertOneChange(
    "restoreRelationship",
    input.id,
    input.contactId,
    result.changes,
  );
}

/** Physically remove a soft-deleted relationship while the caller owns the transaction. */
export async function purgeRelationshipPermanentlyCore(
  exec: SqlExecutor,
  id: number,
  contactId: number,
): Promise<void> {
  const target = await exec.getFirstAsync<{ uid: string; deleted_at: string }>(
    "SELECT uid, deleted_at FROM relationships WHERE id = ? AND contact_id = ? AND deleted_at IS NOT NULL",
    [id, contactId],
  );
  if (!target) {
    assertOneChange("purgeRelationshipPermanently", id, contactId, 0);
    return;
  }
  await insertTombstoneCore(
    exec,
    {
      entityType: "relationship",
      entityUid: target.uid,
      deletedAt: target.deleted_at,
    },
    { bumpRevision: false },
  );
  const result = await exec.runAsync(
    "DELETE FROM relationships WHERE id = ? AND contact_id = ? AND deleted_at IS NOT NULL",
    [id, contactId],
  );
  assertOneChange(
    "purgeRelationshipPermanently",
    id,
    contactId,
    result.changes,
  );
}

/**
 * Hard-delete one live key person with a tombstone, returning the snapshot
 * Undo needs (D-69). Scoped by `(id, contact_id)`; a soft-deleted row is not a
 * target. The snapshot records the linked contact's uid (c4). The tombstone
 * and `tombstoned_at` use `deleteStampAt(now, row.modified_at)` (c9);
 * `bumpRevision` (default true) is forwarded to the tombstone write.
 */
export async function deleteRelationshipNowCore(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string; bumpRevision?: boolean },
): Promise<RelationshipSnapshot> {
  const row = await exec.getFirstAsync<
    Omit<RelationshipSnapshot, "tombstoned_at">
  >(
    `SELECT r.id, r.uid, r.contact_id, r.person_name, r.relation_type,
            r.linked_contact_id, r.note, r.pinned, r.hidden, r.created_at,
            r.modified_at, c.uid AS linked_contact_uid
       FROM relationships r
       LEFT JOIN contacts c ON c.id = r.linked_contact_id
      WHERE r.id = ? AND r.contact_id = ? AND r.deleted_at IS NULL`,
    [input.id, input.contactId],
  );
  if (!row) {
    assertOneChange("deleteRelationshipNow", input.id, input.contactId, 0);
    throw new Error("deleteRelationshipNow: unreachable");
  }
  const tombstonedAt = deleteStampAt(input.now, row.modified_at);
  await insertTombstoneCore(
    exec,
    {
      entityType: "relationship",
      entityUid: row.uid,
      deletedAt: tombstonedAt,
    },
    { bumpRevision: input.bumpRevision ?? true },
  );
  const result = await exec.runAsync(
    "DELETE FROM relationships WHERE id = ? AND contact_id = ? AND deleted_at IS NULL",
    [input.id, input.contactId],
  );
  assertOneChange(
    "deleteRelationshipNow",
    input.id,
    input.contactId,
    result.changes,
  );
  return { ...row, tombstoned_at: tombstonedAt };
}

/**
 * Re-insert a hard-deleted key person from its snapshot (D-69): same uid,
 * `deleted_at` NULL written explicitly (G-D1), `modified_at` strictly newer
 * than the tombstone (F-D4), the old id only when free (W6). The linked
 * contact is resolved by uid to its current id; when no contact has that uid
 * the key person returns unlinked with its name kept, as ON DELETE SET NULL
 * would have done (c4). Never bumps.
 */
export async function undoRelationshipDeleteCore(
  exec: SqlExecutor,
  snapshot: RelationshipSnapshot,
  now: string,
): Promise<number> {
  const modifiedAt = undoModifiedAt(now, snapshot.tombstoned_at);
  let linkedContactId: number | null = null;
  if (snapshot.linked_contact_uid !== null) {
    const linked = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM contacts WHERE uid = ?",
      [snapshot.linked_contact_uid],
    );
    if (linked && linked.id !== snapshot.contact_id) {
      linkedContactId = linked.id;
    }
  }
  const idFree =
    (await exec.getFirstAsync<{ one: number }>(
      "SELECT 1 AS one FROM relationships WHERE id = ?",
      [snapshot.id],
    )) === null;
  const columns = [
    "uid",
    "contact_id",
    "person_name",
    "relation_type",
    "linked_contact_id",
    "note",
    "pinned",
    "hidden",
    "created_at",
    "modified_at",
    "deleted_at",
  ];
  const values: (string | number | null)[] = [
    snapshot.uid,
    snapshot.contact_id,
    snapshot.person_name,
    snapshot.relation_type,
    linkedContactId,
    snapshot.note,
    snapshot.pinned,
    snapshot.hidden,
    snapshot.created_at,
    modifiedAt,
    null,
  ];
  if (idFree) {
    columns.unshift("id");
    values.unshift(snapshot.id);
  }
  const result = await exec.runAsync(
    `INSERT INTO relationships (${columns.join(", ")})
     VALUES (${columns.map(() => "?").join(", ")})`,
    values,
  );
  await deleteTombstoneCore(exec, {
    entityType: "relationship",
    entityUid: snapshot.uid,
  });
  return idFree ? snapshot.id : result.lastInsertRowId;
}

export function addRelationship(
  exec: SqlExecutor,
  input: NewRelationshipInput,
): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await addRelationshipCore(exec, input);
    await bumpDataRevisionCore(exec);
    return id;
  });
}

export function editRelationship(
  exec: SqlExecutor,
  input: EditRelationshipInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await editRelationshipCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

export function deleteRelationship(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await deleteRelationshipCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

export function restoreRelationship(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await restoreRelationshipCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

/** User-confirmed immediate purge for an already soft-deleted relationship. */
export function purgeRelationshipPermanently(
  exec: SqlExecutor,
  candidate: RelationshipCandidate,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await purgeRelationshipPermanentlyCore(
      exec,
      candidate.id,
      candidate.contactId,
    );
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Sweep writer: re-check the full stale predicate under the write lock before
 * invoking the non-mutexed core, so a restore or fresh re-delete survives.
 */
export function expireRelationshipIfStale(
  exec: SqlExecutor,
  candidate: RelationshipCandidate,
  windowModifier: string,
  _now: string,
): Promise<boolean> {
  return inWriteTransaction(exec, async () => {
    const stale = await exec.getFirstAsync<{ one: number }>(
      `SELECT 1 AS one FROM relationships
        WHERE id = ?
          AND contact_id = ?
          AND deleted_at IS NOT NULL
          AND deleted_at < datetime('now', 'localtime', ?)`,
      [candidate.id, candidate.contactId, windowModifier],
    );
    if (stale === null) return false;
    await purgeRelationshipPermanentlyCore(
      exec,
      candidate.id,
      candidate.contactId,
    );
    await bumpDataRevisionCore(exec);
    return true;
  });
}

/**
 * Hard-delete one key person with Undo support inside one mutex. The core's
 * tombstone write is the single revision bump.
 */
export function deleteRelationshipNow(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string },
): Promise<RelationshipSnapshot> {
  return inWriteTransaction(exec, () => deleteRelationshipNowCore(exec, input));
}

/** Undo a key-person hard delete inside one mutex, bumping the revision once. */
export function undoRelationshipDelete(
  exec: SqlExecutor,
  snapshot: RelationshipSnapshot,
  now: string,
): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await undoRelationshipDeleteCore(exec, snapshot, now);
    await bumpDataRevisionCore(exec);
    return id;
  });
}
