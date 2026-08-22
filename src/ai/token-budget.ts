/**
 * Per-provider, thinking-aware output budget policy (Plan 14-09, D-01/D-02/D-04).
 *
 * =============================================================================
 * WHY THIS EXISTS — READ BEFORE RETUNING:
 *   THINKING models (Gemini 2.5/3.x) spend `maxOutputTokens` on internal
 *   reasoning tokens BEFORE emitting a single message token. Device UAT (14-06)
 *   measured 364 thinking tokens for a ~21-token reply and 702–886 for a
 *   fuel-rich contact — a single flat `maxOutputTokens` was spent on reasoning
 *   and returned empty / mid-sentence drafts. Bumping the flat number (120 →
 *   1024 → 2048) stayed fragile. The robust fix is per-provider:
 *
 *     - Gemini gets a SOFT reasoning cap (`thinkingConfig.thinkingBudget`) so
 *       reasoning cannot claim the whole allowance, PLUS an output budget sized
 *       to cover the ACTUAL thinking (which overruns the soft cap — 256 → ~500
 *       measured) WITH MARGIN, then the message allowance on top. It is sized as
 *       `thinking-headroom + output-allowance`, deliberately NOT
 *       `thinkingBudget + output` (the budget is a soft target, not a hard wall).
 *     - The curated OpenAI/Anthropic frontier models are NON-thinking chat models
 *       (Plan 08 curated gpt-4.x / Sonnet-Haiku non-thinking tiers), so a tuned
 *       `maxOutputTokens` suffices and there is NO reasoning cap (D-04).
 *     - `none`/`custom` (a user-controlled endpoint) assume no reasoning field.
 *
 *   The actual message length stays independently bounded by the unchanged
 *   1,200-code-point post-parse ceiling in `AiService.parseSuggestionOutput`, so
 *   a generous output budget here does not let drafts balloon.
 *
 *   IF a reasoning/thinking OpenAI or Anthropic model is ever curated (Plan 08's
 *   frontier is non-thinking today), do NOT reuse Gemini's field: the
 *   reasoning-control parameter name and shape differ per provider and change
 *   over time — add a per-provider control verified against that provider's
 *   CURRENT official docs at that time.
 *
 *   This module is node-pure: no `fetch`, no `AiService`, no I/O. All numbers are
 *   named constants below so retuning is a single-number edit (CLAUDE.md).
 * =============================================================================
 */
import type { AiProviderId } from "@/services/ai-types";

// --- Tunable budget constants (single-number tuning surface) -----------------

/**
 * Gemini SOFT reasoning cap, in tokens, mapped to
 * `generationConfig.thinkingConfig.thinkingBudget`. Measured device seed: 256 →
 * ~500 actual thinking tokens + a complete, non-truncated message (14-06 UAT).
 * It is a SOFT target Gemini can overrun; {@link GEMINI_THINKING_HEADROOM} is the
 * margin that absorbs the overrun.
 */
const GEMINI_THINKING_BUDGET = 256;

/**
 * Token headroom reserved for Gemini's ACTUAL reasoning above the soft cap.
 * Measured overrun tops out near 886 for a fuel-rich contact, so 1,024 leaves
 * margin even when the soft 256 cap is exceeded.
 */
const GEMINI_THINKING_HEADROOM = 1_024;

/**
 * Output-token allowance for the visible message, on TOP of the thinking
 * headroom. A warm 3–4 sentence check-in is short; 512 is comfortable and the
 * 1,200-code-point post-parse ceiling still bounds the final draft.
 */
const GEMINI_OUTPUT_ALLOWANCE = 512;

/**
 * Gemini `maxOutputTokens`: thinking headroom + message allowance. NOT
 * `thinkingBudget + output` — the budget is a soft target that overruns, so the
 * request must cover actual thinking WITH MARGIN plus the message (D-02).
 */
const GEMINI_MAX_OUTPUT_TOKENS =
  GEMINI_THINKING_HEADROOM + GEMINI_OUTPUT_ALLOWANCE;

/**
 * Output-token allowance for the curated NON-thinking chat providers
 * (OpenAI/Anthropic — D-04). No reasoning is spent, so this is the whole budget.
 */
const CHAT_OUTPUT_TOKENS = 512;

/**
 * Safe default output allowance for `none` (disabled) and `custom` (a
 * user-controlled endpoint whose model may be anything). No reasoning field is
 * assumed for a user endpoint.
 */
const DEFAULT_OUTPUT_TOKENS = 512;

// --- Contract ----------------------------------------------------------------

/**
 * A resolved per-request budget. `maxOutputTokens` is the neutral output ceiling
 * every adapter already maps to its provider field. `thinkingBudget` is the
 * NEUTRAL reasoning cap concept (tokens; `null` = no cap / provider default) —
 * only the Gemini adapter maps it (to `thinkingConfig.thinkingBudget`); other
 * adapters ignore it.
 */
export interface TokenBudget {
  readonly maxOutputTokens: number;
  readonly thinkingBudget: number | null;
}

/**
 * Resolve the output budget for the active provider. Pure and deterministic; no
 * I/O. `model` is accepted now for future model-family branching but the curated
 * frontier chat models do not require it yet.
 */
export function resolveTokenBudget(
  provider: AiProviderId,
  _model?: string,
): TokenBudget {
  switch (provider) {
    case "google":
      // Thinking model: cap reasoning (soft) + size output to cover actual
      // thinking WITH MARGIN plus the message allowance (D-02).
      return {
        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        thinkingBudget: GEMINI_THINKING_BUDGET,
      };
    case "openai":
    case "anthropic":
      // Curated non-thinking chat models: tuned output, no reasoning cap (D-04).
      return { maxOutputTokens: CHAT_OUTPUT_TOKENS, thinkingBudget: null };
    default:
      // `none` (disabled) and `custom` (user endpoint): safe default, no assumed
      // reasoning field.
      return { maxOutputTokens: DEFAULT_OUTPUT_TOKENS, thinkingBudget: null };
  }
}
