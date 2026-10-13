/** Mutexed writer for typed Memory rows. */
import {
  aiDefaultKeyForMemoryType,
  resolveNewItemAiDefault,
} from "@/db/ai-permissions-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import {
  GroupNoteAiLockedError,
  InteractionNoteAiLockedError,
  setLinkedAllowAiCore,
  unlinkGroupCopiesCore,
} from "@/db/linked-entry-dao";
import { MEMORY_TYPE_REGISTRY, type MemoryTypeKey } from "@/db/memory-registry";
import { editInteractionNoteCore } from "@/db/recency-dao";
import { deleteTombstoneCore, insertTombstoneCore } from "@/db/tombstones-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import {
  deleteStampAt,
  type LinkSource,
  resolveUndoLinkCore,
  undoModifiedAt,
} from "@/db/undo-restore";

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
  /**
   * An explicit Allow AI choice from an Add form (D-27). Honoured only for
   * provenance `user`; share and import rows always start at 0 (D-57, ADR-091).
   */
  allowAi?: 0 | 1;
  /**
   * The interaction this memory is linked to and which of its notes (plan
   * 10 owns linking; not editable through `EditMemoryInput`).
   */
  interactionId?: number | null;
  linkSource?: LinkSource | null;
  /**
   * D-102 Group Note copy marker (default 0). A copy is always AI-off:
   * migration 033's `CHECK (group_note_copy = 0 OR allow_ai = 0)`.
   */
  groupNoteCopy?: 0 | 1;
  createdAt: string;
  now: string;
}

/**
 * Everything a hard-deleted Memory needs to come back on Undo: every column
 * except the live `deleted_at`, the tombstone stamp as `tombstoned_at`
 * (convergence c2 G-D1), and the linked interaction's uid (ids are never
 * trusted across the Undo window; F-D3).
 */
export interface MemorySnapshot {
  id: number;
  uid: string;
  contact_id: number;
  type: string;
  custom_label: string | null;
  value: string | null;
  note: string | null;
  url: string | null;
  meaningful_date: string | null;
  pinned: number;
  outdated: number;
  hidden: number | null;
  provenance: string;
  created_at: string;
  modified_at: string;
  allow_ai: number;
  interaction_id: number | null;
  link_source: string | null;
  group_note_copy: number;
  interaction_uid: string | null;
  tombstoned_at: string;
}

/**
 * Type `imported` belongs to the Contacts import alone (D-35, D-14, ADR-161):
 * no other provenance may add one, and no edit may retype a row to or from it.
 */
export class ImportedTypeProvenanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportedTypeProvenanceError";
  }
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
  if (input.type === "imported" && input.provenance !== "import") {
    throw new ImportedTypeProvenanceError(
      "memories-dao: only the Contacts import may add an imported memory",
    );
  }
  const customLabel = normalizeOptional(input.customLabel);
  const value = normalizeOptional(input.value);
  if (value === null && customLabel === null) {
    throw new Error("memories-dao: memory value or custom label is required");
  }
  const groupNoteCopy = input.groupNoteCopy ?? 0;
  if (groupNoteCopy !== 0 && groupNoteCopy !== 1) {
    throw new Error("memories-dao: groupNoteCopy must be 0 or 1");
  }
  const interactionId = input.interactionId ?? null;
  const linkSource = input.linkSource ?? null;
  // Mirrors migration 033's one-directional link CHECK.
  if (interactionId !== null && linkSource === null) {
    throw new Error("memories-dao: a linked memory needs its linkSource");
  }
  // Allow AI seeding. A Group Note copy is always AI-off (D-102; the schema
  // CHECK). Share and import rows always start AI-off (D-57; ADR-091:
  // third-party notes need per-item opt-in), whatever was passed. Otherwise
  // an explicit Add-form choice wins (D-27), else the type's own new-item
  // default (D-13, D-14).
  let allowAi: 0 | 1;
  if (
    groupNoteCopy === 1 ||
    input.provenance === "share" ||
    input.provenance === "import"
  ) {
    allowAi = 0;
  } else if (input.allowAi === 0 || input.allowAi === 1) {
    allowAi = input.allowAi;
  } else {
    allowAi = await resolveNewItemAiDefault(
      exec,
      aiDefaultKeyForMemoryType(input.type),
    );
  }

  const result = await exec.runAsync(
    `INSERT INTO memories
       (uid, contact_id, type, custom_label, value, note, url, meaningful_date,
        pinned, outdated, hidden, provenance, created_at, modified_at, allow_ai,
        interaction_id, link_source, group_note_copy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.hidden === null || input.hidden === undefined
        ? null
        : input.hidden
          ? 1
          : 0,
      input.provenance ?? "user",
      input.createdAt,
      input.now,
      allowAi,
      interactionId,
      linkSource,
      groupNoteCopy,
    ],
  );
  return result.lastInsertRowId;
}

/**
 * Toggle explicit AI permission for one Memory while the caller owns the
 * transaction.
 *
 * - A Group Note copy (`group_note_copy = 1`, linked or not) can never be
 *   switched on: `GroupNoteAiLockedError` (ADR-136; D-98, D-102).
 * - A memory whose `note` partner was moved into Off Limits can never be
 *   switched on: `InteractionNoteAiLockedError` (D-103).
 * - A `note`-linked memory has one switch with its interaction (D-49): the
 *   interaction's flag is set in the same transaction.
 * The UI never offers the two locked cases; these are backstops.
 */
export async function setMemoryAllowAiCore(
  exec: SqlExecutor,
  input: { id: number; contactId: number; allow: boolean; now: string },
): Promise<void> {
  const row = await exec.getFirstAsync<{
    group_note_copy: number;
    interaction_id: number | null;
    link_source: string | null;
    partner_locked: number;
  }>(
    `SELECT m.group_note_copy, m.interaction_id, m.link_source,
            COALESCE(i.note_ai_locked, 0) AS partner_locked
       FROM memories m
       LEFT JOIN interactions i
         ON i.id = m.interaction_id AND m.link_source = 'note'
      WHERE m.id = ? AND m.contact_id = ?`,
    [input.id, input.contactId],
  );
  if (!row) {
    assertOneChange("setMemoryAllowAi", input.id, input.contactId, 0);
    return;
  }
  if (input.allow && row.group_note_copy === 1) {
    throw new GroupNoteAiLockedError();
  }
  if (input.allow && row.partner_locked === 1) {
    throw new InteractionNoteAiLockedError();
  }
  const result = await exec.runAsync(
    `UPDATE memories
        SET allow_ai = ?, modified_at = ?
      WHERE id = ? AND contact_id = ?`,
    [input.allow ? 1 : 0, input.now, input.id, input.contactId],
  );
  assertOneChange(
    "setMemoryAllowAi",
    input.id,
    input.contactId,
    result.changes,
  );
  if (row.link_source === "note" && row.interaction_id !== null) {
    await setLinkedAllowAiCore(exec, {
      interactionId: row.interaction_id,
      allowAi: input.allow ? 1 : 0,
      now: input.now,
    });
  }
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
    interaction_id: number | null;
    link_source: string | null;
  }>(
    `SELECT type, custom_label, value, interaction_id, link_source
       FROM memories WHERE id = ? AND contact_id = ?`,
    [input.id, input.contactId],
  );
  if (!existing) {
    assertOneChange("editMemory", input.id, input.contactId, 0);
    return;
  }
  // Imported is not a move source or target (D-35, PLAN-MAP §5). Compare with
  // the STORED type: the Edit Contact aggregate sends the row's own type on
  // every edit, so an unchanged imported type must still save.
  if (
    input.type !== undefined &&
    input.type !== existing.type &&
    (input.type === "imported" || existing.type === "imported")
  ) {
    throw new ImportedTypeProvenanceError(
      "memories-dao: an imported memory cannot change type",
    );
  }

  const effectiveCustomLabel =
    input.customLabel === undefined
      ? existing.custom_label
      : normalizeOptional(input.customLabel);
  const effectiveValue =
    input.value === undefined ? existing.value : normalizeOptional(input.value);
  if (effectiveValue === null && effectiveCustomLabel === null) {
    throw new Error("memories-dao: memory value or custom label is required");
  }

  // Linked text (D-37, D-117): only a real change of the stored text counts.
  const textChanged =
    input.value !== undefined && effectiveValue !== existing.value;
  const linkedInteractionId = existing.interaction_id;
  if (
    textChanged &&
    linkedInteractionId !== null &&
    existing.link_source === "group_note"
  ) {
    // D-117: editing one person's Group Note copy detaches that copy only.
    // It keeps the edited text, group_note_copy 1 and allow_ai 0 (D-102);
    // the Group Note and every other copy are untouched (single writer of
    // group_events is the group-events DAO; checker W9).
    await unlinkGroupCopiesCore(exec, {
      interactionIds: [linkedInteractionId],
      now: input.now,
    });
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

  // D-37: a participant's own linked note (link_source 'note') changes on
  // both sides; the interaction writer propagates back to this row.
  if (
    textChanged &&
    linkedInteractionId !== null &&
    existing.link_source === "note"
  ) {
    await editInteractionNoteCore(exec, {
      interactionId: linkedInteractionId,
      contactId: input.contactId,
      note: effectiveValue,
      now: input.now,
    });
  }
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
    {
      entityType: "memory",
      entityUid: target.uid,
      deletedAt: target.deleted_at,
    },
    { bumpRevision: false },
  );
  const result = await exec.runAsync(
    "DELETE FROM memories WHERE id = ? AND contact_id = ? AND deleted_at IS NOT NULL",
    [id, contactId],
  );
  assertOneChange("purgeMemoryPermanently", id, contactId, result.changes);
}

const MEMORY_SNAPSHOT_COLUMNS = `m.id, m.uid, m.contact_id, m.type, m.custom_label, m.value,
       m.note, m.url, m.meaningful_date, m.pinned, m.outdated, m.hidden,
       m.provenance, m.created_at, m.modified_at, m.allow_ai, m.interaction_id,
       m.link_source, m.group_note_copy, i.uid AS interaction_uid`;

/**
 * Hard-delete one live Memory with a tombstone, returning the snapshot Undo
 * needs (D-69). Scoped by `(id, contact_id)`; a soft-deleted row is not a
 * target (it belongs to the trash lifecycle). The tombstone and
 * `tombstoned_at` use `deleteStampAt(now, row.modified_at)` (convergence c9).
 * `bumpRevision` (default true) is forwarded to the tombstone write; an
 * aggregate that bumps once itself passes false.
 */
export async function deleteMemoryNowCore(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string; bumpRevision?: boolean },
): Promise<MemorySnapshot> {
  const row = await exec.getFirstAsync<Omit<MemorySnapshot, "tombstoned_at">>(
    `SELECT ${MEMORY_SNAPSHOT_COLUMNS}
       FROM memories m
       LEFT JOIN interactions i ON i.id = m.interaction_id
      WHERE m.id = ? AND m.contact_id = ? AND m.deleted_at IS NULL`,
    [input.id, input.contactId],
  );
  if (!row) {
    assertOneChange("deleteMemoryNow", input.id, input.contactId, 0);
    throw new Error("deleteMemoryNow: unreachable");
  }
  const tombstonedAt = deleteStampAt(input.now, row.modified_at);
  await insertTombstoneCore(
    exec,
    { entityType: "memory", entityUid: row.uid, deletedAt: tombstonedAt },
    { bumpRevision: input.bumpRevision ?? true },
  );
  const result = await exec.runAsync(
    "DELETE FROM memories WHERE id = ? AND contact_id = ? AND deleted_at IS NULL",
    [input.id, input.contactId],
  );
  assertOneChange("deleteMemoryNow", input.id, input.contactId, result.changes);
  return { ...row, tombstoned_at: tombstonedAt };
}

/**
 * Re-insert a hard-deleted Memory from its snapshot (D-69): same uid, every
 * column (the D-102 marker included), `deleted_at` NULL written explicitly so
 * the row is live for every reader (G-D1), and a `modified_at` strictly newer
 * than its tombstone (F-D4). The old id is reused only when free (W6).
 *
 * The link comes back only through `resolveUndoLinkCore` (by uid, same
 * contact, free slot in both tables, non-blank source; F-D3, D-95, D-113),
 * and then re-syncs text and Allow AI from the source as it is now (D-37,
 * D-49; G-D2). Otherwise the memory returns unlinked with its own text.
 * Undo never writes the interaction or the event. Never bumps.
 */
export async function undoMemoryDeleteCore(
  exec: SqlExecutor,
  snapshot: MemorySnapshot,
  now: string,
): Promise<number> {
  const modifiedAt = undoModifiedAt(now, snapshot.tombstoned_at);
  const link = await resolveUndoLinkCore(exec, {
    interactionUid: snapshot.interaction_uid,
    linkSource: snapshot.link_source,
    contactId: snapshot.contact_id,
  });
  const groupNoteCopy = snapshot.group_note_copy === 1 ? 1 : 0;
  const value = link ? link.text : snapshot.value;
  const linkAllowAi = link ? link.allowAi : snapshot.allow_ai === 1 ? 1 : 0;
  const allowAi = groupNoteCopy === 1 ? 0 : linkAllowAi;
  const idFree =
    (await exec.getFirstAsync<{ one: number }>(
      "SELECT 1 AS one FROM memories WHERE id = ?",
      [snapshot.id],
    )) === null;
  const columns = [
    "uid",
    "contact_id",
    "type",
    "custom_label",
    "value",
    "note",
    "url",
    "meaningful_date",
    "pinned",
    "outdated",
    "hidden",
    "provenance",
    "created_at",
    "modified_at",
    "deleted_at",
    "allow_ai",
    "interaction_id",
    "link_source",
    "group_note_copy",
  ];
  const values: (string | number | null)[] = [
    snapshot.uid,
    snapshot.contact_id,
    snapshot.type,
    snapshot.custom_label,
    value,
    snapshot.note,
    snapshot.url,
    snapshot.meaningful_date,
    snapshot.pinned,
    snapshot.outdated,
    snapshot.hidden,
    snapshot.provenance,
    snapshot.created_at,
    modifiedAt,
    null,
    allowAi,
    link ? link.interactionId : null,
    link ? snapshot.link_source : null,
    groupNoteCopy,
  ];
  if (idFree) {
    columns.unshift("id");
    values.unshift(snapshot.id);
  }
  const result = await exec.runAsync(
    `INSERT INTO memories (${columns.join(", ")})
     VALUES (${columns.map(() => "?").join(", ")})`,
    values,
  );
  await deleteTombstoneCore(exec, {
    entityType: "memory",
    entityUid: snapshot.uid,
  });
  return idFree ? snapshot.id : result.lastInsertRowId;
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

/** Toggle explicit AI permission and mark the database dirty inside one mutex. */
export function setMemoryAllowAi(
  exec: SqlExecutor,
  input: { id: number; contactId: number; allow: boolean; now: string },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await setMemoryAllowAiCore(exec, input);
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

/**
 * Hard-delete one Memory with Undo support inside one mutex. The core's
 * tombstone write is the single revision bump.
 */
export function deleteMemoryNow(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string },
): Promise<MemorySnapshot> {
  return inWriteTransaction(exec, () => deleteMemoryNowCore(exec, input));
}

/** Undo a hard delete inside one mutex, bumping the revision once. */
export function undoMemoryDelete(
  exec: SqlExecutor,
  snapshot: MemorySnapshot,
  now: string,
): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await undoMemoryDeleteCore(exec, snapshot, now);
    await bumpDataRevisionCore(exec);
    return id;
  });
}
