import { NativeModule, registerWebModule } from "expo";

// Return-to-source is an Android-only capability (the app is Android-first).
// On web there is no host activity to finish, so finish() is a no-op.
class OrbitShareFinishModule extends NativeModule<Record<never, never>> {
  finish(): void {}
}

export default registerWebModule(OrbitShareFinishModule, "OrbitShareFinish");
