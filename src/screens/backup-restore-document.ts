import { File } from "expo-file-system";

// D-19: match native MAX_BACKUP_INGRESS_BYTES (100 MiB, approved 2026-09-24).
export const MAX_RESTORE_DOCUMENT_BYTES = 104_857_600;

/** Restore copies belong to Orbit's cache and are consumed exactly once. */
export async function readRestoreDocument(uri: string): Promise<string> {
  const file = new File(uri);
  try {
    if (file.size > MAX_RESTORE_DOCUMENT_BYTES) {
      throw new Error("Backup ingress too large");
    }
    return await file.text();
  } finally {
    file.delete();
  }
}
