import { NativeModule, registerWebModule } from "expo";
import type {
  LoopbackAttemptStart,
  LoopbackCallbackResult,
} from "./OrbitOpenRouterLoopbackModule";

function unsupported(): Error & { code: string } {
  const error = new Error("unsupported_platform") as Error & { code: string };
  error.code = "unsupported_platform";
  return error;
}

class OrbitOpenRouterLoopbackModule extends NativeModule<Record<never, never>> {
  async startAttempt(
    _state: string,
    _timeoutMs: number,
  ): Promise<LoopbackAttemptStart> {
    throw unsupported();
  }

  async awaitCallback(_attemptId: string): Promise<LoopbackCallbackResult> {
    throw unsupported();
  }

  async cancelAttempt(_attemptId: string): Promise<void> {}
}

export default registerWebModule(
  OrbitOpenRouterLoopbackModule,
  "OrbitOpenRouterLoopback",
);
