import OrbitSecureFetchModule from "./src/OrbitSecureFetchModule";
import type {
  NativeSecureFetchInput,
  NativeSecureFetchResult,
} from "./src/OrbitSecureFetchModule";

export type { NativeSecureFetchInput, NativeSecureFetchResult };

/**
 * Thin typed pass-through over the native `orbit-secure-fetch` module (mirrors
 * `orbit-share-finish/index.ts`). All security policy lives natively (custom
 * Dns, redirect refusal, proxy pin); `src/ai/secure-fetch.ts` is the composed
 * wrapper the Custom adapter calls. Android-only — the `.web.ts` ref fails
 * closed with the `unsupported_platform` code.
 */
export function request(
  input: NativeSecureFetchInput,
): Promise<NativeSecureFetchResult> {
  return OrbitSecureFetchModule.request(input);
}

export function cancel(requestId: string): void {
  OrbitSecureFetchModule.cancel(requestId);
}
