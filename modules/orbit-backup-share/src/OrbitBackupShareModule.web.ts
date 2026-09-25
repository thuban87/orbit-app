import { NativeModule, registerWebModule } from "expo";

// Outbound backup sharing is Android-only.
class OrbitBackupShareModule extends NativeModule<Record<never, never>> {
  async share(): Promise<void> {
    throw new Error("unsupported_platform");
  }
  revoke(): void {}
}

export default registerWebModule(OrbitBackupShareModule, "OrbitBackupShare");
