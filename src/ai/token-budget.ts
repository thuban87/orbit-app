/**
 * Catalog-aware max-output policy (Plan 14-11 — REMOVES 14-09's flat, per-provider
 * thinking-aware output cap).
 *
 * =============================================================================
 * WHY THE FLAT CAP IS GONE:
 *   The flat `maxOutputTokens` never controlled visible draft length — the
 *   1,200-code-point post-parse trim in `AiService.parseSuggestionOutput` does
 *   that, and it STAYS. On THINKING models (Gemini 2.5/3.x) the cap was spent on
 *   internal reasoning tokens BEFORE any message, returning empty / mid-sentence
 *   drafts (14-06 device UAT). Bumping the flat number (120 → 1024 → 2048) stayed
 *   fragile. The robust fix is to stop capping:
 *
 *     - Gemini  → OMIT `maxOutputTokens` AND `thinkingConfig` (model default =
 *                 dynamic thinking; verified against ai.google.dev thinking docs
 *                 2026-08-22). No cap → the model reasons as needed and still
 *                 emits a full message.
 *     - OpenAI  → OMIT `max_completion_tokens` (provider default).
 *     - Anthropic → its Messages API REQUIRES `max_tokens` (verified against the
 *                 Anthropic docs 2026-08-22 — it cannot be omitted), so send the
 *                 MODEL'S OWN maximum sourced from the LiteLLM catalog. The only
 *                 ceiling is the model's, not one we invented. Free-text / absent
 *                 models get {@link ANTHROPIC_FALLBACK_MAX_OUTPUT}.
 *     - Custom  → a user-controlled OpenAI-compatible endpoint may REQUIRE a max;
 *                 send a high, non-binding default so it never truncates.
 *     - none    → generation is disabled; no request is ever built.
 *
 *   This module is node-pure: no `fetch`, no `AiService`, no I/O. The catalog is
 *   PASSED IN (the cache-or-seed the caller already resolved). All numbers are
 *   named constants below so retuning is a single-number edit (CLAUDE.md).
 * =============================================================================
 */
import type { ModelCatalog } from "@/ai/model-catalog-filter";
import type { AiProviderId } from "@/services/ai-types";

// --- Tunable constants (single-number tuning surface) ------------------------

/**
 * Anthropic max-output fallback when the selected model is free-text or absent
 * from the catalog. High enough to never bind a short check-in draft; the real
 * ceiling for a catalog model is that model's own maximum.
 */
export const ANTHROPIC_FALLBACK_MAX_OUTPUT = 8192;

/**
 * A high, non-binding default for a user-controlled Custom endpoint that may
 * require `max_tokens`. Not model-specific (the endpoint's model is arbitrary).
 */
export const CUSTOM_MAX_OUTPUT = 8192;

/**
 * Resolve the `maxOutputTokens` to send for the active provider, or `undefined`
 * to OMIT any output cap. Pure and deterministic; no I/O.
 *
 *   - anthropic → the model's own catalog maximum (high fallback when absent);
 *   - openai / google → `undefined` (the adapter omits the field → default);
 *   - custom → a high non-binding default;
 *   - none → `undefined` (generation disabled).
 */
export function resolveMaxOutputTokens(
  provider: AiProviderId,
  model: string,
  catalog: ModelCatalog,
): number | undefined {
  switch (provider) {
    case "anthropic":
      return catalog.limits.anthropic[model] ?? ANTHROPIC_FALLBACK_MAX_OUTPUT;
    case "custom":
      return CUSTOM_MAX_OUTPUT;
    default:
      // openai / google → no cap (provider / model default, dynamic thinking);
      // none → generation disabled, no request built.
      return undefined;
  }
}
