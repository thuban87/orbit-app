import { NativeModule, requireNativeModule } from "expo";

/** Shape sent to the native `request` async function. */
export interface NativeSecureFetchInput {
  requestId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/** Shape returned by the native `request` async function on success. */
export interface NativeSecureFetchResult {
  status: number;
  ok: boolean;
  bodyText: string;
  finalUrlHost: string;
}

declare class OrbitSecureFetchModule extends NativeModule<Record<never, never>> {
  // Connection-time egress guard: resolves the host once, rejects any non-public
  // resolved address (or numeric-literal), pins the vetted IP, refuses redirects.
  request(input: NativeSecureFetchInput): Promise<NativeSecureFetchResult>;
  // Cancel an in-flight request by id (records a tombstone if the Call has not
  // been registered yet, so a cancel racing ahead of enqueue still aborts).
  cancel(requestId: string): void;
}

export default requireNativeModule<OrbitSecureFetchModule>("OrbitSecureFetch");
