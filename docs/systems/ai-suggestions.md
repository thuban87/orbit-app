# AI Suggestions

**Last updated:** 2026-08-27
**Updated by phase:** 18.2-bound-unbound-lifecycle
**Owners:** `src/services/AiService.ts`, `src/services/ai-key-store.ts`, `src/ai/`, `src/db/ai-context-read.ts`, `src/db/app-settings-dao.ts`, `src/logic/ai-suggestion-logic.ts`, `src/screens/SettingsScreen.tsx`, `src/screens/ComposeScreen.tsx`

## Purpose

AI suggestions create a short, user-editable message for a contact through a user-selected BYO-key provider. The system is Orbit's only user-configured network egress: it keeps credentials on-device, controls exactly which local data can leave, and never writes an interaction or sends a message itself.

## Architecture

### Data Model

AI has no AI-owned per-contact table. Migration 004 extends the singleton `app_settings` row with non-secret provider configuration and four first-send acknowledgement flags; explicit Memory permission remains on the Memory row and provider keys stay in Expo SecureStore.

**Tables:**
- `app_settings` — singleton non-secret AI configuration.
  - `ai_provider` (`TEXT`) — `none` by default; enables one of OpenAI, Anthropic, Google, or Custom.
  - `ai_model` / `ai_custom_endpoint` / `ai_custom_model` / `ai_prompt_template` (`TEXT`) — ordinary exportable selection and prompt preferences.
  - `ai_ack_openai` / `ai_ack_anthropic` / `ai_ack_google` / `ai_ack_custom` (`INTEGER`) — durable acknowledgement state, writable only by `acknowledgeProvider()`.

**Types:**
- `PromptContext` (`src/ai/prompt-types.ts`) — closed allowlist of contact-derived data permitted to leave the device.
- `ResolvedPrompt` (`src/ai/prompt-types.ts`) — frozen prompt object shared by inspection, acknowledgement, and provider generation.
- `AiProviderId` (`src/services/ai-types.ts`) — closed provider union excluding local/LAN providers.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|-------|------|----------------|
| Settings DAO | `src/db/app-settings-dao.ts` | Reads/writes non-secret configuration and owns the acknowledgement writer. |
| Key repository | `src/services/ai-key-store.ts` | Stores one provider-scoped credential in Expo SecureStore. |
| Context read | `src/db/ai-context-read.ts` | Builds the narrow outbound context projection. |
| Prompt resolver | `src/ai/prompt-template.ts` | Creates one bounded, immutable prompt and inspection payload. |
| Provider adapters | `src/services/AiService.ts` | Makes typed unary provider calls and sanitizes failures. |
| Custom transport | `src/ai/secure-fetch.ts` | Routes Custom requests through the native egress guard. |
| Lifecycle | `src/logic/ai-suggestion-logic.ts` | Owns one request, cancellation, timeout, acknowledgement, and stale-result guards. |
| UI | `src/screens/SettingsScreen.tsx`, `src/screens/ComposeScreen.tsx` | Configures providers and presents the editable-draft flow. |

### Key Files

| File | Role |
|------|------|
| `src/db/migrations/004-ai-settings.ts` | Adds non-secret AI settings and default-off acknowledgement columns. |
| `src/db/ai-context-read.ts` | Sole SQL/data projection for AI context. |
| `src/db/memories-read.ts` | Supplies the explicit, live-only Memory eligibility projection. |
| `src/ai/prompt-template.ts` | Sole `ResolvedPrompt` construction path. |
| `src/services/AiService.ts` | Provider-specific request/response adapters. |
| `src/ai/custom-endpoint.ts` | Validates Custom endpoint URLs and public literals. |
| `modules/orbit-secure-fetch/src/OrbitSecureFetchModule.ts` | Enforces native Custom address, redirect, and proxy posture. |
| `src/ai/model-catalog-cache.ts` | Loads local model catalog cache and runs explicit refreshes. |
| `src/ai/model-registry.ts` | Resolves All or latest-per-tier Frontier model lists. |

## How It Works

### Configuring a provider

1. Settings reads the singleton configuration and key presence; it never displays or serializes a key.
2. The user chooses a provider, model, optional Custom endpoint, and prompt style. `updateAppSettings()` persists only non-secret fields; Custom endpoint validation rejects malformed, credentialed, local, cleartext, and non-public literal values.
3. SecureStore writes or removes the provider-specific key directly. Model selection uses the bundled catalog/cache; manual model entry remains available.

### Resolving and sending a suggestion

1. Compose accepts a direct request or consumes the profile's serializable AI intent once, then asks `readPromptContext()` for the allowed local facts.
2. `resolvePrompt()` bounds and freezes one `ResolvedPrompt`; its inspection, acknowledgement, and provider payload strings are identical.
3. On a provider's first request, Compose displays the exact contact-specific prompt and persists acknowledgement before egress. A declined or failed acknowledgement starts no network request.
4. `AiSuggestionLifecycle` owns the sole controller and 20-second timeout. It invalidates stale work on cancellation, unmount, configuration change, or a superseding request.
5. A successful suggestion fills an empty draft or asks before replacing a non-empty one. Send and Copy preserve their existing handoff-only behavior and write no touchpoint, fuel, or recency value.
6. An explicit request for an Unbound contact remains available. Its relationship context retains the closed projection, but unavailable cadence intensity becomes the fixed neutral aggregate rather than NULL arithmetic or a fabricated cadence.
7. The context reader exposes a Memory only when its stored `allow_ai` flag is on and it is not deleted. This permission is independent of type, provenance, and Profile visibility; prompt-string serialization of this new projection remains the Phase-36 seam.

### Custom egress and model catalog

1. Official providers use their fixed HTTPS hosts; Custom generation validates the endpoint then calls `secureCustomFetch()` rather than raw fetch.
2. The native transport resolves and validates the destination once, blocks non-public addresses and redirects, bypasses proxies, and returns only sanitized failure codes.
3. The default model picker reads a bundled LiteLLM-filtered seed or local cache. A user may explicitly refresh the public catalog; refresh sends no key or contact data and leaves the prior catalog intact on failure.

## Configuration

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| `AI_REQUEST_TIMEOUT_MS` | `20_000` | `src/logic/ai-suggestion-logic.ts` | Bounds one Compose-owned request. |
| `FRONTIER_TIERS` | 3 named tiers/provider | `src/ai/model-registry.ts` | Resolves at most three latest Frontier choices per provider. |
| `ANTHROPIC_FALLBACK_MAX_OUTPUT` | `8192` | `src/ai/token-budget.ts` | Fallback where Anthropic requires a maximum output token value. |

## Decisions

- **ADR-049:** BYO-Key AI Configuration and Credential Boundary — separates SecureStore credentials from exportable SQLite settings.
- **ADR-050:** Closed AI Prompt Egress Allowlist and Opt-In Field Sharing — makes the projection and sharing flag the disclosure boundary.
- **ADR-051:** Public-HTTPS Custom AI Egress Guard — protects user-controlled Custom destinations at URL and native transport layers.
- **ADR-052:** Compose-Owned AI Draft Lifecycle and Acknowledged Egress — keeps generation editable, acknowledged, cancellable, and non-writing.
- **ADR-053:** Local-First LiteLLM AI Model Catalog — provides seed/cache model selection and explicit refresh.
- **ADR-062:** Bound/Unbound Lifecycle and One-Way Cadence Assignment — permits explicit Unbound assistance without proactive cadence evaluation.
- **ADR-081:** Retire AI-Proposed Fuel for Explicit Per-Item Permission — replaces provenance-based proposal eligibility with default-off Memory permission.

## Gotchas

1. **Never add a broad read to the prompt path.** `PromptContext` and `readPromptContext()` are the egress allowlist; interaction `note` and event `detail` must never enter it.
2. **Do not persist or log keys, prompts, endpoint URLs, request bodies, or raw provider failures.** UI and adapter errors use sanitized state only.
3. **Do not use raw fetch for Custom generation.** The native transport is the connection-time private-address, redirect, and proxy control.
4. **A Custom endpoint change requires a fresh acknowledgement.** The settings DAO resets the Custom acknowledgement when its endpoint changes.
5. **Do not reconstruct a prompt after preview.** The frozen `ResolvedPrompt` object is the identity contract across preview, acknowledgement, and egress.
6. **The owner accepted one device egress smoke test instead of the original full on-device escape matrix.** Shared JVM/vector tests cover the remaining address cases; keep that limitation visible if the guard changes.
7. **Never invent cadence for an Unbound contact.** The neutral intensity aggregate is the only permitted representation of unavailable cadence in explicit AI context.
8. **Memory permission fails closed in SQL.** Do not infer it from a Memory type, source, or visibility flag, and do not claim an eligible projection has reached a provider payload before its prompt serializer consumes it.

## Related Systems

- **Custom fields** — exposes only definition-level opted-in values to the context reader.
- **Contact Knowledge** — supplies explicitly opted-in live Memories through the egress projection.
- **Contact methods** — owns Compose, Copy, and best-effort SMS handoff for a returned draft.
- **Contacts** — supplies the profile entry and source identity without accepting an AI write.
- **Persistence core** — applies migration 004 and the SQLite singleton contract.
- **App shell** — carries the serializable profile-to-Compose request intent and hosts settings.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-18 | 14 | Created optional BYO-key AI suggestions, the protected egress boundary, Compose draft flow, and local-first model catalog. |
| 2026-08-27 | 18.2 | Kept explicit Unbound AI available with neutral intensity and no normalized-method egress. |
| 2026-09-03 | 24.2 | Added a default-off, SQL-gated Memory eligibility projection while deferring prompt serialization to Phase 36. |
