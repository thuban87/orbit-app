/**
 * Last Talked About / Current Location writers (KNOW-03 / KNOW-04; Phase
 * 38.10 D-41, D-45, D-47, D-48, D-69).
 *
 * Since migration 033 every entry is dated and none is flagged "current": Most
 * Recent is the first row in `currentStateOrderSql()` order (D-45, D-51), so
 * adding an entry is a plain insert and there is no promote step. A direct
 * entry stores a date only (`entry_time` NULL, D-48); a linked entry carries
 * its interaction's date and time.
 *
 * The shared write transaction is deliberately opened only by public wrappers.
 * Cores are composition primitives which assume their caller already owns BEGIN;
 * keeping that split prevents nesting the non-reentrant write mutex.
 *
 * Revision bumps (PLAN-MAP §5): every wrapper advances `data_revision` by
 * exactly 1. `deleteCurrentStateEntryCore` forwards `bumpRevision` (default
 * true) to its tombstone write; an aggregate that bumps once itself (the move
 * DAO) passes false.
 */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { entryDateTimeOf, normalizeEntryTime } from "@/db/linked-entry-dao";
import {
  type CurrentStateFieldKey,
  isCurrentStateFieldKey,
} from "@/db/memory-registry";
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

export interface SetCurrentStateValueInput {
  contactId: number;
  fieldKey: CurrentStateFieldKey;
  value: string;
  /** Local `localDateTime` stamp. */
  now: string;
  /** Local `YYYY-MM-DD`; defaults to the date part of `now` (D-41). */
  entryDate?: string;
}

/** A full insert: the date-picker add, a linked copy, or a move's destination. */
export interface AddCurrentStateEntryInput {
  contactId: number;
  fieldKey: CurrentStateFieldKey;
  value: string;
  /** Local `YYYY-MM-DD` the entry is about (D-41). */
  entryDate: string;
  /** `HH:MM:SS` (a bare `HH:MM` is padded); NULL for a direct entry (D-48). */
  entryTime?: string | null;
  url?: string | null;
  interactionId?: number | null;
  linkSource?: LinkSource | null;
  /** D-102 Group Note copy marker; default 0. */
  groupNoteCopy?: 0 | 1;
  /** D-108 share-origin marker; default 0. */
  fromShare?: 0 | 1;
  /** Defaults to `now`; a move keeps the source's creation time (D-108). */
  createdAt?: string;
  now: string;
}

export interface EditHistoryEntryInput {
  contactId: number;
  fieldKey: CurrentStateFieldKey;
  entryId: number;
  value: string;
  now: string;
  /** Local `YYYY-MM-DD`; omitted keeps the stored date. */
  entryDate?: string;
  /** Omitted keeps the stored url; null clears it. */
  url?: string | null;
}

/**
 * Everything a hard-deleted entry needs to come back on Undo: every column,
 * the tombstone stamp as `tombstoned_at` (convergence c2 G-D1; this table has
 * no `deleted_at` column, but every snapshot in the phase uses one name) and,
 * when linked, the interaction's uid (ids are never trusted across the Undo
 * window; F-D3).
 */
export interface CurrentStateSnapshot {
  id: number;
  uid: string;
  contact_id: number;
  field_key: string;
  value: string;
  entry_date: string;
  entry_time: string | null;
  url: string | null;
  interaction_id: number | null;
  link_source: string | null;
  group_note_copy: number;
  from_share: number;
  created_at: string;
  modified_at: string;
  interaction_uid: string | null;
  tombstoned_at: string;
}

const ENTRY_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function assertFieldKey(fieldKey: string): void {
  if (!isCurrentStateFieldKey(fieldKey)) {
    throw new Error("current-state-history-dao: unknown field_key");
  }
}

function assertMeaningfulValue(value: string): void {
  if (value.trim().length === 0) {
    throw new Error("current-state-history-dao: value must not be blank");
  }
}

function assertEntryDate(value: string): void {
  if (!ENTRY_DATE.test(value)) {
    throw new Error(
      `current-state-history-dao: entry date must be YYYY-MM-DD (got ${value})`,
    );
  }
}

function assertMarker(name: string, value: number): void {
  if (value !== 0 && value !== 1) {
    throw new Error(`current-state-history-dao: ${name} must be 0 or 1`);
  }
}

function assertOneChange(op: string, changes: number): void {
  if (changes !== 1) {
    throw new Error(
      `${op}: no current-state entry matched (changed ${changes})`,
    );
  }
}

function blankToNull(value: string | null | undefined): string | null {
  return value === null || value === undefined || value.trim().length === 0
    ? null
    : value;
}

// `normalizeEntryTime` / `entryDateTimeOf` live in linked-entry-dao (the
// linked copies need them and that module may import no DAO); re-exported
// here so every existing caller keeps its import.
export { entryDateTimeOf, normalizeEntryTime };

/** Insert one dated entry while the caller owns the transaction. Never bumps. */
export async function addCurrentStateEntryCore(
  exec: SqlExecutor,
  input: AddCurrentStateEntryInput,
): Promise<number> {
  assertFieldKey(input.fieldKey);
  assertMeaningfulValue(input.value);
  assertEntryDate(input.entryDate);
  const entryTime =
    input.entryTime === null || input.entryTime === undefined
      ? null
      : normalizeEntryTime(input.entryTime);
  const interactionId = input.interactionId ?? null;
  const linkSource = input.linkSource ?? null;
  // Mirrors migration 033's one-directional link CHECK.
  if (interactionId !== null && linkSource === null) {
    throw new Error(
      "current-state-history-dao: a linked entry needs its linkSource",
    );
  }
  const groupNoteCopy = input.groupNoteCopy ?? 0;
  const fromShare = input.fromShare ?? 0;
  assertMarker("groupNoteCopy", groupNoteCopy);
  assertMarker("fromShare", fromShare);

  const inserted = await exec.runAsync(
    `INSERT INTO current_state_entries
       (uid, contact_id, field_key, value, entry_date, entry_time, url,
        interaction_id, link_source, group_note_copy, from_share,
        created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUid(),
      input.contactId,
      input.fieldKey,
      input.value,
      input.entryDate,
      entryTime,
      blankToNull(input.url),
      interactionId,
      linkSource,
      groupNoteCopy,
      fromShare,
      input.createdAt ?? input.now,
      input.now,
    ],
  );
  return inserted.lastInsertRowId;
}

/**
 * Add a new direct entry (the earlier entries are kept as history). A plain
 * insert dated `entryDate`, else the date part of `now`, with no time (D-48).
 * Caller owns the transaction.
 */
export function setCurrentStateValueCore(
  exec: SqlExecutor,
  input: SetCurrentStateValueInput,
): Promise<number> {
  return addCurrentStateEntryCore(exec, {
    contactId: input.contactId,
    fieldKey: input.fieldKey,
    value: input.value,
    entryDate: input.entryDate ?? input.now.slice(0, 10),
    entryTime: null,
    now: input.now,
  });
}

/** Set a standalone value and advance the durable data revision once. */
export function setCurrentStateValue(
  exec: SqlExecutor,
  input: SetCurrentStateValueInput,
): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await setCurrentStateValueCore(exec, input);
    await bumpDataRevisionCore(exec);
    return id;
  });
}

/** Add one dated entry and advance the durable data revision once. */
export function addCurrentStateEntry(
  exec: SqlExecutor,
  input: AddCurrentStateEntryInput,
): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await addCurrentStateEntryCore(exec, input);
    await bumpDataRevisionCore(exec);
    return id;
  });
}

/**
 * Update a stored entry in place. The three-key scope intentionally fails
 * closed if a route's field key does not match the supplied entry id.
 */
export async function editHistoryEntryCore(
  exec: SqlExecutor,
  input: EditHistoryEntryInput,
): Promise<void> {
  assertFieldKey(input.fieldKey);
  assertMeaningfulValue(input.value);
  if (input.entryDate !== undefined) assertEntryDate(input.entryDate);

  const sets = ["value = ?"];
  const params: (string | number | null)[] = [input.value];
  if (input.entryDate !== undefined) {
    sets.push("entry_date = ?");
    params.push(input.entryDate);
  }
  if (input.url !== undefined) {
    sets.push("url = ?");
    params.push(blankToNull(input.url));
  }
  sets.push("modified_at = ?");
  params.push(input.now);

  const updated = await exec.runAsync(
    `UPDATE current_state_entries
        SET ${sets.join(", ")}
      WHERE id = ? AND contact_id = ? AND field_key = ?`,
    [...params, input.entryId, input.contactId, input.fieldKey],
  );
  assertOneChange("editHistoryEntry", updated.changes);
}

/** Edit a single entry inside one write. */
export function editHistoryEntry(
  exec: SqlExecutor,
  input: EditHistoryEntryInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await editHistoryEntryCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Hard-delete one entry with a `current_state_entry` tombstone, returning the
 * snapshot Undo needs (D-69). Scoped by `(id, contact_id)`. The tombstone and
 * `tombstoned_at` use `deleteStampAt(now, row.modified_at)`, so a delete right
 * after an Undo never stamps older than the row (convergence c9).
 */
export async function deleteCurrentStateEntryCore(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string; bumpRevision?: boolean },
): Promise<CurrentStateSnapshot> {
  const row = await exec.getFirstAsync<
    Omit<CurrentStateSnapshot, "tombstoned_at">
  >(
    `SELECT s.id, s.uid, s.contact_id, s.field_key, s.value, s.entry_date,
            s.entry_time, s.url, s.interaction_id, s.link_source,
            s.group_note_copy, s.from_share, s.created_at, s.modified_at,
            i.uid AS interaction_uid
       FROM current_state_entries s
       LEFT JOIN interactions i ON i.id = s.interaction_id
      WHERE s.id = ? AND s.contact_id = ?`,
    [input.id, input.contactId],
  );
  if (!row) {
    throw new Error(
      `deleteCurrentStateEntry: no current-state entry matched id=${input.id} for contactId=${input.contactId} (changed 0)`,
    );
  }
  const tombstonedAt = deleteStampAt(input.now, row.modified_at);
  await insertTombstoneCore(
    exec,
    {
      entityType: "current_state_entry",
      entityUid: row.uid,
      deletedAt: tombstonedAt,
    },
    { bumpRevision: input.bumpRevision ?? true },
  );
  const result = await exec.runAsync(
    "DELETE FROM current_state_entries WHERE id = ? AND contact_id = ?",
    [input.id, input.contactId],
  );
  assertOneChange("deleteCurrentStateEntry", result.changes);
  return { ...row, tombstoned_at: tombstonedAt };
}

/**
 * Re-insert a deleted entry from its snapshot (D-69): same uid, every column
 * (the D-102 / D-108 markers included), and a `modified_at` strictly newer
 * than its tombstone (F-D4). The old id is reused only when free (W6).
 *
 * The link comes back only through `resolveUndoLinkCore` (by uid, same
 * contact, slot free in both entry tables, non-blank source; F-D3). A
 * restored link re-syncs text, date and time from the source as it is now
 * (G-D2); otherwise the entry returns unlinked with its snapshot text and
 * dates. Never writes an interaction. Never bumps.
 */
export async function undoCurrentStateEntryDeleteCore(
  exec: SqlExecutor,
  snapshot: CurrentStateSnapshot,
  now: string,
): Promise<number> {
  const modifiedAt = undoModifiedAt(now, snapshot.tombstoned_at);
  const link = await resolveUndoLinkCore(exec, {
    interactionUid: snapshot.interaction_uid,
    linkSource: snapshot.link_source,
    contactId: snapshot.contact_id,
  });
  const linkedAt = link ? entryDateTimeOf(link.occurredAt) : null;
  const idFree =
    (await exec.getFirstAsync<{ one: number }>(
      "SELECT 1 AS one FROM current_state_entries WHERE id = ?",
      [snapshot.id],
    )) === null;
  const columns = [
    "uid",
    "contact_id",
    "field_key",
    "value",
    "entry_date",
    "entry_time",
    "url",
    "interaction_id",
    "link_source",
    "group_note_copy",
    "from_share",
    "created_at",
    "modified_at",
  ];
  const values: (string | number | null)[] = [
    snapshot.uid,
    snapshot.contact_id,
    snapshot.field_key,
    link ? link.text : snapshot.value,
    linkedAt ? linkedAt.entryDate : snapshot.entry_date,
    linkedAt ? linkedAt.entryTime : snapshot.entry_time,
    snapshot.url,
    link ? link.interactionId : null,
    link ? snapshot.link_source : null,
    snapshot.group_note_copy === 1 ? 1 : 0,
    snapshot.from_share === 1 ? 1 : 0,
    snapshot.created_at,
    modifiedAt,
  ];
  if (idFree) {
    columns.unshift("id");
    values.unshift(snapshot.id);
  }
  const result = await exec.runAsync(
    `INSERT INTO current_state_entries (${columns.join(", ")})
     VALUES (${columns.map(() => "?").join(", ")})`,
    values,
  );
  await deleteTombstoneCore(exec, {
    entityType: "current_state_entry",
    entityUid: snapshot.uid,
  });
  return idFree ? snapshot.id : result.lastInsertRowId;
}

/** Hard-delete one entry inside one mutex; the tombstone write is the bump. */
export function deleteCurrentStateEntry(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string },
): Promise<CurrentStateSnapshot> {
  return inWriteTransaction(exec, () =>
    deleteCurrentStateEntryCore(exec, input),
  );
}

/** Undo a delete inside one mutex, bumping the revision once. */
export function undoCurrentStateEntryDelete(
  exec: SqlExecutor,
  snapshot: CurrentStateSnapshot,
  now: string,
): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await undoCurrentStateEntryDeleteCore(exec, snapshot, now);
    await bumpDataRevisionCore(exec);
    return id;
  });
}
