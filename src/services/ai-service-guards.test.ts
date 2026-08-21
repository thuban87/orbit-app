/**
 * Request-BOUNDARY guards for the Custom provider adapter (Plan 02, Task 2).
 *
 * NODE-SIDE PROOF ONLY: the native `secureCustomFetch` transport is MOCKED here,
 * so these prove the ADAPTER's routing/validation/error-mapping logic — NOT the
 * native OkHttp egress guarantees (DNS rejection, redirect refusal, proxy pin),
 * which are proven on-device in Plan 06. `global.fetch` is also stubbed; NO real
 * network and NO real keys.
 *
 * Proven here:
 *   - H2: the Custom adapter reuses `validateCustomEndpoint` at REQUEST time and
 *     refuses an invalid endpoint BEFORE any transport call.
 *   - H3: Custom egress goes ONLY through `secureCustomFetch`, never raw `fetch`;
 *     official providers stay on raw `fetch`.
 *   - C4-M1: Custom `listModels()` is non-networked (free-text only).
 *   - T-14-05: a native redirect/private-resolution error maps to a sanitized
 *     code with no endpoint/body/header text.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedPrompt } from "@/ai/prompt-types";
import {
  AiError,
  CustomProvider,
  type GenerationInput,
  type KeyAccessor,
  OpenAiProvider,
} from "@/services/AiService";

const secureCustomFetchMock = vi.fn();

// Fully mock the secure-fetch wrapper so the native `orbit-secure-fetch` module
// (which pulls Expo's async-require and its `__DEV__` global) is NEVER loaded
// node-side. The SecureFetchError shape here matches the real class so the
// adapter's `instanceof` code-mapping resolves against the SAME constructor.
vi.mock("@/ai/secure-fetch", () => {
  class SecureFetchError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
      this.name = "SecureFetchError";
    }
  }
  return {
    SecureFetchError,
    secureCustomFetch: (...args: unknown[]) => secureCustomFetchMock(...args),
  };
});

// Imported AFTER the mock is registered so the test and the adapter share it.
import { SecureFetchError } from "@/ai/secure-fetch";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  secureCustomFetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── helpers ────────────────────────────────────────────────────

function makePrompt(payload: string): ResolvedPrompt {
  return Object.freeze({
    prompt: payload,
    inspectorDisplay: payload,
    truncations: Object.freeze([]),
    payload,
  }) as ResolvedPrompt;
}

function inputFor(payload: string, signal: AbortSignal): GenerationInput {
  return {
    resolvedPrompt: makePrompt(payload),
    model: "model-x",
    temperature: 0.7,
    maxOutputTokens: 120,
    signal,
  };
}

const staticKey =
  (value: string | null): KeyAccessor =>
  () =>
    Promise.resolve(value);

const GOOD_ENDPOINT = "https://api.custom.example/v1/chat";

function nativeOk(bodyText: string, overrides: Record<string, unknown> = {}) {
  return { status: 200, ok: true, bodyText, ...overrides };
}

// ─── H3: transport routing ──────────────────────────────────────

describe("Custom egress routes ONLY through secureCustomFetch (H3)", () => {
  it("Custom.generate calls secureCustomFetch and NOT raw fetch", async () => {
    secureCustomFetchMock.mockResolvedValueOnce(
      nativeOk('{"choices":[{"message":{"content":"custom-text"}}]}'),
    );
    const p = new CustomProvider(GOOD_ENDPOINT, staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).resolves.toBe("custom-text");

    expect(secureCustomFetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    // The validated endpoint URL and the caller's signal are forwarded.
    const call = secureCustomFetchMock.mock.calls[0][0];
    expect(call.url).toBe(GOOD_ENDPOINT);
  });

  it("official providers use raw fetch, NOT secureCustomFetch", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "openai" } }] }),
    });
    const p = new OpenAiProvider(staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).resolves.toBe("openai");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(secureCustomFetchMock).not.toHaveBeenCalled();
  });

  it("forwards the caller's signal to secureCustomFetch", async () => {
    secureCustomFetchMock.mockResolvedValueOnce(
      nativeOk('{"choices":[{"message":{"content":"ok"}}]}'),
    );
    const ctrl = new AbortController();
    const p = new CustomProvider(GOOD_ENDPOINT, staticKey("k"));
    await p.generate(inputFor("hi", ctrl.signal));
    expect(secureCustomFetchMock.mock.calls[0][0].signal).toBe(ctrl.signal);
  });

  it("builds the request body from resolvedPrompt.payload (C3-M1)", async () => {
    secureCustomFetchMock.mockResolvedValueOnce(
      nativeOk('{"choices":[{"message":{"content":"ok"}}]}'),
    );
    const payload = "the-exact-custom-payload";
    const input = inputFor(payload, new AbortController().signal);
    const p = new CustomProvider(GOOD_ENDPOINT, staticKey("k"));
    await p.generate(input);
    const body = JSON.parse(secureCustomFetchMock.mock.calls[0][0].body);
    expect(body.messages[0].content).toBe(input.resolvedPrompt.payload);
  });
});

// ─── H2: request-time validation reuse ──────────────────────────

describe("Custom endpoint is validated before transport (H2)", () => {
  it("refuses an http:// endpoint before any transport call", async () => {
    const p = new CustomProvider("http://api.custom.example/v1", staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "invalid_endpoint" });
    expect(secureCustomFetchMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a .local endpoint before any transport call", async () => {
    const p = new CustomProvider("https://printer.local/v1", staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "invalid_endpoint" });
    expect(secureCustomFetchMock).not.toHaveBeenCalled();
  });

  it("refuses a private IP-literal endpoint before any transport call", async () => {
    const p = new CustomProvider("https://127.0.0.1/v1", staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "invalid_endpoint" });
    expect(secureCustomFetchMock).not.toHaveBeenCalled();
  });

  it("refuses an unconfigured (empty) endpoint", async () => {
    const p = new CustomProvider("", staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "invalid_endpoint" });
    expect(secureCustomFetchMock).not.toHaveBeenCalled();
  });
});

// ─── C4-M1: non-networked model discovery ───────────────────────

describe("Custom listModels is non-networked (C4-M1)", () => {
  it("makes no transport call and returns manual entry", async () => {
    const p = new CustomProvider(GOOD_ENDPOINT, staticKey("k"));
    await expect(p.listModels()).resolves.toEqual({ kind: "manual" });
    expect(secureCustomFetchMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── T-14-05: sanitized native-error mapping ────────────────────

describe("native errors map to sanitized codes with no leakage (T-14-05)", () => {
  it("a redirect rejection maps to blocked with no endpoint/body/header text", async () => {
    secureCustomFetchMock.mockRejectedValueOnce(new SecureFetchError("redirect"));
    const p = new CustomProvider(GOOD_ENDPOINT, staticKey("secret-key-123"));

    let caught: unknown;
    try {
      await p.generate(inputFor("hi", new AbortController().signal));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AiError);
    const { code, message } = caught as AiError;
    expect(code).toBe("blocked");
    for (const surface of [code, message]) {
      expect(surface).not.toContain("custom.example");
      expect(surface).not.toContain("http");
      expect(surface).not.toContain("Authorization");
      expect(surface).not.toContain("secret-key-123");
    }
  });

  it("a private-address rejection maps to blocked", async () => {
    secureCustomFetchMock.mockRejectedValueOnce(
      new SecureFetchError("private_address"),
    );
    const p = new CustomProvider(GOOD_ENDPOINT, staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "blocked" });
  });

  it("a native timeout maps to timeout", async () => {
    secureCustomFetchMock.mockRejectedValueOnce(new SecureFetchError("timeout"));
    const p = new CustomProvider(GOOD_ENDPOINT, staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("a non-ok native status maps to a sanitized HTTP code", async () => {
    secureCustomFetchMock.mockResolvedValueOnce(
      nativeOk("", { ok: false, status: 401 }),
    );
    const p = new CustomProvider(GOOD_ENDPOINT, staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("malformed native body text maps to invalid_response", async () => {
    secureCustomFetchMock.mockResolvedValueOnce(nativeOk("not json {{{"));
    const p = new CustomProvider(GOOD_ENDPOINT, staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
});
