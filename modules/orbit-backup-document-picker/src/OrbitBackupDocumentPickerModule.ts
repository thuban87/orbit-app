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
}

export default requireNativeModule<OrbitBackupDocumentPickerModule>(
  "OrbitBackupDocumentPicker",
);
