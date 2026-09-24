import { NativeModule, registerWebModule } from "expo";

import type { ConsumedBackupShare } from "..";

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
}

export default registerWebModule(
  OrbitBackupDocumentPickerModule,
  "OrbitBackupDocumentPicker",
);
