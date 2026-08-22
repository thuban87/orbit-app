/**
 * Settings AI pure helpers — node-tested off-device (C2-M4).
 *
 * These prove the privacy-relevant contracts of the Settings AI section without a
 * renderer: the non-secret settings patch NEVER carries an API key (T-14-12), the
 * Custom endpoint is rejected before persistence when invalid (H2), model
 * discovery falls back to free-text on any failure (C4-M1), and the
 * inspector/acknowledgement builders surface the EXACT immutable ResolvedPrompt
 * they were handed — never a rebuilt one (H5 / T-14-13).
 */
import { describe, expect, it } from "vitest";
import { bundledModelsFor } from "@/ai/model-registry";
import type { ResolvedPrompt } from "@/ai/prompt-types";
import {
  buildAiSettingsPatch,
  buildInspectorViewState,
  buildProviderAckViewState,
  curatedModelsFor,
  discoverModelsForField,
  validateEndpointForSave,
} from "@/screens/settings-ai-logic";

function frozenPrompt(text: string): ResolvedPrompt {
  return Object.freeze({
    prompt: text,
    inspectorDisplay: text,
    truncations: Object.freeze([
      Object.freeze({ category: "conversational fuel", detail: "2 trimmed" }),
    ]),
    payload: text,
  }) as ResolvedPrompt;
}

describe("buildAiSettingsPatch — non-secret only, never a key (T-14-12)", () => {
  it("maps the non-secret provider config and omits any entered key", () => {
    const patch = buildAiSettingsPatch({
      provider: "openai",
      model: "gpt-x",
      customModel: "",
      customEndpoint: "",
      promptTemplate: "Be warm.",
      apiKey: "sk-super-secret-value",
    });
    expect(patch).toEqual({
      aiProvider: "openai",
      aiModel: "gpt-x",
      aiCustomModel: "",
      aiCustomEndpoint: "",
      aiPromptTemplate: "Be warm.",
    });
    // The entered key never appears in the persisted patch or its serialization.
    expect(patch).not.toHaveProperty("apiKey");
    expect(JSON.stringify(patch)).not.toContain("sk-super-secret-value");
  });
});

describe("validateEndpointForSave — reject before persistence (H2)", () => {
  it("rejects a non-https Custom endpoint before it can be saved", () => {
    const result = validateEndpointForSave("http://example.com/v1");
    expect(result.ok).toBe(false);
  });

  it("rejects a private/reserved IP-literal endpoint", () => {
    const result = validateEndpointForSave("https://127.0.0.1/v1");
    expect(result.ok).toBe(false);
  });

  it("accepts a valid public https endpoint", () => {
    const result = validateEndpointForSave("https://api.example.com/v1");
    expect(result.ok).toBe(true);
  });

  it("accepts an empty endpoint as the unconfigured state", () => {
    const result = validateEndpointForSave("");
    expect(result.ok).toBe(true);
  });
});

describe("curatedModelsFor — bundled default list (D-03)", () => {
  it("returns the registry's bundled frontier list for a cloud provider", () => {
    expect(curatedModelsFor("google")).toEqual(bundledModelsFor("google"));
    expect(curatedModelsFor("openai")).toEqual(bundledModelsFor("openai"));
    expect(curatedModelsFor("anthropic")).toEqual(
      bundledModelsFor("anthropic"),
    );
  });

  it("returns an empty list for custom (free-text only) and none", () => {
    expect(curatedModelsFor("custom")).toEqual([]);
    expect(curatedModelsFor("none")).toEqual([]);
  });
});

describe("discoverModelsForField — frontier-filtered, free-text fallback (C4-M1/D-04)", () => {
  it("filters a mixed discovered list down to the frontier ids only", async () => {
    const frontier = bundledModelsFor("google");
    const state = await discoverModelsForField("google", async () => ({
      kind: "list",
      models: [
        "gemini-2.5-flash-preview-tts", // non-chat → drop
        frontier[0], // frontier → keep
        "gemini-embedding-001", // non-chat → drop
        "gemini-2.5-flash", // known-dead → drop
        frontier[1], // frontier → keep
      ],
    }));
    expect(state).toEqual({ kind: "list", models: [frontier[0], frontier[1]] });
  });

  it("degrades an all-junk discovered list to manual (free-text)", async () => {
    const state = await discoverModelsForField("google", async () => ({
      kind: "list",
      models: ["gemini-2.5-flash", "text-embedding-004", "imagen-4.0-generate"],
    }));
    expect(state).toEqual({ kind: "manual" });
  });

  it("falls back to manual when discovery reports manual", async () => {
    const state = await discoverModelsForField("openai", async () => ({
      kind: "manual",
    }));
    expect(state).toEqual({ kind: "manual" });
  });

  it("falls back to manual on an empty list", async () => {
    const state = await discoverModelsForField("openai", async () => ({
      kind: "list",
      models: [],
    }));
    expect(state).toEqual({ kind: "manual" });
  });

  it("falls back to manual if the discovery call throws (advisory — C4-M1)", async () => {
    const state = await discoverModelsForField("anthropic", async () => {
      throw new Error("boom");
    });
    expect(state).toEqual({ kind: "manual" });
  });
});

describe("inspector / ack builders — surface the EXACT prompt, never rebuild (H5)", () => {
  it("inspector view-state returns the SAME inspectorDisplay string it was given", () => {
    const rp = frozenPrompt("EXACT PROMPT BYTES");
    const view = buildInspectorViewState(rp);
    expect(view.display).toBe(rp.inspectorDisplay);
    expect(view.truncations).toBe(rp.truncations);
  });

  it("ack view-state returns the SAME prompt string it was given", () => {
    const rp = frozenPrompt("EXACT PROMPT BYTES");
    const view = buildProviderAckViewState("openai", rp);
    expect(view.prompt).toBe(rp.prompt);
    expect(view.isCustom).toBe(false);
    expect(view.retentionCaveat).toBeNull();
  });

  it("names the Custom retention caveat for the custom provider", () => {
    const rp = frozenPrompt("EXACT PROMPT BYTES");
    const view = buildProviderAckViewState("custom", rp);
    expect(view.isCustom).toBe(true);
    expect(view.retentionCaveat).not.toBeNull();
    expect(view.prompt).toBe(rp.prompt);
  });
});
