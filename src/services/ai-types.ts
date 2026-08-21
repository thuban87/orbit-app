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
 * The provider ids as a runtime array — the SINGLE source of truth the settings
 * DAO validates an incoming `aiProvider` against (a bare `string` from a patch
 * must be one of these). Kept in lockstep with `AiProviderId` above.
 */
export const AI_PROVIDER_IDS = [
  "none",
  "openai",
  "anthropic",
  "google",
  "custom",
] as const;

/**
 * The cloud providers that actually hold an API key — `none` (disabled) is
 * excluded. This is the key-repository's provider scope (one namespaced
 * SecureStore item per id); no key is ever keyed by `none`.
 */
export type AiCloudProviderId = Exclude<AiProviderId, "none">;

/**
 * Neutral, non-secret provider configuration — the export-safe shape that lives
 * in `app_settings`. It deliberately holds NO API key: credentials live only in
 * the device SecureStore (see `ai-key-store.ts`). `promptTemplate` empty means
 * "use the built-in default".
 */
export interface AiProviderConfig {
  provider: AiProviderId;
  model: string;
  customEndpoint: string;
  customModel: string;
  promptTemplate: string;
}

/** A neutral generation request — the prompt plus the resolved model id. */
export interface AiGenerationRequest {
  prompt: string;
  model: string;
}

/**
 * Minimal, non-secret settings shape the AI service reads. It holds NO API key:
 * the two legacy single/per-provider key fields are REMOVED (L1) — provider keys
 * live EXCLUSIVELY in the device SecureStore (`ai-key-store.ts`) and are fetched
 * through an injected per-call accessor immediately before a request (C3-M2),
 * never carried in exportable settings.
 */
export interface AiSettings {
  /** Active provider selection ('none' disables generation). */
  aiProvider: AiProviderId;
  /** Selected model id for the active provider. */
  aiModel: string;
  /** Custom-endpoint URL (validated https:// only — see custom-endpoint.ts). */
  aiCustomEndpoint: string;
  /** Model id sent to the custom endpoint. */
  aiCustomModel: string;
}
