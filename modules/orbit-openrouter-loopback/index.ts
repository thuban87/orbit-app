import type {
  LoopbackAttemptStart,
  LoopbackCallbackResult,
} from "./src/OrbitOpenRouterLoopbackModule";
import OrbitOpenRouterLoopbackModule from "./src/OrbitOpenRouterLoopbackModule";

export type { LoopbackAttemptStart, LoopbackCallbackResult };

export function startAttempt(
  state: string,
  timeoutMs: number,
): Promise<LoopbackAttemptStart> {
  return OrbitOpenRouterLoopbackModule.startAttempt(state, timeoutMs);
}

export function awaitCallback(
  attemptId: string,
): Promise<LoopbackCallbackResult> {
  return OrbitOpenRouterLoopbackModule.awaitCallback(attemptId);
}

export function cancelAttempt(attemptId: string): Promise<void> {
  return OrbitOpenRouterLoopbackModule.cancelAttempt(attemptId);
}
