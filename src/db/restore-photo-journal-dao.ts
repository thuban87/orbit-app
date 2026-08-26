import type { SqlExecutor } from "@/db/types";

export type RestorePhotoJournalAction = "finalize" | "delete";
export type RestorePhotoJournalTargetKind = "contact" | "profile" | "customField";

export interface RestorePhotoJournalEntry {
  relativePath: string;
  action: RestorePhotoJournalAction;
  targetKind: RestorePhotoJournalTargetKind;
  contactUid: string | null;
  valueUid: string | null;
  fieldDefUid: string | null;
  canonicalRelativePath: string;
  createdAt: string;
}

/** Caller owns the outer restore transaction. */
export async function insertJournalEntryCore(exec: SqlExecutor, entry: RestorePhotoJournalEntry): Promise<void> {
  await exec.runAsync(
    `INSERT INTO restore_photo_journal
      (relative_path, action, target_kind, contact_uid, value_uid, field_def_uid, canonical_relative_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.relativePath, entry.action, entry.targetKind, entry.contactUid, entry.valueUid, entry.fieldDefUid, entry.canonicalRelativePath, entry.createdAt],
  );
}

export async function listJournalEntriesCore(exec: SqlExecutor): Promise<RestorePhotoJournalEntry[]> {
  const rows = await exec.getAllAsync<{
    relative_path: string; action: RestorePhotoJournalAction; target_kind: RestorePhotoJournalTargetKind;
    contact_uid: string | null; value_uid: string | null; field_def_uid: string | null;
    canonical_relative_path: string; created_at: string;
  }>(`SELECT relative_path, action, target_kind, contact_uid, value_uid, field_def_uid, canonical_relative_path, created_at
       FROM restore_photo_journal ORDER BY id`);
  return rows.map((row) => ({
    relativePath: row.relative_path, action: row.action, targetKind: row.target_kind,
    contactUid: row.contact_uid, valueUid: row.value_uid, fieldDefUid: row.field_def_uid,
    canonicalRelativePath: row.canonical_relative_path, createdAt: row.created_at,
  }));
}

/** Caller owns the transaction when cleanup must be coupled to another write. */
export async function deleteJournalEntryCore(exec: SqlExecutor, relativePath: string): Promise<void> {
  const result = await exec.runAsync("DELETE FROM restore_photo_journal WHERE relative_path = ?", [relativePath]);
  if (result.changes !== 1) throw new Error("restore photo journal row is missing");
}
