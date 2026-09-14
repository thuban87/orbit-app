/**
 * OpenRouter browser authorization — PKCE S256 + strict custom-scheme callback.
 *
 * The authorization code, verifier, and anti-CSRF state exist only in this
 * function's memory for one attempt. The resulting API key crosses exactly one
 * storage boundary: ai-key-store → SecureStore (`orbit.ai.key.openrouter`).
 * No value in this flow is logged or written to SQLite / AsyncStorage.
 */
import { aiKeyStore } from "@/services/ai-key-store";
import type { AiCloudProviderId } from "@/services/ai-types";

export const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
export const OPENROUTER_KEY_EXCHANGE_URL =
  "https://openrouter.ai/api/v1/auth/keys";
export const OPENROUTER_REDIRECT_URI = "orbit://openrouter-auth";

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
  readonly opener?: OpenRouterBrowserOpener;
  readonly fetchImpl?: OpenRouterFetch;
  readonly setKey?: (provider: AiCloudProviderId, key: string) => Promise<void>;
  readonly signal?: AbortSignal;
}

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Encode bytes without Buffer/btoa so Hermes and node use identical logic. */
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
      { encoding: crypto.CryptoEncoding.BASE64 },
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

const nativeFetch: OpenRouterFetch = async (url, init) => fetch(url, init);

/** Generate one in-memory PKCE verifier/challenge and anti-CSRF state pair. */
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

/** Build the non-standard OpenRouter PKCE authorization URL. */
export function buildOpenRouterAuthUrl(input: {
  challenge: string;
  state: string;
}): string {
  const url = new URL(OPENROUTER_AUTH_URL);
  url.searchParams.set("callback_url", OPENROUTER_REDIRECT_URI);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", input.state);
  return url.toString();
}

/**
 * Pure callback gate. It validates destination and the complete parameter set,
 * then validates state, and only then returns the one-time authorization code.
 */
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
    callback.protocol !== expected.protocol ||
    callback.hostname !== expected.hostname ||
    callback.port !== expected.port ||
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

function keyFromExchangePayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const key = (payload as { key?: unknown }).key;
  return typeof key === "string" && key.length > 0 ? key : null;
}

/** Run one browser attempt, exchange its validated code, and store the API key. */
export async function connectOpenRouter(
  deps: ConnectOpenRouterDeps = {},
): Promise<{ connected: true }> {
  const crypto = deps.crypto ?? nativeCrypto;
  const opener = deps.opener ?? nativeBrowserOpener;
  const fetchImpl = deps.fetchImpl ?? nativeFetch;
  const setKey =
    deps.setKey ?? ((provider, key) => aiKeyStore.setKey(provider, key));

  let verifier = "";
  let state = "";
  let consumed = false;
  try {
    const attempt = await generateOpenRouterPkce(crypto);
    verifier = attempt.verifier;
    state = attempt.state;
    const authUrl = buildOpenRouterAuthUrl(attempt);
    const result = await opener(authUrl, OPENROUTER_REDIRECT_URI);
    if (result.type !== "success" || typeof result.url !== "string") {
      throw new Error("OpenRouter authorization was not completed");
    }

    const validated = validateOpenRouterCallback(
      result.url,
      OPENROUTER_REDIRECT_URI,
      state,
      consumed,
    );
    if (!validated.ok) {
      throw new Error(
        `OpenRouter authorization callback was rejected (${validated.reason})`,
      );
    }
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
    if (!response.ok) {
      throw new Error(
        `OpenRouter key exchange failed (HTTP ${response.status})`,
      );
    }
    const key = keyFromExchangePayload(await response.json());
    if (key === null) {
      throw new Error("OpenRouter key exchange returned an invalid response");
    }
    await setKey("openrouter", key);
    return { connected: true };
  } finally {
    // Explicitly release attempt-only material on every success/failure path.
    verifier = "";
    state = "";
    consumed = true;
  }
}
