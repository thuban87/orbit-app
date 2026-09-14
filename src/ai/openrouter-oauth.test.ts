import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  buildOpenRouterAuthUrl,
  connectOpenRouter,
  generateOpenRouterPkce,
  OPENROUTER_AUTH_URL,
  OPENROUTER_KEY_EXCHANGE_URL,
  OPENROUTER_WAKE_URI,
  type OpenRouterBrowserOpener,
  type OpenRouterCrypto,
  type OpenRouterFetch,
  type OpenRouterLoopback,
  validateOpenRouterCallback,
} from "@/ai/openrouter-oauth";

const LOOPBACK_CALLBACK =
  "http://127.0.0.1:43127/openrouter-auth?state=state_-";
const bytes = (length: number, start = 0): Uint8Array =>
  Uint8Array.from({ length }, (_, index) => (index + start) % 256);
const cryptoPort: OpenRouterCrypto = {
  randomBytes: vi.fn(async (length: number) => bytes(length)),
  sha256Base64: vi.fn(async (input: string) =>
    createHash("sha256").update(input).digest("base64"),
  ),
};

function loopbackPort(callbackUrl = LOOPBACK_CALLBACK): OpenRouterLoopback {
  let activeCallbackUrl = callbackUrl;
  return {
    startAttempt: vi.fn(async (state: string) => {
      const supplied = new URL(callbackUrl);
      supplied.searchParams.set("state", state);
      activeCallbackUrl = supplied.toString();
      return { attemptId: "opaque-attempt", callbackUrl: activeCallbackUrl };
    }),
    awaitCallback: vi.fn(async () => ({
      callbackUrl: `${activeCallbackUrl}&code=one-time-code`,
    })),
    cancelAttempt: vi.fn(async () => undefined),
  };
}

describe("OpenRouter PKCE", () => {
  it("creates guarded-random base64url verifier/state and an S256 challenge", async () => {
    const result = await generateOpenRouterPkce(cryptoPort);
    expect(cryptoPort.randomBytes).toHaveBeenCalledTimes(2);
    expect(result.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(result.state).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(result.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.challenge).not.toContain("=");
    expect(cryptoPort.sha256Base64).toHaveBeenCalledWith(result.verifier);
  });

  it("sends a dynamic localhost callback carrying state, not a custom scheme or top-level state", () => {
    const authUrl = new URL(
      buildOpenRouterAuthUrl({
        challenge: "challenge_-",
        callbackUrl: LOOPBACK_CALLBACK,
      }),
    );
    expect(`${authUrl.origin}${authUrl.pathname}`).toBe(OPENROUTER_AUTH_URL);
    expect(Object.fromEntries(authUrl.searchParams)).toEqual({
      callback_url: LOOPBACK_CALLBACK,
      code_challenge: "challenge_-",
      code_challenge_method: "S256",
    });
    expect(authUrl.searchParams.has("state")).toBe(false);
    expect(authUrl.toString()).not.toContain("orbit%3A");
  });
});

describe("OpenRouter callback validation", () => {
  it("accepts only the exact dynamic callback with one code and matching state", () => {
    expect(
      validateOpenRouterCallback(
        `${LOOPBACK_CALLBACK}&code=abc123`,
        LOOPBACK_CALLBACK,
        "state_-",
      ),
    ).toEqual({ ok: true, code: "abc123" });
  });

  it.each([
    [
      "foreign scheme",
      "https://127.0.0.1:43127/openrouter-auth?code=x&state=state_-",
    ],
    [
      "foreign host",
      "http://localhost:43127/openrouter-auth?code=x&state=state_-",
    ],
    [
      "foreign port",
      "http://127.0.0.1:43128/openrouter-auth?code=x&state=state_-",
    ],
    ["unexpected path", "http://127.0.0.1:43127/other?code=x&state=state_-"],
    ["unexpected parameter", `${LOOPBACK_CALLBACK}&code=x&next=bad`],
    ["duplicate code", `${LOOPBACK_CALLBACK}&code=x&code=y`],
    ["malformed", "not a url"],
  ])("rejects %s", (_case, url) => {
    expect(
      validateOpenRouterCallback(url, LOOPBACK_CALLBACK, "state_-"),
    ).toMatchObject({ ok: false });
  });

  it("rejects missing, duplicate, or mismatched state before exposing the code", () => {
    const base = "http://127.0.0.1:43127/openrouter-auth";
    expect(
      validateOpenRouterCallback(
        `${base}?code=secret-code`,
        LOOPBACK_CALLBACK,
        "state_-",
      ),
    ).toEqual({ ok: false, reason: "missing-state" });
    expect(
      validateOpenRouterCallback(
        `${base}?code=secret-code&state=wrong`,
        LOOPBACK_CALLBACK,
        "state_-",
      ),
    ).toEqual({ ok: false, reason: "mismatched-state" });
    expect(
      validateOpenRouterCallback(
        `${LOOPBACK_CALLBACK}&state=state_-&code=secret-code`,
        LOOPBACK_CALLBACK,
        "state_-",
      ),
    ).toEqual({ ok: false, reason: "mismatched-state" });
  });

  it("rejects a duplicate delivery after consumption", () => {
    expect(
      validateOpenRouterCallback(
        `${LOOPBACK_CALLBACK}&code=x`,
        LOOPBACK_CALLBACK,
        "state_-",
        true,
      ),
    ).toEqual({ ok: false, reason: "already-consumed" });
  });
});

describe("OpenRouter connect", () => {
  it("carries one loopback callback through the wake, exchange, and key-store path", async () => {
    const loopback = loopbackPort();
    let openedAuthUrl = "";
    const opener: OpenRouterBrowserOpener = vi.fn(async (authUrl: string) => {
      openedAuthUrl = authUrl;
      return { type: "success" as const, url: OPENROUTER_WAKE_URI };
    });
    let exchangeBody = "";
    const fetchImpl: OpenRouterFetch = vi.fn(async (_url, init) => {
      exchangeBody = init.body;
      return {
        ok: true,
        status: 200,
        json: async () => ({ key: "sk-or-result" }),
      };
    });
    const setKey = vi.fn(async () => undefined);
    await expect(
      connectOpenRouter({
        crypto: cryptoPort,
        loopback,
        opener,
        fetchImpl,
        setKey,
      }),
    ).resolves.toEqual({ connected: true });
    expect(loopback.startAttempt).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
    );
    const authUrl = new URL(openedAuthUrl);
    const callbackUrl = new URL(authUrl.searchParams.get("callback_url") ?? "");
    expect(`${callbackUrl.origin}${callbackUrl.pathname}`).toBe(
      "http://127.0.0.1:43127/openrouter-auth",
    );
    expect(callbackUrl.searchParams.get("state")).toMatch(
      /^[A-Za-z0-9_-]{32,}$/,
    );
    expect(opener).toHaveBeenCalledWith(
      expect.any(String),
      OPENROUTER_WAKE_URI,
    );
    expect(loopback.awaitCallback).toHaveBeenCalledWith("opaque-attempt");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      OPENROUTER_KEY_EXCHANGE_URL,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(JSON.parse(exchangeBody)).toEqual({
      code: "one-time-code",
      code_verifier: expect.any(String),
      code_challenge_method: "S256",
    });
    expect(setKey).toHaveBeenCalledWith("openrouter", "sk-or-result");
    expect(loopback.cancelAttempt).toHaveBeenCalledWith("opaque-attempt");
  });

  it("rejects a credential-bearing browser wake before exchange", async () => {
    const loopback = loopbackPort();
    const fetchImpl = vi.fn();
    await expect(
      connectOpenRouter({
        crypto: cryptoPort,
        loopback,
        opener: async () => ({
          type: "success",
          url: `${OPENROUTER_WAKE_URI}?code=leak`,
        }),
        fetchImpl,
      }),
    ).rejects.toThrow("openrouter_connection_failed");
    expect(loopback.awaitCallback).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed on native callback mismatch and always cancels native work", async () => {
    const loopback = loopbackPort(
      "http://127.0.0.1:43127/openrouter-auth?state=expected",
    );
    vi.mocked(loopback.awaitCallback).mockResolvedValue({
      callbackUrl:
        "http://127.0.0.1:43127/openrouter-auth?state=wrong&code=secret-code",
    });
    const fetchImpl = vi.fn();
    await expect(
      connectOpenRouter({
        crypto: cryptoPort,
        loopback,
        opener: async () => ({ type: "success", url: OPENROUTER_WAKE_URI }),
        fetchImpl,
      }),
    ).rejects.toThrow("openrouter_connection_failed");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(loopback.cancelAttempt).toHaveBeenCalledWith("opaque-attempt");
  });

  it("cancels immediately when the browser is dismissed", async () => {
    const loopback = loopbackPort();
    const fetchImpl = vi.fn();
    const setKey = vi.fn();
    await expect(
      connectOpenRouter({
        crypto: cryptoPort,
        loopback,
        opener: async () => ({ type: "cancel" }),
        fetchImpl,
        setKey,
      }),
    ).rejects.toThrow("openrouter_connection_failed");
    expect(loopback.awaitCallback).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(setKey).not.toHaveBeenCalled();
    expect(loopback.cancelAttempt).toHaveBeenCalledWith("opaque-attempt");
  });

  it("maps native, exchange, and persistence failures to one sanitized error", async () => {
    const cases: Array<{
      loopback: OpenRouterLoopback;
      fetchImpl: OpenRouterFetch;
      setKey: (
        provider: "openai" | "anthropic" | "google" | "openrouter" | "custom",
        key: string,
      ) => Promise<void>;
    }> = [
      {
        loopback: {
          ...loopbackPort(),
          awaitCallback: vi.fn(async () => {
            throw new Error(`raw-${LOOPBACK_CALLBACK}`);
          }),
        },
        fetchImpl: vi.fn(async () => {
          throw new Error("unused");
        }),
        setKey: vi.fn(async () => undefined),
      },
      {
        loopback: loopbackPort(),
        fetchImpl: vi.fn(async () => ({
          ok: false,
          status: 499,
          json: async () => ({}),
        })),
        setKey: vi.fn(async () => undefined),
      },
      {
        loopback: loopbackPort(),
        fetchImpl: vi.fn(async () => ({
          ok: true,
          status: 200,
          json: async () => ({ key: "secret" }),
        })),
        setKey: vi.fn(async () => {
          throw new Error("raw-key");
        }),
      },
    ];
    for (const testCase of cases) {
      await expect(
        connectOpenRouter({
          crypto: cryptoPort,
          loopback: testCase.loopback,
          opener: async () => ({ type: "success", url: OPENROUTER_WAKE_URI }),
          fetchImpl: testCase.fetchImpl,
          setKey: testCase.setKey,
        }),
      ).rejects.toMatchObject({ message: "openrouter_connection_failed" });
    }
  });
});
