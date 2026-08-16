import { NativeModule, requireNativeModule } from "expo";

declare class OrbitShareFinishModule extends NativeModule<
  Record<never, never>
> {
  // Plain Activity.finish() on the current activity (synchronous, void).
  finish(): void;
}

export default requireNativeModule<OrbitShareFinishModule>("OrbitShareFinish");
