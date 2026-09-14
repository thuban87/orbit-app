import type { SqlExecutor } from "@/db/types";

export interface RestoreBackgroundJournalEntry {
  readonly relativePath: string;
  readonly templateUid: string;
  readonly templateModifiedAt: string;
  readonly canonicalRelativePath: string;
  readonly createdAt: string;
}

/** Caller owns the restore transaction. */
export async function insertBackgroundJournalEntryCore(
  exec: SqlExecutor,
  entry: RestoreBackgroundJournalEntry,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO restore_background_journal
      (relative_path,template_uid,template_modified_at,canonical_relative_path,created_at)
     VALUES (?,?,?,?,?)`,
    [
      entry.relativePath,
      entry.templateUid,
      entry.templateModifiedAt,
      entry.canonicalRelativePath,
      entry.createdAt,
    ],
  );
}

export async function listBackgroundJournalEntries(
  exec: SqlExecutor,
): Promise<RestoreBackgroundJournalEntry[]> {
  const rows = await exec.getAllAsync<{
    relative_path: string;
    template_uid: string;
    template_modified_at: string;
    canonical_relative_path: string;
    created_at: string;
  }>(
    `SELECT relative_path,template_uid,template_modified_at,canonical_relative_path,created_at
       FROM restore_background_journal ORDER BY relative_path`,
  );
  return rows.map((row) => ({
    relativePath: row.relative_path,
    templateUid: row.template_uid,
    templateModifiedAt: row.template_modified_at,
    canonicalRelativePath: row.canonical_relative_path,
    createdAt: row.created_at,
  }));
}

export async function deleteBackgroundJournalEntry(
  exec: SqlExecutor,
  relativePath: string,
): Promise<void> {
  await exec.runAsync(
    "DELETE FROM restore_background_journal WHERE relative_path=?",
    [relativePath],
  );
}
