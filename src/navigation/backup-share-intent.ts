/** The exact MIME contract registered by withBackupRestoreShareIntent. */
const BACKUP_SHARE_MIME_TYPES = new Set(["application/json", "text/json"]);

export function isBackupShareIntent(input: {
  readonly type: string | null;
  readonly files: ReadonlyArray<{ readonly mimeType: string | null }> | null;
}): boolean {
  return input.type === "file" && (input.files ?? []).length === 1 &&
    BACKUP_SHARE_MIME_TYPES.has(input.files?.[0]?.mimeType?.toLowerCase() ?? "");
}
