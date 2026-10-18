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

  async createFolderDocument(
    _treeUri: string,
    _displayName: string,
    _mimeType: string,
  ): Promise<string> {
    throw new Error("Backup folders are not available on the web.");
  }

  async writeDocumentText(_documentUri: string, _contents: string) {
    throw new Error("Backup folders are not available on the web.");
  }

  async readDocumentText(_documentUri: string): Promise<string> {
    throw new Error("Backup folders are not available on the web.");
  }

  async deleteDocument(_documentUri: string) {
    throw new Error("Backup folders are not available on the web.");
  }
}

export default registerWebModule(
  OrbitBackupDocumentPickerModule,
  "OrbitBackupDocumentPicker",
);
