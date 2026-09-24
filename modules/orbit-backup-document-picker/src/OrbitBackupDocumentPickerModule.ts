import { NativeModule, requireNativeModule } from "expo";

import type { ConsumedBackupShare } from "..";

declare class OrbitBackupDocumentPickerModule extends NativeModule<
  Record<never, never>
> {
  consumeSharedBackup(): Promise<ConsumedBackupShare>;
  hasSharedBackup(): boolean;
  pickBackupDocument(): Promise<ConsumedBackupShare>;
  sampleProcessPssKb(): number | null;
}

export default requireNativeModule<OrbitBackupDocumentPickerModule>(
  "OrbitBackupDocumentPicker",
);
