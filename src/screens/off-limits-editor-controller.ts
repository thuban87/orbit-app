/**
 * The Off Limits editor's write boundary (Phase 38.10 D-08, D-11, D-69).
 *
 * Off Limits is its own table (migration 033); the DAO scopes every write by
 * `(id, contact_id)`. This controller adds the screen-side half of D-11: before
 * every edit and delete it re-reads the contact's Off Limits rows and refuses
 * an id that is not one of them, and an Undo only puts back a snapshot that
 * belongs to this contact. Ids are validated before any read.
 *
 * Every successful write calls `onChanged` so the screen re-reads its list. A
 * failed write calls `onError` with the operation and leaves the caller's
 * draft alone (add and edit resolve false).
 *
 * The snackbar builders are pure. Their wording is proposed (this plan only)
 * for the plan-19 wording review: verb first, naming the person (D-69;
 * 38.9 D-39/D-46 via D-19).
 */
import type {
  EditOffLimitsInput,
  NewOffLimitsInput,
  OffLimitsSnapshot,
} from "@/db/off-limits-dao";
import type { OffLimitsRow } from "@/db/off-limits-read";

export interface OffLimitsEditorDao {
  list: (contactId: number) => Promise<OffLimitsRow[]>;
  add: (input: NewOffLimitsInput) => Promise<number>;
  edit: (input: EditOffLimitsInput) => Promise<void>;
  delete: (input: {
    id: number;
    contactId: number;
    now: string;
  }) => Promise<OffLimitsSnapshot>;
  undo: (snapshot: OffLimitsSnapshot, now: string) => Promise<number>;
}

/** The fields an add or edit writes; blank is already null. */
export interface OffLimitsWriteFields {
  text: string | null;
  label: string | null;
  url: string | null;
}

export type OffLimitsEditorOp = "add" | "edit" | "delete" | "undo";

export interface OffLimitsEditorControllerOptions {
  contactId: number;
  dao: OffLimitsEditorDao;
  now: () => string;
  newUid: () => string;
  /** After every successful write; the screen re-reads its list. */
  onChanged: () => void;
  onError: (error: unknown, op: OffLimitsEditorOp) => void;
}

/** Thrown when an id is not one of this contact's Off Limits rows (D-11). */
export class OffLimitsScopeError extends Error {
  constructor(op: OffLimitsEditorOp, id: number) {
    super(`Off Limits ${op} target ${String(id)} is not in this collection`);
    this.name = "OffLimitsScopeError";
  }
}

function isValidId(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function createOffLimitsEditorController({
  contactId,
  dao,
  now,
  newUid,
  onChanged,
  onError,
}: OffLimitsEditorControllerOptions) {
  /** This contact's rows only, whatever the DAO returns. */
  const list = async (): Promise<OffLimitsRow[]> => {
    const rows = await dao.list(contactId);
    return rows.filter((row) => row.contact_id === contactId);
  };

  /** D-11: re-read before every edit and delete. */
  const allowedId = async (id: number): Promise<boolean> => {
    if (!isValidId(id)) return false;
    return (await list()).some((row) => row.id === id);
  };

  return {
    list,

    async onAdd(fields: OffLimitsWriteFields): Promise<boolean> {
      try {
        const timestamp = now();
        await dao.add({
          uid: newUid(),
          contactId,
          text: fields.text,
          label: fields.label,
          url: fields.url,
          now: timestamp,
        });
      } catch (error) {
        onError(error, "add");
        return false;
      }
      onChanged();
      return true;
    },

    async onEdit(id: number, fields: OffLimitsWriteFields): Promise<boolean> {
      try {
        if (!(await allowedId(id))) throw new OffLimitsScopeError("edit", id);
        await dao.edit({
          id,
          contactId,
          text: fields.text,
          label: fields.label,
          url: fields.url,
          now: now(),
        });
      } catch (error) {
        onError(error, "edit");
        return false;
      }
      onChanged();
      return true;
    },

    /** Deletes at once and returns the snapshot Undo needs (D-69). */
    async onDelete(id: number): Promise<OffLimitsSnapshot | null> {
      let snapshot: OffLimitsSnapshot;
      try {
        if (!(await allowedId(id))) throw new OffLimitsScopeError("delete", id);
        snapshot = await dao.delete({ id, contactId, now: now() });
      } catch (error) {
        onError(error, "delete");
        return null;
      }
      onChanged();
      return snapshot;
    },

    /** Puts a deleted row back; only this contact's snapshot (D-11). */
    async onUndo(snapshot: OffLimitsSnapshot): Promise<boolean> {
      try {
        if (snapshot.contact_id !== contactId) {
          throw new OffLimitsScopeError("undo", snapshot.id);
        }
        await dao.undo(snapshot, now());
      } catch (error) {
        onError(error, "undo");
        return false;
      }
      onChanged();
      return true;
    },
  };
}

export type OffLimitsEditorController = ReturnType<
  typeof createOffLimitsEditorController
>;

/** " for Ann", or "" while the person line has not loaded. */
function forName(name: string | null): string {
  return name === null || name.trim() === "" ? "" : ` for ${name}`;
}

/** Delete snackbar, verb first (D-69; proposed wording, plan-19 review). */
export function offLimitsDeletedSnackbar(name: string | null): string {
  return `Deleted Off Limits item${forName(name)}`;
}

/** The confirming snackbar after a delete's Undo (38.9 D-39; proposed). */
export function offLimitsRestoredSnackbar(name: string | null): string {
  return `Off Limits item restored${forName(name)}`;
}

/** Add snackbar (38.9 D-39: a write names the person; proposed). */
export function offLimitsAddedSnackbar(name: string | null): string {
  return `Added Off Limits item${forName(name)}`;
}

/** Save snackbar for an edited item (proposed). */
export function offLimitsSavedSnackbar(name: string | null): string {
  return `Saved Off Limits item${forName(name)}`;
}
