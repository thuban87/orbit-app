/**
 * OpenRouter browser authorization — PKCE S256 plus a temporary loopback
 * callback. OpenRouter receives only the dynamic 127.0.0.1 URL. The custom
 * scheme is a credential-free wake signal after native validation succeeds.
 * Attempt material stays in memory; only the returned key reaches SecureStore.
 */
import { aiKeyStore } from "@/services/ai-key-store";
import type { AiCloudProviderId } from "@/services/ai-types";

export const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
export const OPENROUTER_KEY_EXCHANGE_URL =
  "https://openrouter.ai/api/v1/auth/keys";
export const OPENROUTER_WAKE_URI = "orbit://openrouter-auth";
/** Owner-tunable maximum lifetime for one browser authorization attempt. */
export const OPENROUTER_ATTEMPT_TIMEOUT_MS = 120_000;

const PKCE_RANDOM_BYTES = 32;
const STATE_RANDOM_BYTES = 24;
const ALLOWED_CALLBACK_PARAMS = new Set(["code", "state"]);

export interface OpenRouterCrypto {
  randomBytes(length: number): Promise<Uint8Array>;
  sha256Base64(input: string): Promise<string>;
}

export interface OpenRouterPkce {
  verifier: string;
  challenge: string;
  state: string;
}

export type OpenRouterCallbackResult =
  | { ok: true; code: string }
  | {
      ok: false;
      reason:
        | "already-consumed"
        | "invalid-url"
        | "wrong-destination"
        | "unexpected-params"
        | "missing-code"
        | "missing-state"
        | "mismatched-state";
    };

export interface OpenRouterBrowserResult {
  readonly type: string;
  readonly url?: string;
}

export type OpenRouterBrowserOpener = (
  authUrl: string,
  redirectUrl: string,
) => Promise<OpenRouterBrowserResult>;

export interface OpenRouterLoopbackStart {
  readonly attemptId: string;
  readonly callbackUrl: string;
}

export interface OpenRouterLoopbackResult {
  readonly callbackUrl: string;
}

export interface OpenRouterLoopback {
  startAttempt(
    state: string,
    timeoutMs: number,
  ): Promise<OpenRouterLoopbackStart>;
  awaitCallback(attemptId: string): Promise<OpenRouterLoopbackResult>;
  cancelAttempt(attemptId: string): Promise<void>;
}

export interface OpenRouterExchangeResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type OpenRouterFetch = (
  url: string,
  init: {
    method: "POST";
    headers: { "Content-Type": "application/json" };
    body: string;
    signal?: AbortSignal;
  },
) => Promise<OpenRouterExchangeResponse>;

export interface ConnectOpenRouterDeps {
  readonly crypto?: OpenRouterCrypto;
  readonly loopback?: OpenRouterLoopback;
  readonly opener?: OpenRouterBrowserOpener;
  readonly fetchImpl?: OpenRouterFetch;
  readonly setKey?: (provider: AiCloudProviderId, key: string) => Promise<void>;
  readonly signal?: AbortSignal;
}

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const hasB = index + 1 < bytes.length;
    const hasC = index + 2 < bytes.length;
    const b = hasB ? bytes[index + 1] : 0;
    const c = hasC ? bytes[index + 2] : 0;
    const packed = (a << 16) | (b << 8) | c;
    result += BASE64_ALPHABET[(packed >>> 18) & 63];
    result += BASE64_ALPHABET[(packed >>> 12) & 63];
    result += hasB ? BASE64_ALPHABET[(packed >>> 6) & 63] : "=";
    result += hasC ? BASE64_ALPHABET[packed & 63] : "=";
  }
  return result;
}

function base64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const nativeCrypto: OpenRouterCrypto = {
  async randomBytes(length: number): Promise<Uint8Array> {
    const crypto = await import("expo-crypto");
    return crypto.getRandomBytesAsync(length);
  },
  async sha256Base64(input: string): Promise<string> {
    const crypto = await import("expo-crypto");
    return crypto.digestStringAsync(
      crypto.CryptoDigestAlgorithm.SHA256,
      input,
      {
        encoding: crypto.CryptoEncoding.BASE64,
      },
    );
  },
};

const nativeBrowserOpener: OpenRouterBrowserOpener = async (
  authUrl,
  redirectUrl,
) => {
  const browser = await import("expo-web-browser");
  return browser.openAuthSessionAsync(authUrl, redirectUrl);
};

const nativeLoopback: OpenRouterLoopback = {
  async startAttempt(state, timeoutMs) {
    const module = await import("../../modules/orbit-openrouter-loopback");
    return module.startAttempt(state, timeoutMs);
  },
  async awaitCallback(attemptId) {
    const module = await import("../../modules/orbit-openrouter-loopback");
    return module.awaitCallback(attemptId);
  },
  async cancelAttempt(attemptId) {
    const module = await import("../../modules/orbit-openrouter-loopback");
    await module.cancelAttempt(attemptId);
  },
};

const nativeFetch: OpenRouterFetch = async (url, init) => fetch(url, init);

export class OpenRouterConnectionError extends Error {
  constructor() {
    super("openrouter_connection_failed");
    this.name = "OpenRouterConnectionError";
  }
}

export async function generateOpenRouterPkce(
  crypto: OpenRouterCrypto = nativeCrypto,
): Promise<OpenRouterPkce> {
  const verifier = base64Url(
    bytesToBase64(await crypto.randomBytes(PKCE_RANDOM_BYTES)),
  );
  const state = base64Url(
    bytesToBase64(await crypto.randomBytes(STATE_RANDOM_BYTES)),
  );
  const challenge = base64Url(await crypto.sha256Base64(verifier));
  return { verifier, challenge, state };
}

/** Build OpenRouter's request around the already-bound dynamic callback. */
export function buildOpenRouterAuthUrl(input: {
  challenge: string;
  callbackUrl: string;
}): string {
  const url = new URL(OPENROUTER_AUTH_URL);
  url.searchParams.set("callback_url", input.callbackUrl);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

/** Independently validate the native callback before exposing its code. */
export function validateOpenRouterCallback(
  callbackUrl: string,
  expectedRedirect: string,
  expectedState: string,
  consumed = false,
): OpenRouterCallbackResult {
  if (consumed) return { ok: false, reason: "already-consumed" };

  let callback: URL;
  let expected: URL;
  try {
    callback = new URL(callbackUrl);
    expected = new URL(expectedRedirect);
  } catch {
    return { ok: false, reason: "invalid-url" };
  }

  if (
    callback.protocol !== "http:" ||
    callback.protocol !== expected.protocol ||
    callback.hostname !== "127.0.0.1" ||
    callback.hostname !== expected.hostname ||
    callback.port === "" ||
    callback.port !== expected.port ||
    callback.pathname !== "/openrouter-auth" ||
    callback.pathname !== expected.pathname ||
    callback.username !== "" ||
    callback.password !== "" ||
    callback.hash !== ""
  ) {
    return { ok: false, reason: "wrong-destination" };
  }

  for (const key of callback.searchParams.keys()) {
    if (!ALLOWED_CALLBACK_PARAMS.has(key)) {
      return { ok: false, reason: "unexpected-params" };
    }
  }
  const codes = callback.searchParams.getAll("code");
  const states = callback.searchParams.getAll("state");
  if (codes.length !== 1 || codes[0] === "") {
    return { ok: false, reason: "missing-code" };
  }
  if (states.length === 0 || states[0] === "") {
    return { ok: false, reason: "missing-state" };
  }
  if (states.length !== 1 || states[0] !== expectedState) {
    return { ok: false, reason: "mismatched-state" };
  }
  return { ok: true, code: codes[0] };
}

function validateWake(result: OpenRouterBrowserResult): boolean {
  if (result.type !== "success" || typeof result.url !== "string") return false;
  try {
    const wake = new URL(result.url);
    const expected = new URL(OPENROUTER_WAKE_URI);
    return (
      wake.protocol === expected.protocol &&
      wake.hostname === expected.hostname &&
      wake.pathname === expected.pathname &&
      wake.search === "" &&
      wake.hash === "" &&
      wake.username === "" &&
      wake.password === ""
    );
  } catch {
    return false;
  }
}

function keyFromExchangePayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const key = (payload as { key?: unknown }).key;
  return typeof key === "string" && key.length > 0 ? key : null;
}

/** Run one browser attempt, then exchange and persist only its validated key. */
export async function connectOpenRouter(
  deps: ConnectOpenRouterDeps = {},
): Promise<{ connected: true }> {
  const crypto = deps.crypto ?? nativeCrypto;
  const loopback = deps.loopback ?? nativeLoopback;
  const opener = deps.opener ?? nativeBrowserOpener;
  const fetchImpl = deps.fetchImpl ?? nativeFetch;
  const setKey =
    deps.setKey ?? ((provider, key) => aiKeyStore.setKey(provider, key));

  let verifier = "";
  let state = "";
  let attemptId = "";
  let consumed = false;
  let removeAbortListener: (() => void) | undefined;
  try {
    if (deps.signal?.aborted) throw new OpenRouterConnectionError();
    const attempt = await generateOpenRouterPkce(crypto);
    verifier = attempt.verifier;
    state = attempt.state;
    const started = await loopback.startAttempt(
      state,
      OPENROUTER_ATTEMPT_TIMEOUT_MS,
    );
    attemptId = started.attemptId;
    const authUrl = buildOpenRouterAuthUrl({
      challenge: attempt.challenge,
      callbackUrl: started.callbackUrl,
    });

    let browserResultPromise = opener(authUrl, OPENROUTER_WAKE_URI);
    if (deps.signal) {
      const abortPromise = new Promise<never>((_, reject) => {
        const onAbort = () => {
          void loopback.cancelAttempt(attemptId).catch(() => undefined);
          reject(new OpenRouterConnectionError());
        };
        deps.signal?.addEventListener("abort", onAbort, { once: true });
        removeAbortListener = () =>
          deps.signal?.removeEventListener("abort", onAbort);
      });
      browserResultPromise = Promise.race([browserResultPromise, abortPromise]);
    }
    const browserResult = await browserResultPromise;
    if (!validateWake(browserResult) || deps.signal?.aborted) {
      throw new OpenRouterConnectionError();
    }

    // awaitCallback supports the valid callback arriving before this waiter.
    const nativeResult = await loopback.awaitCallback(attemptId);
    const validated = validateOpenRouterCallback(
      nativeResult.callbackUrl,
      started.callbackUrl,
      state,
      consumed,
    );
    if (!validated.ok) throw new OpenRouterConnectionError();
    consumed = true;

    const response = await fetchImpl(OPENROUTER_KEY_EXCHANGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: validated.code,
        code_verifier: verifier,
        code_challenge_method: "S256",
      }),
      ...(deps.signal ? { signal: deps.signal } : {}),
    });
    if (!response.ok) throw new OpenRouterConnectionError();
    const key = keyFromExchangePayload(await response.json());
    if (key === null) throw new OpenRouterConnectionError();
    await setKey("openrouter", key);
    return { connected: true };
  } catch {
    // Collapse native/network/parser failures before AIConnectionScreen logging.
    throw new OpenRouterConnectionError();
  } finally {
    removeAbortListener?.();
    if (attemptId !== "") {
      try {
        await loopback.cancelAttempt(attemptId);
      } catch {
        // Cleanup is best effort and must not replace the sanitized flow result.
      }
    }
    verifier = "";
    state = "";
    attemptId = "";
    consumed = true;
  }
}
