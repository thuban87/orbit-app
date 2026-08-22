/**
 * Pins the per-provider, thinking-aware token budget contract (Plan 14-09,
 * D-01/D-02/D-04). Pure node logic — no network, no adapter import.
 *
 * WHY THIS EXISTS: thinking models (Gemini 2.5/3.x) spend `maxOutputTokens` on
 * internal reasoning BEFORE any message (measured 364–886 THINKING tokens for a
 * short reply, 14-06 device UAT), so a single flat number starved the draft.
 * These tests fix the shape of the fix: Gemini caps reasoning with a
 * `thinkingBudget` and gets output headroom on top; the curated non-thinking
 * chat providers (OpenAI/Anthropic) get a tuned output allowance and NO reasoning
 * cap; a user endpoint / disabled provider assumes no reasoning field.
 */
import { describe, expect, it } from "vitest";
import { resolveTokenBudget } from "@/ai/token-budget";

describe("resolveTokenBudget — per-provider thinking-aware budget", () => {
  it("Gemini (google) caps reasoning AND allows a positive output budget", () => {
    const budget = resolveTokenBudget("google");
    expect(budget.thinkingBudget).not.toBeNull();
    expect(typeof budget.thinkingBudget).toBe("number");
    expect(budget.thinkingBudget as number).toBeGreaterThan(0);
    expect(budget.maxOutputTokens).toBeGreaterThan(0);
  });

  it("OpenAI/Anthropic get a positive output allowance and NO reasoning cap (D-04)", () => {
    for (const provider of ["openai", "anthropic"] as const) {
      const budget = resolveTokenBudget(provider);
      expect(budget.thinkingBudget).toBeNull();
      expect(budget.maxOutputTokens).toBeGreaterThan(0);
    }
  });

  it("custom / none assume no reasoning field (thinkingBudget null) with a safe output default", () => {
    for (const provider of ["custom", "none"] as const) {
      const budget = resolveTokenBudget(provider);
      expect(budget.thinkingBudget).toBeNull();
      expect(budget.maxOutputTokens).toBeGreaterThan(0);
    }
  });

  it("Gemini reasoning is CAPPED, not unbounded: thinkingBudget <= maxOutputTokens", () => {
    // A soft reasoning cap only helps if the request still leaves room for the
    // message: the reasoning cap must sit at or below the total output budget so
    // reasoning can never claim the entire allowance (the 14-06 failure).
    const budget = resolveTokenBudget("google");
    expect(budget.thinkingBudget as number).toBeLessThanOrEqual(
      budget.maxOutputTokens,
    );
  });

  it("accepts an optional model argument without changing the frontier-chat budget", () => {
    // `model` is reserved for future model-family branching; the curated frontier
    // chat models do not need it yet, so passing one must not change the result.
    expect(resolveTokenBudget("google", "gemini-3.7-flash")).toEqual(
      resolveTokenBudget("google"),
    );
    expect(resolveTokenBudget("openai", "gpt-some-model")).toEqual(
      resolveTokenBudget("openai"),
    );
  });
});
