/** Writers for structured contact relationships (KNOW-05). */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { insertTombstoneCore } from "@/db/tombstones-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

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

export interface RelationshipCandidate {
  id: number;
  contactId: number;
}

function assertOneChange(op: string, id: number, contactId: number, changes: number): void {
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
  assertOneChange("editRelationship", input.id, input.contactId, result.changes);
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
  assertOneChange("deleteRelationship", input.id, input.contactId, result.changes);
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
  assertOneChange("restoreRelationship", input.id, input.contactId, result.changes);
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
    { entityType: "relationship", entityUid: target.uid, deletedAt: target.deleted_at },
    { bumpRevision: false },
  );
  const result = await exec.runAsync(
    "DELETE FROM relationships WHERE id = ? AND contact_id = ? AND deleted_at IS NOT NULL",
    [id, contactId],
  );
  assertOneChange("purgeRelationshipPermanently", id, contactId, result.changes);
}

export function addRelationship(exec: SqlExecutor, input: NewRelationshipInput): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await addRelationshipCore(exec, input);
    await bumpDataRevisionCore(exec);
    return id;
  });
}

export function editRelationship(exec: SqlExecutor, input: EditRelationshipInput): Promise<void> {
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
    await purgeRelationshipPermanentlyCore(exec, candidate.id, candidate.contactId);
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
    await purgeRelationshipPermanentlyCore(exec, candidate.id, candidate.contactId);
    await bumpDataRevisionCore(exec);
    return true;
  });
}
