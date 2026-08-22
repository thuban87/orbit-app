/**
 * Mocked-fetch behavioural tests for the neutral AI provider adapters (Plan 02).
 *
 * NO real network, NO real keys: `global.fetch` is stubbed and every key comes
 * from an injected accessor. These prove the caller-owned-cancellation contract
 * (H4), the per-call key accessor (C3-M2), the `resolvedPrompt.payload` identity
 * (C3-M1), sanitized error mapping (no body/endpoint/key leakage — T-14-05), and
 * the shared `parseSuggestionOutput` ceiling.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedPrompt } from "@/ai/prompt-types";

const secureCustomFetchMock = vi.fn();

// Mock the secure-fetch wrapper so importing AiService never pulls the native
// `orbit-secure-fetch` module (Expo async-require / `__DEV__`) into node. The
// official adapters still use raw `fetch`; only the Custom adapter routes here.
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

import {
  AiError,
  type AiKeyStoreLike,
  AiService,
  AnthropicProvider,
  CustomProvider,
  type GenerationInput,
  GoogleProvider,
  type KeyAccessor,
  OpenAiProvider,
  parseSuggestionOutput,
} from "@/services/AiService";
import type { AiSettings } from "@/services/ai-types";

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

// ─── Test helpers ───────────────────────────────────────────────

/** A deeply-frozen ResolvedPrompt whose `payload` is the outbound body text. */
function makePrompt(payload: string): ResolvedPrompt {
  return Object.freeze({
    prompt: payload,
    inspectorDisplay: payload,
    truncations: Object.freeze([]),
    payload,
  }) as ResolvedPrompt;
}

function inputFor(
  payload: string,
  signal: AbortSignal,
  model = "model-x",
  thinkingBudget?: number | null,
): GenerationInput {
  return {
    resolvedPrompt: makePrompt(payload),
    model,
    temperature: 0.7,
    maxOutputTokens: 120,
    ...(thinkingBudget === undefined ? {} : { thinkingBudget }),
    signal,
  };
}

const staticKey =
  (value: string | null): KeyAccessor =>
  () =>
    Promise.resolve(value);

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// ─── Happy-path body extraction ─────────────────────────────────

describe("official adapters — valid response extraction", () => {
  it("OpenAI extracts choices[0].message.content", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ choices: [{ message: { content: "openai-text" } }] }),
    );
    const p = new OpenAiProvider(staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).resolves.toBe("openai-text");
  });

  it("Anthropic extracts content[0].text", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ content: [{ text: "anthropic-text" }] }),
    );
    const p = new AnthropicProvider(staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).resolves.toBe("anthropic-text");
  });

  it("Gemini extracts candidates[0].content.parts[0].text", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        candidates: [{ content: { parts: [{ text: "gemini-text" }] } }],
      }),
    );
    const p = new GoogleProvider(staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).resolves.toBe("gemini-text");
  });

  it("Custom (OpenAI-compatible) extracts choices[0].message.content via secureCustomFetch", async () => {
    secureCustomFetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      bodyText: '{"choices":[{"message":{"content":"custom-text"}}]}',
    });
    const p = new CustomProvider(
      "https://api.example.com/v1/chat",
      staticKey("k"),
    );
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).resolves.toBe("custom-text");
    // Custom egress goes through the native transport, never raw fetch.
    expect(secureCustomFetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── parseSuggestionOutput ──────────────────────────────────────

describe("parseSuggestionOutput", () => {
  it("trims surrounding whitespace", () => {
    expect(parseSuggestionOutput("  hello  ")).toBe("hello");
  });

  it("rejects a non-string", () => {
    expect(() => parseSuggestionOutput(42)).toThrow(AiError);
    expect(() => parseSuggestionOutput(undefined)).toThrow(AiError);
    expect(() => parseSuggestionOutput({ draft: "x" })).toThrow(AiError);
  });

  it("rejects empty / whitespace-only", () => {
    expect(() => parseSuggestionOutput("")).toThrow(AiError);
    expect(() => parseSuggestionOutput("   \n\t ")).toThrow(AiError);
  });

  it("accepts exactly 1,200 code points and rejects 1,201", () => {
    expect(parseSuggestionOutput("a".repeat(1200)).length).toBe(1200);
    expect(() => parseSuggestionOutput("a".repeat(1201))).toThrow(AiError);
  });

  it("counts CODE POINTS, not UTF-16 units (astral chars)", () => {
    // 601 emoji = 601 code points but 1202 UTF-16 units — must be ACCEPTED
    // (a naive .length check would wrongly reject it).
    const astral = "😀".repeat(601);
    expect(astral.length).toBe(1202);
    expect(Array.from(astral).length).toBe(601);
    expect(parseSuggestionOutput(astral)).toBe(astral);
    // 1201 emoji = 1201 code points — must be REJECTED.
    expect(() => parseSuggestionOutput("😀".repeat(1201))).toThrow(AiError);
  });

  it("rejects an empty draft from a provider (invalid_response)", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ choices: [{ message: { content: "   " } }] }),
    );
    const p = new OpenAiProvider(staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
});

// ─── Sanitized status mapping — no body parse, no leakage ───────

describe("sanitized HTTP-status errors", () => {
  it("maps 401 to unauthorized WITHOUT parsing the body", async () => {
    const jsonSpy = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: jsonSpy });
    const p = new OpenAiProvider(staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "unauthorized" });
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("maps 429 to rate_limited and 5xx to provider_error", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, json: vi.fn() });
    const p = new AnthropicProvider(staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "rate_limited" });

    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: vi.fn() });
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "provider_error" });
  });

  it("maps malformed JSON to invalid_response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("unexpected token");
      },
    });
    const p = new OpenAiProvider(staticKey("k"));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
});

// ─── Gemini key-in-URL leak (C2-M5) ─────────────────────────────

describe("Gemini key-in-URL is never leaked (C2-M5)", () => {
  it("a Gemini FAILURE carries no URL, query string, or key substring", async () => {
    const SECRET = "AIzaSy-SECRET-GEMINI-KEY-123";
    let calledUrl = "";
    fetchMock.mockImplementationOnce((url: string) => {
      calledUrl = String(url);
      return Promise.resolve({ ok: false, status: 500, json: vi.fn() });
    });
    const p = new GoogleProvider(staticKey(SECRET));

    let caught: unknown;
    try {
      await p.generate(inputFor("hi", new AbortController().signal));
    } catch (e) {
      caught = e;
    }
    // The key really does ride in the request URL query…
    expect(calledUrl).toContain(`key=${SECRET}`);
    // …but never in the surfaced error.
    expect(caught).toBeInstanceOf(AiError);
    const msg = (caught as AiError).message;
    const code = (caught as AiError).code;
    for (const surface of [msg, code]) {
      expect(surface).not.toContain(SECRET);
      expect(surface).not.toContain("key=");
      expect(surface).not.toContain("http");
      expect(surface).not.toContain("generativelanguage");
    }
  });
});

// ─── Model discovery — advisory, free-text fallback ─────────────

describe("model discovery keeps free-text entry on failure", () => {
  it("OpenAI discovery success returns a model list", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ data: [{ id: "gpt-a" }, { id: "gpt-b" }] }),
    );
    const p = new OpenAiProvider(staticKey("k"));
    const disco = await p.listModels();
    expect(disco).toEqual({ kind: "list", models: ["gpt-a", "gpt-b"] });
  });

  it("OpenAI discovery failure falls back to manual entry (no throw)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    const p = new OpenAiProvider(staticKey("k"));
    await expect(p.listModels()).resolves.toEqual({ kind: "manual" });
  });

  it("Gemini discovery filters to generateContent-capable models", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        models: [
          {
            name: "models/gemini-pro",
            supportedGenerationMethods: ["generateContent", "countTokens"],
          },
          {
            name: "models/embedding-001",
            supportedGenerationMethods: ["embedContent"],
          },
        ],
      }),
    );
    const p = new GoogleProvider(staticKey("k"));
    await expect(p.listModels()).resolves.toEqual({
      kind: "list",
      models: ["gemini-pro"],
    });
  });

  it("Anthropic discovery follows pagination", async () => {
    fetchMock
      .mockResolvedValueOnce(
        okJson({
          data: [{ id: "claude-1" }],
          has_more: true,
          last_id: "claude-1",
        }),
      )
      .mockResolvedValueOnce(
        okJson({ data: [{ id: "claude-2" }], has_more: false, last_id: null }),
      );
    const p = new AnthropicProvider(staticKey("k"));
    await expect(p.listModels()).resolves.toEqual({
      kind: "list",
      models: ["claude-1", "claude-2"],
    });
  });
});

// ─── Caller-owned cancellation (H4) ─────────────────────────────

describe("caller-owned cancellation (H4)", () => {
  it("rejects with cancelled when the passed signal is already aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const p = new OpenAiProvider(staticKey("k"));
    await expect(p.generate(inputFor("hi", ctrl.signal))).rejects.toMatchObject(
      { code: "cancelled" },
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the caller's signal straight to fetch", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ choices: [{ message: { content: "ok" } }] }),
    );
    const ctrl = new AbortController();
    const p = new OpenAiProvider(staticKey("k"));
    await p.generate(inputFor("hi", ctrl.signal));
    expect(fetchMock.mock.calls[0][1].signal).toBe(ctrl.signal);
  });

  it("the source constructs NO AbortController and NO setTimeout of its own", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./AiService.ts", import.meta.url)),
      "utf8",
    );
    expect(/AbortController/.test(src)).toBe(false);
    expect(/\bsetTimeout\b/.test(src)).toBe(false);
  });
});

// ─── resolvedPrompt.payload identity (C3-M1) ────────────────────

describe("request body is built from resolvedPrompt.payload (C3-M1)", () => {
  it("sends the exact payload string as the message content", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ choices: [{ message: { content: "ok" } }] }),
    );
    const payload = "the-exact-outbound-string";
    const input = inputFor(payload, new AbortController().signal);
    const p = new OpenAiProvider(staticKey("k"));
    await p.generate(input);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toBe(input.resolvedPrompt.payload);
    expect(body.messages[0].content).toBe(payload);
  });
});

// ─── Neutral thinkingBudget → Gemini thinkingConfig only (D-03/D-02) ─

describe("neutral thinkingBudget maps to Gemini thinkingConfig only (D-03)", () => {
  it("Gemini includes generationConfig.thinkingConfig.thinkingBudget when a number is passed", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        candidates: [{ content: { parts: [{ text: "gemini-text" }] } }],
      }),
    );
    const p = new GoogleProvider(staticKey("k"));
    await p.generate(
      inputFor("hi", new AbortController().signal, "gem-1", 256),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.thinkingConfig).toEqual({
      thinkingBudget: 256,
    });
    // The output ceiling still rides in generationConfig, unchanged.
    expect(body.generationConfig.maxOutputTokens).toBe(120);
  });

  it("Gemini OMITS thinkingConfig when thinkingBudget is null", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        candidates: [{ content: { parts: [{ text: "gemini-text" }] } }],
      }),
    );
    const p = new GoogleProvider(staticKey("k"));
    await p.generate(
      inputFor("hi", new AbortController().signal, "gem-1", null),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.thinkingConfig).toBeUndefined();
  });

  it("Gemini OMITS thinkingConfig when thinkingBudget is undefined (absent)", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        candidates: [{ content: { parts: [{ text: "gemini-text" }] } }],
      }),
    );
    const p = new GoogleProvider(staticKey("k"));
    await p.generate(inputFor("hi", new AbortController().signal));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.thinkingConfig).toBeUndefined();
  });

  it("OpenAI ignores thinkingBudget — no thinkingConfig/reasoning field leaks in", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ choices: [{ message: { content: "ok" } }] }),
    );
    const p = new OpenAiProvider(staticKey("k"));
    await p.generate(inputFor("hi", new AbortController().signal, "gpt", 256));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.thinkingConfig).toBeUndefined();
    expect(body.thinkingBudget).toBeUndefined();
    expect(body.reasoning).toBeUndefined();
    expect(body.reasoning_effort).toBeUndefined();
    // Its own output field is untouched.
    expect(body.max_completion_tokens).toBe(120);
  });

  it("Anthropic ignores thinkingBudget — no thinkingConfig/thinking field leaks in", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ content: [{ text: "ok" }] }));
    const p = new AnthropicProvider(staticKey("k"));
    await p.generate(
      inputFor("hi", new AbortController().signal, "claude", 256),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.thinkingConfig).toBeUndefined();
    expect(body.thinking).toBeUndefined();
    expect(body.thinkingBudget).toBeUndefined();
    // Its own output field is untouched.
    expect(body.max_tokens).toBe(120);
  });

  it("Gemini still reads ONLY resolvedPrompt.payload for content (C3-M1) with a thinkingBudget set", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        candidates: [{ content: { parts: [{ text: "gemini-text" }] } }],
      }),
    );
    const payload = "exact-gemini-payload";
    const input = inputFor(payload, new AbortController().signal, "gem-1", 256);
    const p = new GoogleProvider(staticKey("k"));
    await p.generate(input);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text).toBe(input.resolvedPrompt.payload);
    expect(body.contents[0].parts[0].text).toBe(payload);
  });
});

// ─── Per-call key accessor, never cached in refreshProviders (C3-M2) ─

describe("key accessor is invoked at call time, not during refreshProviders (C3-M2)", () => {
  const settings: AiSettings = {
    aiProvider: "openai",
    aiModel: "model-x",
    aiCustomEndpoint: "",
    aiCustomModel: "",
  };

  it("refreshProviders wires the accessor but reads no key", async () => {
    const getKey = vi.fn(async () => "live-key");
    const fakeStore: AiKeyStoreLike = {
      getKey,
      setKey: async () => {},
      deleteKey: async () => {},
    };
    const service = new AiService(fakeStore);
    service.refreshProviders(settings);
    // Wiring must NOT have fetched any key.
    expect(getKey).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(
      okJson({ choices: [{ message: { content: "ok" } }] }),
    );
    const provider = service.getActiveProvider(settings);
    expect(provider).not.toBeNull();
    await provider?.generate(inputFor("hi", new AbortController().signal));
    // The key is fetched exactly once, at generate time.
    expect(getKey).toHaveBeenCalledTimes(1);
    expect(getKey).toHaveBeenCalledWith("openai");
  });

  it("returns not_configured when the accessor yields null", async () => {
    const p = new OpenAiProvider(staticKey(null));
    await expect(
      p.generate(inputFor("hi", new AbortController().signal)),
    ).rejects.toMatchObject({ code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
