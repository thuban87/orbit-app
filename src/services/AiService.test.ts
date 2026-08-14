/**
 * Mocked-fetch behavioural tests for the ported AI providers.
 *
 * These prove what the structural greps cannot: that each provider's
 * ok-status guard runs BEFORE the JSON body is parsed. A `json` spy is asserted
 * un-called on a non-ok response — if the guard were missing or placed after the
 * parse, the spy would fire and the assertion would fail.
 *
 * The service is dormant: providers are driven directly with a stubbed
 * `global.fetch`. No real network, no UI. Each provider gets one non-ok case
 * (proving guard placement) and one success case (proving body extraction).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnthropicProvider,
  CustomProvider,
  GoogleProvider,
  OpenAiProvider,
} from "@/services/AiService";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OpenAiProvider", () => {
  it("rejects on a non-ok response WITHOUT parsing the body", async () => {
    const jsonSpy = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: jsonSpy });

    const provider = new OpenAiProvider("test-key");
    await expect(provider.generate("hi", "model-x")).rejects.toThrow();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("resolves to the extracted text on a success response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "openai-text" } }],
      }),
    });

    const provider = new OpenAiProvider("test-key");
    await expect(provider.generate("hi", "model-x")).resolves.toBe(
      "openai-text",
    );
  });
});

describe("AnthropicProvider", () => {
  it("rejects on a non-ok response WITHOUT parsing the body", async () => {
    const jsonSpy = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: jsonSpy });

    const provider = new AnthropicProvider("test-key");
    await expect(provider.generate("hi", "model-x")).rejects.toThrow();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("resolves to the extracted text on a success response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: "anthropic-text" }] }),
    });

    const provider = new AnthropicProvider("test-key");
    await expect(provider.generate("hi", "model-x")).resolves.toBe(
      "anthropic-text",
    );
  });
});

describe("GoogleProvider", () => {
  it("rejects on a non-ok response WITHOUT parsing the body", async () => {
    const jsonSpy = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: jsonSpy });

    const provider = new GoogleProvider("test-key");
    await expect(provider.generate("hi", "model-x")).rejects.toThrow();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("resolves to the extracted text on a success response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "google-text" }] } }],
      }),
    });

    const provider = new GoogleProvider("test-key");
    await expect(provider.generate("hi", "model-x")).resolves.toBe(
      "google-text",
    );
  });
});

describe("CustomProvider", () => {
  it("rejects on a non-ok response WITHOUT parsing the body", async () => {
    const jsonSpy = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: jsonSpy });

    const provider = new CustomProvider(
      "https://example.test/v1/chat",
      "test-key",
      "model-x",
    );
    await expect(provider.generate("hi", "model-x")).rejects.toThrow();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("resolves to the extracted text on a success response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "custom-text" } }],
      }),
    });

    const provider = new CustomProvider(
      "https://example.test/v1/chat",
      "test-key",
      "model-x",
    );
    await expect(provider.generate("hi", "model-x")).resolves.toBe(
      "custom-text",
    );
  });
});
