/** Mutexed writer for typed Memory rows. */
import {
  MEMORY_TYPE_REGISTRY,
  type MemoryTypeKey,
} from "@/db/memory-registry";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { insertTombstoneCore } from "@/db/tombstones-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

export type MemoryProvenance = "user" | "import" | "share";

export interface NewMemoryInput {
  contactId: number;
  /** Runtime validation protects direct callers and future deserializers. */
  type: string;
  customLabel?: string | null;
  value?: string | null;
  note?: string | null;
  url?: string | null;
  meaningfulDate?: string | null;
  pinned?: boolean;
  outdated?: boolean;
  hidden?: boolean | null;
  provenance?: MemoryProvenance;
  createdAt: string;
  now: string;
}

/** A patch to one Memory, scoped by both its row and owning contact. */
export interface EditMemoryInput {
  id: number;
  contactId: number;
  type?: string;
  customLabel?: string | null;
  value?: string | null;
  note?: string | null;
  url?: string | null;
  meaningfulDate?: string | null;
  pinned?: boolean;
  outdated?: boolean;
  hidden?: boolean | null;
  provenance?: MemoryProvenance;
  now: string;
}

/** The identifying slice a trash-sweep candidate needs to expire one Memory. */
export interface MemoryCandidate {
  id: number;
  contactId: number;
}

function normalizeOptional(value: string | null | undefined): string | null {
  return value === undefined || value === null || value.trim().length === 0
    ? null
    : value;
}

export function assertRegisteredMemoryType(
  type: string,
): asserts type is MemoryTypeKey {
  if (!Object.hasOwn(MEMORY_TYPE_REGISTRY, type)) {
    throw new Error("memories-dao: unregistered memory type");
  }
}

function assertCustomLabel(
  type: MemoryTypeKey,
  customLabel: string | null,
): void {
  if (type === "custom" && customLabel === null) {
    throw new Error("memories-dao: custom memory requires a label");
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
      `${op}: no memory matched id=${id} for contactId=${contactId} (changed ${changes})`,
    );
  }
}

/**
 * Insert one row while the caller owns the shared transaction. This core never
 * opens a mutexed transaction, preserving the non-reentrant composition rule.
 */
export async function addMemoryCore(
  exec: SqlExecutor,
  input: NewMemoryInput,
): Promise<number> {
  assertRegisteredMemoryType(input.type);
  const customLabel = normalizeOptional(input.customLabel);
  const value = normalizeOptional(input.value);
  assertCustomLabel(input.type, customLabel);
  if (value === null && customLabel === null) {
    throw new Error("memories-dao: memory value or custom label is required");
  }

  const result = await exec.runAsync(
    `INSERT INTO memories
       (uid, contact_id, type, custom_label, value, note, url, meaningful_date,
        pinned, outdated, hidden, provenance, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUid(),
      input.contactId,
      input.type,
      customLabel,
      value,
      normalizeOptional(input.note),
      normalizeOptional(input.url),
      normalizeOptional(input.meaningfulDate),
      input.pinned ? 1 : 0,
      input.outdated ? 1 : 0,
      input.hidden === null || input.hidden === undefined ? null : input.hidden ? 1 : 0,
      input.provenance ?? "user",
      input.createdAt,
      input.now,
    ],
  );
  return result.lastInsertRowId;
}

/**
 * Patch one Memory while the caller owns the shared transaction. Only fields
 * explicitly present in the input are written, preventing a stale UI snapshot
 * from clobbering a different field committed concurrently.
 */
export async function editMemoryCore(
  exec: SqlExecutor,
  input: EditMemoryInput,
): Promise<void> {
  if (input.type !== undefined) assertRegisteredMemoryType(input.type);

  const existing = await exec.getFirstAsync<{
    type: string;
    custom_label: string | null;
    value: string | null;
  }>(
    "SELECT type, custom_label, value FROM memories WHERE id = ? AND contact_id = ?",
    [input.id, input.contactId],
  );
  if (!existing) {
    assertOneChange("editMemory", input.id, input.contactId, 0);
    return;
  }

  const effectiveType = input.type ?? existing.type;
  const effectiveCustomLabel =
    input.customLabel === undefined
      ? existing.custom_label
      : normalizeOptional(input.customLabel);
  const effectiveValue =
    input.value === undefined ? existing.value : normalizeOptional(input.value);
  if (effectiveType === "custom") {
    assertCustomLabel("custom", effectiveCustomLabel);
  }
  if (effectiveValue === null && effectiveCustomLabel === null) {
    throw new Error("memories-dao: memory value or custom label is required");
  }

  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (input.type !== undefined) {
    sets.push("type = ?");
    params.push(input.type);
  }
  if (input.customLabel !== undefined) {
    sets.push("custom_label = ?");
    params.push(effectiveCustomLabel);
  }
  if (input.value !== undefined) {
    sets.push("value = ?");
    params.push(normalizeOptional(input.value));
  }
  if (input.note !== undefined) {
    sets.push("note = ?");
    params.push(normalizeOptional(input.note));
  }
  if (input.url !== undefined) {
    sets.push("url = ?");
    params.push(normalizeOptional(input.url));
  }
  if (input.meaningfulDate !== undefined) {
    sets.push("meaningful_date = ?");
    params.push(normalizeOptional(input.meaningfulDate));
  }
  if (input.pinned !== undefined) {
    sets.push("pinned = ?");
    params.push(input.pinned ? 1 : 0);
  }
  if (input.outdated !== undefined) {
    sets.push("outdated = ?");
    params.push(input.outdated ? 1 : 0);
  }
  if (input.hidden !== undefined) {
    sets.push("hidden = ?");
    params.push(input.hidden === null ? null : input.hidden ? 1 : 0);
  }
  if (input.provenance !== undefined) {
    sets.push("provenance = ?");
    params.push(input.provenance);
  }
  sets.push("modified_at = ?");
  params.push(input.now);

  const result = await exec.runAsync(
    `UPDATE memories
        SET ${sets.join(", ")}
      WHERE id = ? AND contact_id = ?`,
    [...params, input.id, input.contactId],
  );
  assertOneChange("editMemory", input.id, input.contactId, result.changes);
}

/** Soft-delete one Memory while the caller owns the shared transaction. */
export async function deleteMemoryCore(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string },
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE memories
        SET deleted_at = ?, modified_at = ?
      WHERE id = ? AND contact_id = ?`,
    [input.now, input.now, input.id, input.contactId],
  );
  assertOneChange("deleteMemory", input.id, input.contactId, result.changes);
}

/** Restore one soft-deleted Memory while the caller owns the transaction. */
export async function restoreMemoryCore(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string },
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE memories
        SET deleted_at = NULL, modified_at = ?
      WHERE id = ? AND contact_id = ?`,
    [input.now, input.id, input.contactId],
  );
  assertOneChange("restoreMemory", input.id, input.contactId, result.changes);
}

/**
 * Physically remove an already soft-deleted Memory while the caller owns the
 * shared transaction. The deleted_at guard preserves the two-stage lifecycle.
 */
export async function purgeMemoryPermanentlyCore(
  exec: SqlExecutor,
  id: number,
  contactId: number,
): Promise<void> {
  const target = await exec.getFirstAsync<{ uid: string; deleted_at: string }>(
    "SELECT uid, deleted_at FROM memories WHERE id = ? AND contact_id = ? AND deleted_at IS NOT NULL",
    [id, contactId],
  );
  if (!target) {
    assertOneChange("purgeMemoryPermanently", id, contactId, 0);
    return;
  }
  await insertTombstoneCore(
    exec,
    { entityType: "memory", entityUid: target.uid, deletedAt: target.deleted_at },
    { bumpRevision: false },
  );
  const result = await exec.runAsync(
    "DELETE FROM memories WHERE id = ? AND contact_id = ? AND deleted_at IS NOT NULL",
    [id, contactId],
  );
  assertOneChange("purgeMemoryPermanently", id, contactId, result.changes);
}

/** Insert one Memory and mark the database dirty for backup inside one mutex. */
export function addMemory(
  exec: SqlExecutor,
  input: NewMemoryInput,
): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await addMemoryCore(exec, input);
    await bumpDataRevisionCore(exec);
    return id;
  });
}

/** Patch one Memory and mark the database dirty for backup inside one mutex. */
export function editMemory(
  exec: SqlExecutor,
  input: EditMemoryInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await editMemoryCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

/** Soft-delete one Memory and mark the database dirty inside one mutex. */
export function deleteMemory(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await deleteMemoryCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

/** Restore one Memory and mark the database dirty for backup inside one mutex. */
export function restoreMemory(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await restoreMemoryCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

/** User-confirmed immediate purge for an already soft-deleted Memory. */
export function purgeMemoryPermanently(
  exec: SqlExecutor,
  candidate: MemoryCandidate,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await purgeMemoryPermanentlyCore(exec, candidate.id, candidate.contactId);
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Sweep writer: re-check the complete stale predicate under the write lock
 * before invoking the non-mutexed core, so restored or freshly re-deleted rows
 * survive the advisory candidate scan.
 */
export function expireMemoryIfStale(
  exec: SqlExecutor,
  candidate: MemoryCandidate,
  windowModifier: string,
  _now: string,
): Promise<boolean> {
  return inWriteTransaction(exec, async () => {
    const stale = await exec.getFirstAsync<{ one: number }>(
      `SELECT 1 AS one FROM memories
        WHERE id = ?
          AND contact_id = ?
          AND deleted_at IS NOT NULL
          AND deleted_at < datetime('now', 'localtime', ?)`,
      [candidate.id, candidate.contactId, windowModifier],
    );
    if (stale === null) return false;
    await purgeMemoryPermanentlyCore(exec, candidate.id, candidate.contactId);
    await bumpDataRevisionCore(exec);
    return true;
  });
}
