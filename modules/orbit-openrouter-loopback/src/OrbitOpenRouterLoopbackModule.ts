import { NativeModule, requireNativeModule } from "expo";

export interface LoopbackAttemptStart {
  attemptId: string;
  callbackUrl: string;
}

export interface LoopbackCallbackResult {
  callbackUrl: string;
}

declare class OrbitOpenRouterLoopbackModule extends NativeModule<
  Record<never, never>
> {
  startAttempt(state: string, timeoutMs: number): Promise<LoopbackAttemptStart>;
  awaitCallback(attemptId: string): Promise<LoopbackCallbackResult>;
  cancelAttempt(attemptId: string): Promise<void>;
}

export default requireNativeModule<OrbitOpenRouterLoopbackModule>(
  "OrbitOpenRouterLoopback",
);
