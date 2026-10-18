import { NativeModule, requireNativeModule } from "expo";

import type { ConsumedBackupShare, NativeBackupFolderEntry } from "..";

declare class OrbitBackupDocumentPickerModule extends NativeModule<
  Record<never, never>
> {
  consumeSharedBackup(): Promise<ConsumedBackupShare>;
  hasSharedBackup(): boolean;
  pickBackupDocument(): Promise<ConsumedBackupShare>;
  sampleProcessPssKb(): number | null;
  folderDisplayName(treeUri: string): Promise<string | null>;
  listFolderEntries(
    treeUri: string,
  ): Promise<readonly NativeBackupFolderEntry[] | null>;
  createFolderDocument(
    treeUri: string,
    displayName: string,
    mimeType: string,
  ): Promise<string>;
  writeDocumentText(documentUri: string, contents: string): Promise<void>;
  readDocumentText(documentUri: string): Promise<string>;
  deleteDocument(documentUri: string): Promise<void>;
}

export default requireNativeModule<OrbitBackupDocumentPickerModule>(
  "OrbitBackupDocumentPicker",
);
