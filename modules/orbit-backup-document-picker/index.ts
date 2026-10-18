import OrbitBackupDocumentPickerModule from "./src/OrbitBackupDocumentPickerModule";

export interface ConsumedBackupShare {
  readonly uri: string | null;
  readonly failed?: boolean;
  /**
   * D-117: the source was refused as not a content:// link, so it is not a
   * backup Orbit can read; "try again" can never succeed (38.12 review B-IN-01).
   */
  readonly notBackup?: boolean;
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

/** One child of the backup folder, as the document provider names it. */
export interface NativeBackupFolderEntry {
  readonly uri: string;
  readonly name: string | null;
  readonly mimeType: string | null;
}

/**
 * The backup folder's own display name from its document provider (38.12
 * D-143), or null when the provider cannot answer. Works for Google Drive,
 * whose tree ids are opaque.
 */
export function readBackupFolderDisplayName(
  treeUri: string,
): Promise<string | null> {
  return OrbitBackupDocumentPickerModule.folderDisplayName(treeUri);
}

/**
 * The backup folder's children with their provider display names (38.12
 * review A-WR-02), or null when the listing failed. The URIs are the ones
 * expo-file-system's SAF readDirectoryAsync returns for the same folder.
 */
export function listBackupFolderEntries(
  treeUri: string,
): Promise<readonly NativeBackupFolderEntry[] | null> {
  return OrbitBackupDocumentPickerModule.listFolderEntries(treeUri);
}

/**
 * 38.12 D-158: create a document in the backup folder (named in full, ".json"
 * included) and return its URI. Uses DocumentsContract, so any document
 * provider works, Google Drive included. Rejects on failure.
 */
export function createBackupFolderDocument(
  treeUri: string,
  displayName: string,
  mimeType: string,
): Promise<string> {
  return OrbitBackupDocumentPickerModule.createFolderDocument(
    treeUri,
    displayName,
    mimeType,
  );
}

/** D-158: write UTF-8 text to a backup-folder document. Rejects on failure. */
export function writeBackupFolderDocument(
  documentUri: string,
  contents: string,
): Promise<void> {
  return OrbitBackupDocumentPickerModule.writeDocumentText(
    documentUri,
    contents,
  );
}

/** D-158: read a backup-folder document as UTF-8 text. Rejects on failure. */
export function readBackupFolderDocument(documentUri: string): Promise<string> {
  return OrbitBackupDocumentPickerModule.readDocumentText(documentUri);
}

/** D-158: delete a backup-folder document. Rejects on failure. */
export function deleteBackupFolderDocument(documentUri: string): Promise<void> {
  return OrbitBackupDocumentPickerModule.deleteDocument(documentUri);
}

/** Debug-only, point-in-time Android process PSS for the synthetic ingress probe. */
export function sampleBackupProcessPssKb(): number | null {
  return OrbitBackupDocumentPickerModule.sampleProcessPssKb();
}
