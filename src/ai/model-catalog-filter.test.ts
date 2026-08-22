/**
 * LiteLLM catalog filter/map — node-tested off-device (14-10, supersedes the
 * 14-08 hand-curated arrays).
 *
 * These pin the SOURCING contract the owner mandated: the selectable model set is
 * DERIVED from LiteLLM's published `model_prices_and_context_window.json`, never
 * hand-typed. The rules proven here (verified against the LIVE file on 2026-08-22,
 * recorded in 14-10-SUMMARY.md):
 *   - keep ONLY `mode === "chat"` entries (drops image/embedding/tts/realtime/…);
 *   - map `litellm_provider`: openai→openai, anthropic→anthropic, and the Gemini
 *     family (native `gemini`, plus `vertex_ai` / `vertex_ai-language-models`
 *     variants of the SAME id, native preferred) → google;
 *   - DROP any entry LiteLLM marks deprecated (a `deprecation_date` at//before now);
 *   - DROP OpenAI `ft:` fine-tune TEMPLATE rows (not selectable base models);
 *   - strip a provider `prefix/` so ids are bare (the adapters call bare ids);
 *   - de-duplicate case-insensitively, preserving first-seen order.
 *
 * The tests drive SYNTHETIC raw input so they are deterministic and independent of
 * the live file drifting under them.
 */
import { describe, expect, it } from "vitest";
import {
  filterLiteLLMCatalog,
  LITELLM_MODELS_URL,
} from "@/ai/model-catalog-filter";

const NOW = new Date("2026-08-22T12:00:00Z");

/** A minimal LiteLLM-shaped fixture covering every rule branch. */
const RAW = {
  // sample_spec is documentation, never a model — must be ignored.
  sample_spec: { mode: "chat", litellm_provider: "openai" },

  // OpenAI: a real chat model (keep), a fine-tune template (drop), a non-chat
  // family (drop), and a past-deprecated chat model (drop).
  "gpt-5.4-mini": { mode: "chat", litellm_provider: "openai" },
  "ft:gpt-4o-2024-08-06": { mode: "chat", litellm_provider: "openai" },
  "dall-e-3": { mode: "image_generation", litellm_provider: "openai" },
  "gpt-4-0314": {
    mode: "chat",
    litellm_provider: "openai",
    deprecation_date: "2025-01-01",
  },

  // Anthropic: bare ids, kept as-is.
  "claude-opus-5": { mode: "anthropic-oops", litellm_provider: "anthropic" }, // wrong mode → drop
  "claude-sonnet-5": { mode: "chat", litellm_provider: "anthropic" },
  "claude-haiku-4-5": { mode: "chat", litellm_provider: "anthropic" },

  // Gemini native (prefixed) — strip the `gemini/` prefix.
  "gemini/gemini-2.5-flash": { mode: "chat", litellm_provider: "gemini" },
  "gemini/gemini-embedding-001": {
    mode: "embedding",
    litellm_provider: "gemini",
  },
  // vertex_ai variant of an id ALSO present natively → deduped (native wins).
  "vertex_ai/gemini-2.5-flash": {
    mode: "chat",
    litellm_provider: "vertex_ai",
  },
  // vertex_ai gemini id NOT present natively → included (deduped list grows).
  "vertex_ai/gemini-3.7-flash": {
    mode: "chat",
    litellm_provider: "vertex_ai",
  },
  // vertex-hosted NON-gemini model → excluded from google (not gemini family).
  "vertex_ai/claude-opus-4-5": {
    mode: "chat",
    litellm_provider: "vertex_ai",
  },
  // bare-id gemini under vertex_ai-language-models → normalized + deduped.
  "gemini-2.5-flash-lite": {
    mode: "chat",
    litellm_provider: "vertex_ai-language-models",
  },
  // future deprecation_date → NOT deprecated yet, kept.
  "gemini/gemini-3.5-flash": {
    mode: "chat",
    litellm_provider: "gemini",
    deprecation_date: "2099-01-01",
  },
} as const;

describe("filterLiteLLMCatalog — mode/provider/deprecation mapping", () => {
  const cat = filterLiteLLMCatalog(RAW, NOW);

  it("stamps the source url and a generatedAt timestamp", () => {
    expect(cat.source).toBe(LITELLM_MODELS_URL);
    expect(typeof cat.generatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(cat.generatedAt))).toBe(false);
  });

  it("keeps only chat-mode OpenAI models and drops ft:/non-chat/deprecated", () => {
    expect(cat.models.openai).toEqual(["gpt-5.4-mini"]);
  });

  it("keeps chat-mode Anthropic ids and drops the wrong-mode entry", () => {
    expect(cat.models.anthropic).toEqual([
      "claude-sonnet-5",
      "claude-haiku-4-5",
    ]);
  });

  it("strips the gemini/ prefix, dedupes vertex variants (native preferred), keeps vertex-only + future-dep", () => {
    // Native `gemini-2.5-flash` wins over the vertex_ai variant (dedup);
    // embedding dropped; vertex-only `gemini-3.7-flash` kept; the
    // vertex-hosted claude dropped (not gemini family); future-dep kept.
    expect(cat.models.google).toEqual([
      "gemini-2.5-flash",
      "gemini-3.5-flash",
      "gemini-3.7-flash",
      "gemini-2.5-flash-lite",
    ]);
  });

  it("never lets a vertex-hosted non-gemini model leak into google", () => {
    expect(cat.models.google).not.toContain("claude-opus-4-5");
  });

  it("de-duplicates case-insensitively, preserving first-seen id casing", () => {
    const dup = filterLiteLLMCatalog(
      {
        "gpt-5.4-Mini": { mode: "chat", litellm_provider: "openai" },
        "gpt-5.4-mini": { mode: "chat", litellm_provider: "openai" },
      },
      NOW,
    );
    expect(dup.models.openai).toEqual(["gpt-5.4-Mini"]);
  });

  it("treats a deprecation_date at/before now as deprecated (dropped)", () => {
    const onNow = filterLiteLLMCatalog(
      {
        "gpt-x": {
          mode: "chat",
          litellm_provider: "openai",
          deprecation_date: "2026-08-22",
        },
      },
      NOW,
    );
    expect(onNow.models.openai).toEqual([]);
  });

  it("tolerates a malformed/empty raw object without throwing", () => {
    expect(filterLiteLLMCatalog({}, NOW).models.openai).toEqual([]);
    expect(filterLiteLLMCatalog(null, NOW).models.google).toEqual([]);
    expect(filterLiteLLMCatalog("nope", NOW).models.anthropic).toEqual([]);
  });
});
