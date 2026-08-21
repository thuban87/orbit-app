/**
 * Typed JS wrapper over the native `orbit-secure-fetch` egress guard — the symbol
 * the Plan 02 Custom adapter calls instead of raw RN `fetch` (Phase 14, AI-01).
 *
 * Layered defense:
 *   1. `validateCustomEndpoint` (Plan 01, the URL-LITERAL layer) runs FIRST, so a
 *      non-HTTPS / credentialed / `.local` / private-IP-literal URL is refused
 *      before native is ever touched.
 *   2. The native module resolves the host ONCE, rejects any non-public resolved
 *      address (or numeric literal), pins the vetted IP, refuses redirects, and
 *      pins `Proxy.NO_PROXY` — the airtight connection-time guarantee that this
 *      JS layer cannot itself provide.
 *   3. Here again: the native `finalUrlHost` is re-checked against the requested
 *      host as belt-and-suspenders over the native redirect block.
 *
 * Errors are SANITIZED to stable codes — no endpoint URL, response body, headers,
 * or native exception text is ever surfaced (the message is the code itself).
 *
 * NOTE: the transport-level guarantees (HTTPS→private rejection, redirect
 * refusal, proxy pin) are NATIVE and are proven on-device in Plan 06; the
 * co-located node tests mock native and only prove this wrapper's own logic.
 */
import { validateCustomEndpoint } from "@/ai/custom-endpoint";
import { cancel as nativeCancel, request as nativeRequest } from "../../modules/orbit-secure-fetch";

/** Stable, sanitized failure taxonomy — safe to surface to the UI/logs. */
export type SecureFetchErrorCode =
  | "invalid_endpoint"
  | "unsupported_platform"
  | "private_address"
  | "redirect"
  | "transport"
  | "timeout"
  | "cancelled"
  | "host_mismatch";

/** A sanitized error — its `message` is exactly the `code`, never raw detail. */
export class SecureFetchError extends Error {
  readonly code: SecureFetchErrorCode;
  constructor(code: SecureFetchErrorCode) {
    super(code);
    this.code = code;
    this.name = "SecureFetchError";
  }
}

export interface SecureFetchInput {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export interface SecureFetchResult {
  status: number;
  ok: boolean;
  bodyText: string;
}

let requestSeq = 0;

/** Process-unique id used to key native cancellation. */
function generateRequestId(): string {
  requestSeq += 1;
  const rand = Math.random().toString(36).slice(2, 10);
  return `sf-${Date.now().toString(36)}-${requestSeq}-${rand}`;
}

/** Strip WHATWG URL bracket notation from an IPv6 hostname (`[::1]` -> `::1`). */
function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1)
    : host;
}

/** Map a native rejection to a stable sanitized code (no detail leaks). */
function mapNativeError(err: unknown): SecureFetchError {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  switch (code) {
    case "ERR_PRIVATE_ADDRESS":
      return new SecureFetchError("private_address");
    case "ERR_REDIRECT":
      return new SecureFetchError("redirect");
    case "ERR_TIMEOUT":
      return new SecureFetchError("timeout");
    case "ERR_CANCELLED":
      return new SecureFetchError("cancelled");
    case "ERR_INVALID_URL":
      return new SecureFetchError("invalid_endpoint");
    case "unsupported_platform":
      return new SecureFetchError("unsupported_platform");
    default:
      // Unknown native failure → generic transport; never echo the raw text.
      return new SecureFetchError("transport");
  }
}

/**
 * Perform a Custom-provider request through the native egress guard. Rejects with
 * a {@link SecureFetchError} on any validation/transport/redirect/private/abort
 * condition; resolves with the normalized response otherwise.
 */
export async function secureCustomFetch(
  input: SecureFetchInput,
): Promise<SecureFetchResult> {
  const { url, method = "POST", headers = {}, body, signal } = input;

  // 1. URL-literal validation up front — refuse before touching native.
  const validation = validateCustomEndpoint(url);
  if (!validation.ok || validation.url === "") {
    throw new SecureFetchError("invalid_endpoint");
  }

  // 2. An already-aborted signal must never issue a native request.
  if (signal?.aborted) {
    throw new SecureFetchError("cancelled");
  }

  const requestId = generateRequestId();
  const requestedHost = stripBrackets(
    new URL(validation.url).hostname,
  ).toLowerCase();

  let onAbort: (() => void) | undefined;

  try {
    const nativePromise = nativeRequest({
      requestId,
      url: validation.url,
      method,
      headers,
      body,
    });

    if (signal) {
      onAbort = () => {
        nativeCancel(requestId);
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }

    const result = await nativePromise;

    // 3. Defense-in-depth: the connected host must equal the requested host.
    if (stripBrackets(result.finalUrlHost).toLowerCase() !== requestedHost) {
      throw new SecureFetchError("host_mismatch");
    }

    return { status: result.status, ok: result.ok, bodyText: result.bodyText };
  } catch (err) {
    if (err instanceof SecureFetchError) throw err;
    // If the caller aborted, that wins regardless of how native surfaced it.
    if (signal?.aborted) throw new SecureFetchError("cancelled");
    throw mapNativeError(err);
  } finally {
    // Remove the listener on settlement so a later abort of the same signal does
    // NOT call native cancel for an already-settled request (no orphan tombstone).
    if (signal && onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}
