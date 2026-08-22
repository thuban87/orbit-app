/**
 * Curated frontier chat-model registry — BUNDLED, node-pure static data (Plan 14-08).
 *
 * WHY THIS MODULE EXISTS:
 *   The model picker used to render whatever a provider's raw catalog returned,
 *   which (per the 14-06 device UAT) meant a key was required just to see any list
 *   AND the list still offered deprecated ids (the Gemini 2.5 flash line, which
 *   404s "no longer available to new users" on a fresh key) plus wholly irrelevant
 *   non-chat families (tts / image / embedding / robotics / lyria / …). Provider
 *   `listModels` metadata does NOT flag deprecation, so runtime filtering alone
 *   cannot hide a dead-but-still-listed model (D-02). A curated allowlist is the
 *   only reliable fix, and shipping it as in-app data means the DEFAULT picker
 *   needs no key and makes ZERO network calls (local-first — D-01).
 *
 * PURITY CONTRACT (grep-enforced by the test suite):
 *   This module imports ONLY the provider-id TYPE. It performs no I/O and never
 *   reaches the network — there is no default-path code that transmits anything.
 *
 * KEEPING IT CURRENT (D-06):
 *   The three per-provider arrays below are the ONLY thing to edit when a provider
 *   ships or retires a frontier model — a single-array change. The ids were
 *   verified against each provider's live model list at execution time (recorded
 *   in 14-08-SUMMARY.md); they are NOT planner guesses. Discovery + free-text
 *   remain the escape hatches for anything not (yet) curated (D-04/D-05).
 */
import type { AiProviderId } from "@/services/ai-types";

// ─── Tunable curated frontier lists (top-of-file — single-array edit per D-06) ──
//
// Scope per provider = the current frontier CHAT tiers only (D-05):
//   flagship / balanced / cheap-fast — never a tts/image/embedding/etc. family.
// Ordered flagship-first; the screen renders them in this order.

/** OpenAI GPT-5.x chat tiers (flagship / mini / nano). */
const OPENAI_FRONTIER: readonly string[] = Object.freeze([
  "gpt-5.5",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
]);

/** Anthropic Claude chat tiers (Opus / Sonnet / Haiku). */
const ANTHROPIC_FRONTIER: readonly string[] = Object.freeze([
  "claude-opus-5",
  "claude-sonnet-5",
  "claude-haiku-4-5",
]);

/** Google Gemini 3.x chat tiers (Flash / Flash-Lite / Pro). */
const GOOGLE_FRONTIER: readonly string[] = Object.freeze([
  "gemini-3.7-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-pro-preview",
]);

/** The single frozen empty list reused for `none`/`custom` (free-text only). */
const EMPTY: readonly string[] = Object.freeze([]);

/**
 * The curated allowlist keyed by provider id. `none` and `custom` are DELIBERATELY
 * empty: `none` disables generation, and Custom is free-text only (C4-M1).
 */
const CURATED: Record<AiProviderId, readonly string[]> = Object.freeze({
  none: EMPTY,
  openai: OPENAI_FRONTIER,
  anthropic: ANTHROPIC_FRONTIER,
  google: GOOGLE_FRONTIER,
  custom: EMPTY,
});

/**
 * The curated frontier chat models for a provider — the BUNDLED default picker.
 * Returns a frozen, ordered array (empty for `none`/`custom`). No key, no network.
 */
export function bundledModelsFor(provider: AiProviderId): readonly string[] {
  return CURATED[provider] ?? EMPTY;
}

/**
 * Narrow a raw discovered id list to the provider's curated frontier set (D-04).
 *
 * Discovery (advisory, key-gated) returns the provider's full catalog; this aligns
 * it with the curated frontier — intersecting by id (case-insensitive), preserving
 * the discovered order, and de-duplicating. Everything else falls away: the
 * non-chat families (tts/image/embedding/robotics/lyria/…), any deprecated id the
 * catalog still lists, and anything simply not curated. A legitimate model that is
 * not (yet) curated stays reachable via free-text entry, so nothing is permanently
 * hidden. `none`/`custom` have no curated set, so the result is always empty.
 */
export function filterToFrontier(
  provider: AiProviderId,
  discovered: readonly string[],
): readonly string[] {
  const allow = new Set(
    bundledModelsFor(provider).map((id) => id.toLowerCase()),
  );
  if (allow.size === 0) return EMPTY;
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const id of discovered) {
    const key = id.toLowerCase();
    if (allow.has(key) && !seen.has(key)) {
      seen.add(key);
      kept.push(id);
    }
  }
  return Object.freeze(kept);
}
