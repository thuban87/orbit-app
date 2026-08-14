/**
 * Local AI settings contract for the dormant AiService port (FND-04).
 *
 * Replaces the unported plugin-coupled `../settings` module (rewritten in a
 * later phase). Covers ONLY the fields `AiService` actually reads — kept tight
 * on purpose so it does not drift from the eventual real settings shape.
 *
 * Provider scope: four cloud providers only (OpenAI, Anthropic, Gemini, and a
 * custom HTTPS endpoint). The local/LAN provider is omitted entirely per the
 * owner decision (CONTEXT.md 2026-08-14) — its id never enters the type system,
 * so no cleartext transport path can be selected.
 */

/**
 * Provider id union. Named `AiProviderId` (NOT `AiProvider`) so it cannot
 * collide with the load-bearing `interface AiProvider` already declared inside
 * `AiService.ts` (a TS2440 the moment either is imported into that file).
 *
 * Includes `'none'` because the service compares `settings.aiProvider === 'none'`
 * (omitting it would be a TS2367 error). Excludes the local/LAN provider id
 * (owner decision — that provider is not ported at all).
 */
export type AiProviderId =
  | "none"
  | "openai"
  | "anthropic"
  | "google"
  | "custom";

/**
 * Minimal settings shape the AI service reads. `aiApiKey` is optional so the
 * legacy `settings.aiApiKeys?.[provider] ?? settings.aiApiKey ?? ''` fallback
 * stays meaningful.
 */
export interface AiSettings {
  /** Active provider selection ('none' disables generation). */
  aiProvider: AiProviderId;
  /** Legacy single API key — fallback when no per-provider key is set. */
  aiApiKey?: string;
  /** Per-provider API key map (preferred over the legacy single key). */
  aiApiKeys?: Record<string, string>;
  /** Selected model id for the active provider. */
  aiModel: string;
  /** Custom-endpoint URL (HTTPS-only; enforcement deferred to Phase 14). */
  aiCustomEndpoint: string;
  /** Model id sent to the custom endpoint. */
  aiCustomModel: string;
}
