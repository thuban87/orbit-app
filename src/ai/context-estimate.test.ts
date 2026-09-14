import { describe, expect, it } from "vitest";

import {
  assertPromptFitsContext,
  COST_ESTIMATE_UNAVAILABLE,
  estimatePromptContext,
} from "@/ai/context-estimate";

describe("context-estimate — selected model capacity and input price", () => {
  it("blocks a known overflow before provider egress and preserves recovery choices", () => {
    let egressed = false;
    expect(() => {
      assertPromptFitsContext({
        prompt: "x".repeat(401),
        connection: "openai",
        model: "small-model",
        contextWindowTokens: 100,
      });
      egressed = true;
    }).toThrow(/context_too_large/);
    expect(egressed).toBe(false);

    try {
      assertPromptFitsContext({
        prompt: "x".repeat(401),
        connection: "openai",
        model: "small-model",
        contextWindowTokens: 100,
      });
    } catch (error) {
      const detail = (error as { notice?: { detail?: string } }).notice?.detail;
      expect(detail).toContain("Reduce or turn off some context");
      expect(detail).toContain("choose a larger-context model");
    }
  });
  it("uses the selected OpenRouter model's real context window and input price", () => {
    const estimate = estimatePromptContext({
      prompt: "x".repeat(4_000),
      connection: "openrouter",
      model: "provider/model",
      openRouterModel: {
        id: "provider/model",
        name: "Model",
        contextLength: 8_000,
        pricing: { prompt: "0.000002" },
      },
    });

    expect(estimate.estimatedInputTokens).toBe(1_000);
    expect(estimate.contextWindowTokens).toBe(8_000);
    expect(estimate.estimatedInputCostUsd).toBeCloseTo(0.002);
    expect(estimate.overflow).toBe(false);
    expect(estimate.overflowNotice).toBeNull();
  });

  it("returns the unavailable-cost contract for direct and custom connections", () => {
    for (const connection of [
      "openai",
      "anthropic",
      "google",
      "custom",
    ] as const) {
      const estimate = estimatePromptContext({
        prompt: "hello",
        connection,
        model: "selected-model",
        contextWindowTokens: 128_000,
      });
      expect(estimate.estimatedInputCostUsd).toBeNull();
      expect(estimate.costMessage).toBe(COST_ESTIMATE_UNAVAILABLE);
      expect(estimate.contextWindowTokens).toBe(128_000);
    }
  });

  it("surfaces true over-capacity explicitly without changing the prompt", () => {
    const prompt = "z".repeat(4_004);
    const estimate = estimatePromptContext({
      prompt,
      connection: "custom",
      model: "small-model",
      contextWindowTokens: 1_000,
    });

    expect(estimate.estimatedInputTokens).toBe(1_001);
    expect(estimate.overflow).toBe(true);
    expect(estimate.prompt).toBe(prompt);
    expect(estimate.overflowNotice).toEqual({
      category: "context",
      detail:
        "This request is larger than small-model's context window. Reduce or turn off some context, change personalization, or choose a larger-context model.",
    });
  });

  it("does not invent overflow when the selected model capacity is unavailable", () => {
    const estimate = estimatePromptContext({
      prompt: "hello",
      connection: "openrouter",
      model: "unknown",
      openRouterModel: null,
    });
    expect(estimate.contextWindowTokens).toBeNull();
    expect(estimate.overflow).toBe(false);
    expect(estimate.overflowNotice).toBeNull();
  });
});
