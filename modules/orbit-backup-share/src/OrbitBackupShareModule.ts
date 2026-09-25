import { NativeModule, requireNativeModule } from "expo";

declare class OrbitBackupShareModule extends NativeModule<
  Record<never, never>
> {
  /** Open the chooser for a staged export; resolves when the chooser returns. */
  share(fileUri: string, mimeType: string, title: string): Promise<void>;
  /** Revoke any read grant made for a staged export before it is deleted. */
  revoke(fileUri: string): void;
}

export default requireNativeModule<OrbitBackupShareModule>("OrbitBackupShare");
