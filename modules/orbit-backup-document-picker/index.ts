import OrbitBackupDocumentPickerModule from "./src/OrbitBackupDocumentPickerModule";

export interface ConsumedBackupShare {
  readonly uri: string | null;
  readonly failed?: boolean;
}

/**
 * Consumes the one inbound backup document that Android granted through an
 * explicit Files-to-Orbit share. The native receiver copies it to app cache
 * on a background thread before this function returns its file URI.
 */
export function consumeSharedBackup(): Promise<ConsumedBackupShare> {
  return OrbitBackupDocumentPickerModule.consumeSharedBackup();
}

/** True while an explicitly shared JSON file is pending or ready. No I/O. */
export function hasSharedBackup(): boolean {
  return OrbitBackupDocumentPickerModule.hasSharedBackup();
}

/**
 * Direct Restore button path. Opens an in-task ACTION_GET_CONTENT picker (the
 * Pixel's DocumentsUI leaves ACTION_OPEN_DOCUMENT on a blank PickActivity) and
 * copies the one user-selected document to app cache. Resolves `{ uri: null }`
 * when the user cancels, or `{ uri: null, failed: true }` on copy failure.
 */
export function pickBackupDocument(): Promise<ConsumedBackupShare> {
  return OrbitBackupDocumentPickerModule.pickBackupDocument();
}
