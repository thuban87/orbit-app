/**
 * Pins the catalog-aware max-output policy (Plan 14-11 — REMOVES 14-09's flat,
 * thinking-aware cap). Pure node logic — no network, no adapter import.
 *
 * WHY THIS CHANGED: the flat `maxOutputTokens` cap never controlled visible draft
 * length (the 1,200-code-point post-parse trim in AiService does that, and stays)
 * and on THINKING models it was spent on reasoning, returning empty/truncated
 * drafts. So the cap is gone: OpenAI and Gemini send NO output cap (provider /
 * model default — dynamic thinking on Gemini); only Anthropic sends a ceiling
 * because its Messages API REQUIRES `max_tokens`, and that ceiling is the MODEL'S
 * OWN maximum sourced from the LiteLLM catalog (a high fallback when the model is
 * free-text / absent). Custom sends a high, non-binding default.
 */
import { describe, expect, it } from "vitest";
import type { ModelCatalog } from "@/ai/model-catalog-filter";
import { resolveMaxOutputTokens } from "@/ai/token-budget";

const CATALOG: ModelCatalog = {
  source: "test",
  generatedAt: "2026-08-22T00:00:00.000Z",
  models: {
    openai: ["gpt-5.6-sol"],
    anthropic: ["claude-opus-5", "claude-haiku-4-5"],
    google: ["gemini-3.7-flash"],
  },
  limits: {
    openai: { "gpt-5.6-sol": 128000 },
    anthropic: { "claude-opus-5": 128000, "claude-haiku-4-5": 64000 },
    google: { "gemini-3.7-flash": 65536 },
  },
};

describe("resolveMaxOutputTokens — catalog-aware, cap removed", () => {
  it("Gemini (google) sends NO cap (model default → dynamic thinking)", () => {
    expect(
      resolveMaxOutputTokens("google", "gemini-3.7-flash", CATALOG),
    ).toBeUndefined();
  });

  it("OpenAI sends NO cap (provider default)", () => {
    expect(
      resolveMaxOutputTokens("openai", "gpt-5.6-sol", CATALOG),
    ).toBeUndefined();
  });

  it("Anthropic sends the MODEL'S OWN maximum from the catalog", () => {
    expect(resolveMaxOutputTokens("anthropic", "claude-opus-5", CATALOG)).toBe(
      128000,
    );
    expect(
      resolveMaxOutputTokens("anthropic", "claude-haiku-4-5", CATALOG),
    ).toBe(64000);
  });

  it("Anthropic falls back to a high default when the model is free-text / absent", () => {
    const max = resolveMaxOutputTokens(
      "anthropic",
      "some-custom-claude",
      CATALOG,
    );
    expect(typeof max).toBe("number");
    expect(max as number).toBeGreaterThanOrEqual(8192);
  });

  it("custom sends a high, non-binding default; none needs nothing", () => {
    const custom = resolveMaxOutputTokens("custom", "whatever", CATALOG);
    expect(typeof custom).toBe("number");
    expect(custom as number).toBeGreaterThanOrEqual(8192);
    // `none` disables generation entirely — no request is ever built.
    expect(resolveMaxOutputTokens("none", "", CATALOG)).toBeUndefined();
  });
});
