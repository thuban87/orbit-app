import { assertSafeRelative } from "@/db/photo-relative-path";
import type { SqlExecutor } from "@/db/types";

export type RestorePhotoJournalAction = "finalize" | "delete";
export type RestorePhotoJournalTargetKind =
  | "contact"
  | "profile"
  | "customField";

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
export async function insertJournalEntryCore(
  exec: SqlExecutor,
  entry: RestorePhotoJournalEntry,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO restore_photo_journal
      (relative_path, action, target_kind, contact_uid, value_uid, field_def_uid, canonical_relative_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.relativePath,
      entry.action,
      entry.targetKind,
      entry.contactUid,
      entry.valueUid,
      entry.fieldDefUid,
      entry.canonicalRelativePath,
      entry.createdAt,
    ],
  );
}

/** A later committed finalize supersedes older staged bytes for the same master. */
export async function insertFinalizeEntryCore(
  exec: SqlExecutor,
  entry: RestorePhotoJournalEntry,
): Promise<void> {
  if (entry.action !== "finalize")
    throw new Error("expected finalize journal entry");
  assertSafeRelative(entry.canonicalRelativePath);
  await exec.runAsync(
    "DELETE FROM restore_photo_journal WHERE action = 'finalize' AND canonical_relative_path = ?",
    [entry.canonicalRelativePath],
  );
  await insertJournalEntryCore(exec, entry);
}

export async function enqueueDeleteIntentCore(
  exec: SqlExecutor,
  canonical: string,
): Promise<void> {
  assertSafeRelative(canonical);
  await exec.runAsync(
    `INSERT INTO restore_photo_journal
      (relative_path, action, target_kind, contact_uid, value_uid, field_def_uid, canonical_relative_path, created_at)
     VALUES (?, 'delete', 'contact', NULL, NULL, NULL, ?, datetime('now'))
     ON CONFLICT(relative_path) DO NOTHING`,
    [`delete:${canonical}`, canonical],
  );
}

export async function listJournalForCanonicalCore(
  exec: SqlExecutor,
  canonical: string,
): Promise<Array<RestorePhotoJournalEntry & { id: number }>> {
  assertSafeRelative(canonical);
  return exec.getAllAsync<RestorePhotoJournalEntry & { id: number }>(
    `SELECT id, relative_path AS relativePath, action, target_kind AS targetKind,
      contact_uid AS contactUid, value_uid AS valueUid, field_def_uid AS fieldDefUid,
      canonical_relative_path AS canonicalRelativePath, created_at AS createdAt
     FROM restore_photo_journal WHERE canonical_relative_path = ? ORDER BY id`,
    [canonical],
  );
}

export async function retireJournalForCanonicalCore(
  exec: SqlExecutor,
  canonical: string,
): Promise<void> {
  assertSafeRelative(canonical);
  await exec.runAsync(
    "DELETE FROM restore_photo_journal WHERE action = 'finalize' AND canonical_relative_path = ?",
    [canonical],
  );
}

/** Any exact live reference protects a canonical file from deletion. */
export async function mayDeleteCanonicalCore(
  exec: SqlExecutor,
  canonical: string,
): Promise<boolean> {
  assertSafeRelative(canonical);
  const row = await exec.getFirstAsync<{ found: number }>(
    `SELECT 1 AS found FROM contacts WHERE photo = ?
     UNION ALL SELECT 1 FROM profile WHERE photo = ?
     UNION ALL SELECT 1 FROM custom_field_values WHERE value = ?
     UNION ALL SELECT 1 FROM restore_photo_journal WHERE action = 'finalize' AND canonical_relative_path = ?
     LIMIT 1`,
    [canonical, canonical, canonical, canonical],
  );
  return row === null;
}

export async function journalPathExistsCore(
  exec: SqlExecutor,
  relative: string,
): Promise<boolean> {
  return (
    (await exec.getFirstAsync(
      "SELECT 1 FROM restore_photo_journal WHERE relative_path = ?",
      [relative],
    )) !== null
  );
}

export async function listJournalEntriesCore(
  exec: SqlExecutor,
): Promise<RestorePhotoJournalEntry[]> {
  const rows = await exec.getAllAsync<{
    relative_path: string;
    action: RestorePhotoJournalAction;
    target_kind: RestorePhotoJournalTargetKind;
    contact_uid: string | null;
    value_uid: string | null;
    field_def_uid: string | null;
    canonical_relative_path: string;
    created_at: string;
  }>(`SELECT relative_path, action, target_kind, contact_uid, value_uid, field_def_uid, canonical_relative_path, created_at
       FROM restore_photo_journal ORDER BY id`);
  return rows.map((row) => ({
    relativePath: row.relative_path,
    action: row.action,
    targetKind: row.target_kind,
    contactUid: row.contact_uid,
    valueUid: row.value_uid,
    fieldDefUid: row.field_def_uid,
    canonicalRelativePath: row.canonical_relative_path,
    createdAt: row.created_at,
  }));
}

/** Caller owns the transaction when cleanup must be coupled to another write. */
export async function deleteJournalEntryCore(
  exec: SqlExecutor,
  relativePath: string,
): Promise<void> {
  const result = await exec.runAsync(
    "DELETE FROM restore_photo_journal WHERE relative_path = ?",
    [relativePath],
  );
  if (result.changes !== 1)
    throw new Error("restore photo journal row is missing");
}
