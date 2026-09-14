import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  buildOpenRouterAuthUrl,
  connectOpenRouter,
  generateOpenRouterPkce,
  OPENROUTER_AUTH_URL,
  OPENROUTER_KEY_EXCHANGE_URL,
  OPENROUTER_REDIRECT_URI,
  type OpenRouterCrypto,
  validateOpenRouterCallback,
} from "@/ai/openrouter-oauth";

const bytes = (length: number, start = 0): Uint8Array =>
  Uint8Array.from({ length }, (_, index) => (index + start) % 256);

const cryptoPort: OpenRouterCrypto = {
  randomBytes: vi.fn(async (length: number) => bytes(length)),
  sha256Base64: vi.fn(async (input: string) =>
    createHash("sha256").update(input).digest("base64"),
  ),
};

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

  it("builds the exact auth request with callback, challenge, S256, and state", () => {
    const authUrl = new URL(
      buildOpenRouterAuthUrl({ challenge: "challenge_-", state: "state_-" }),
    );

    expect(`${authUrl.origin}${authUrl.pathname}`).toBe(OPENROUTER_AUTH_URL);
    expect(Object.fromEntries(authUrl.searchParams)).toEqual({
      callback_url: OPENROUTER_REDIRECT_URI,
      code_challenge: "challenge_-",
      code_challenge_method: "S256",
      state: "state_-",
    });
  });
});

describe("OpenRouter callback validation", () => {
  it("accepts only the exact callback with one code and matching state", () => {
    expect(
      validateOpenRouterCallback(
        "orbit://openrouter-auth?code=abc123&state=expected",
        OPENROUTER_REDIRECT_URI,
        "expected",
      ),
    ).toEqual({ ok: true, code: "abc123" });
  });

  it.each([
    ["foreign scheme", "https://openrouter-auth?code=x&state=expected"],
    ["foreign host", "orbit://attacker?code=x&state=expected"],
    ["unexpected path", "orbit://openrouter-auth/path?code=x&state=expected"],
    [
      "unexpected parameter",
      "orbit://openrouter-auth?code=x&state=expected&next=bad",
    ],
    ["duplicate code", "orbit://openrouter-auth?code=x&code=y&state=expected"],
    ["malformed", "not a url"],
  ])("rejects %s", (_case, url) => {
    expect(
      validateOpenRouterCallback(url, OPENROUTER_REDIRECT_URI, "expected"),
    ).toMatchObject({ ok: false });
  });

  it("rejects a missing state before exposing the code", () => {
    expect(
      validateOpenRouterCallback(
        "orbit://openrouter-auth?code=secret-code",
        OPENROUTER_REDIRECT_URI,
        "expected",
      ),
    ).toEqual({ ok: false, reason: "missing-state" });
  });

  it("rejects a mismatched state before exposing the code", () => {
    expect(
      validateOpenRouterCallback(
        "orbit://openrouter-auth?code=secret-code&state=wrong",
        OPENROUTER_REDIRECT_URI,
        "expected",
      ),
    ).toEqual({ ok: false, reason: "mismatched-state" });
  });

  it("rejects a duplicate redirect after the code has been consumed", () => {
    expect(
      validateOpenRouterCallback(
        "orbit://openrouter-auth?code=x&state=expected",
        OPENROUTER_REDIRECT_URI,
        "expected",
        true,
      ),
    ).toEqual({ ok: false, reason: "already-consumed" });
  });
});

describe("OpenRouter connect", () => {
  it("exchanges a validated code once and stores only the resulting key", async () => {
    const opener = vi.fn(async (authUrl: string) => {
      const state = new URL(authUrl).searchParams.get("state");
      return {
        type: "success" as const,
        url: `${OPENROUTER_REDIRECT_URI}?code=one-time-code&state=${state}`,
      };
    });
    const fetchImpl = vi.fn(
      async (
        _url: string,
        _init: {
          method: "POST";
          headers: { "Content-Type": "application/json" };
          body: string;
          signal?: AbortSignal;
        },
      ) => ({
        ok: true,
        status: 200,
        json: async () => ({ key: "sk-or-result" }),
      }),
    );
    const setKey = vi.fn(async () => undefined);

    await expect(
      connectOpenRouter({ crypto: cryptoPort, opener, fetchImpl, setKey }),
    ).resolves.toEqual({ connected: true });

    expect(opener).toHaveBeenCalledWith(
      expect.stringContaining("state="),
      OPENROUTER_REDIRECT_URI,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      OPENROUTER_KEY_EXCHANGE_URL,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toEqual({
      code: "one-time-code",
      code_verifier: expect.any(String),
      code_challenge_method: "S256",
    });
    expect(setKey).toHaveBeenCalledWith("openrouter", "sk-or-result");
  });

  it.each([
    ["missing state", `${OPENROUTER_REDIRECT_URI}?code=secret-code`],
    ["wrong state", `${OPENROUTER_REDIRECT_URI}?code=secret-code&state=wrong`],
  ])("does not exchange a callback with %s", async (_case, callbackUrl) => {
    const fetchImpl = vi.fn();
    const setKey = vi.fn();

    await expect(
      connectOpenRouter({
        crypto: cryptoPort,
        opener: async () => ({ type: "success", url: callbackUrl }),
        fetchImpl,
        setKey,
      }),
    ).rejects.toThrow("OpenRouter authorization callback was rejected");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(setKey).not.toHaveBeenCalled();
  });
});
