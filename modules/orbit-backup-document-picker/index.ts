import OrbitBackupDocumentPickerModule from "./src/OrbitBackupDocumentPickerModule";

export interface ConsumedBackupShare {
  readonly uri: string | null;
}

/**
 * Consumes the one inbound backup document that Android granted through an
 * explicit Files-to-Orbit share. The native receiver copies it to app cache
 * before this function returns its file URI.
 */
export function consumeSharedBackup(): Promise<ConsumedBackupShare> {
  return OrbitBackupDocumentPickerModule.consumeSharedBackup();
}

/** True only after Android has copied an explicitly shared JSON file to cache. */
export function hasSharedBackup(): boolean {
  return OrbitBackupDocumentPickerModule.hasSharedBackup();
}

/**
 * Direct Restore button path. Opens an in-task ACTION_GET_CONTENT picker (the
 * Pixel's DocumentsUI leaves ACTION_OPEN_DOCUMENT on a blank PickActivity) and
 * copies the one user-selected document to app cache. Resolves `{ uri: null }`
 * when the user cancels or the copy fails.
 */
export function pickBackupDocument(): Promise<ConsumedBackupShare> {
  return OrbitBackupDocumentPickerModule.pickBackupDocument();
}
