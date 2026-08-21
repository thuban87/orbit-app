import { NativeModule, registerWebModule } from "expo";

import type {
  NativeSecureFetchInput,
  NativeSecureFetchResult,
} from "./OrbitSecureFetchModule";

// The airtight egress guard is an Android-only capability (the app is
// Android-first, and the guarantee is provided by a native OkHttp Dns/redirect
// policy that has no web equivalent). On web there is no safe transport, so the
// module fails closed: `request` rejects with the unsupported-platform code and
// `cancel` is a no-op. `secureCustomFetch` maps this code to a stable error.
class OrbitSecureFetchModule extends NativeModule<Record<never, never>> {
  async request(_input: NativeSecureFetchInput): Promise<NativeSecureFetchResult> {
    const err = new Error("unsupported_platform") as Error & { code: string };
    err.code = "unsupported_platform";
    throw err;
  }

  cancel(_requestId: string): void {}
}

export default registerWebModule(OrbitSecureFetchModule, "OrbitSecureFetch");
