import { NativeModule, registerWebModule } from "expo";

import type { ConsumedBackupShare, NativeBackupFolderEntry } from "..";

class OrbitBackupDocumentPickerModule extends NativeModule<
  Record<never, never>
> {
  async consumeSharedBackup(): Promise<ConsumedBackupShare> {
    return { uri: null };
  }

  hasSharedBackup(): boolean {
    return false;
  }

  sampleProcessPssKb(): number | null {
    return null;
  }

  async pickBackupDocument(): Promise<ConsumedBackupShare> {
    return { uri: null };
  }

  async folderDisplayName(_treeUri: string): Promise<string | null> {
    return null;
  }

  async listFolderEntries(
    _treeUri: string,
  ): Promise<readonly NativeBackupFolderEntry[] | null> {
    return null;
  }
}

export default registerWebModule(
  OrbitBackupDocumentPickerModule,
  "OrbitBackupDocumentPicker",
);
