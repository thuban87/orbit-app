# Phase 14: AI Message Suggestions - Context

**Gathered:** 2026-08-18
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Deliver Orbit's optional, free BYO-key AI message suggestions: cloud-provider configuration,
secure credential storage, a structured and privacy-bounded prompt, and a single editable-draft
flow that starts from Compose or a contact profile. The phase owns the complete outbound-data
boundary and its inspection surface. It does not add a server, entitlement system, local/LAN
provider, AI-written contact data, or a second compose/result screen.

</domain>

<decisions>
## Implementation Decisions

### Provider configuration and credentials
- Ship OpenAI, Anthropic, Gemini, and a Custom OpenAI-compatible provider. Custom endpoints are
  HTTPS-only; reject malformed URLs, HTTP, URL credentials, and any cleartext path before saving
  or requesting. Ollama/local-LAN remains excluded.
- AI defaults off (`provider = none`) and remains free/BYO-key with no entitlement gate.
- Store API keys per provider only in `expo-secure-store`, without `requireAuthentication`; never
  write keys to SQLite, logs, analytics, exports, backups, or prompt-inspection state. Lost keys
  after uninstall are an expected reconfiguration state.
- Persist non-secret provider selection, model, custom endpoint, prompt template, and per-provider
  first-send acknowledgement in the single settings row. Fetch model choices dynamically with a
  usable free-text fallback; Custom always uses a free-text model.

### Privacy-bounded prompt
- Replace the dormant Markdown-section prompt assembler with a dedicated structured prompt-context
  read and pure template resolver. Treat every contact-derived value as untrusted data.
- Transmit ranked fuel only through the existing `getRankedFuel` privacy projection: no
  `off_limits`, unconfirmed AI fuel, or blank rows. Include fuel age.
- Send interaction aggregates only: never select, serialize, inspect, or log interaction note or
  detail text. Include gravity tier, intensity, quality, cadence/count aggregates, and newest
  channel with explicit `unspecified` handling.
- Include only live `share_with_ai=1` custom-field values, using `col_name` for safe lookup and
  display label for human-facing text. Unflagged, quarantined, dropped, null, and blank values
  resolve to less data / `None available`, never an error or disclosure.
- The exact assembled prompt appears before the first request to each provider and remains
  inspectable for every subsequent request. Prompt/context limits are explicit, tested, preserve
  rank order, and disclose truncation in the inspector. Assembled prompts and provider secrets are
  never written to debug logs.

### Generation and draft flow
- Compose is the sole editable-draft surface. Its existing Copy guarantee and best-effort SMS
  handoff remain unchanged; generation neither logs a touchpoint nor changes `last_contact`.
- Add AI Suggest to Compose and a profile entry that routes into Compose with serializable params.
  The profile never gets a parallel result UI. All contacts, including never-contacted and rogue,
  remain eligible; sparse context is handled by the prompt rather than button gating.
- A suggestion replaces the editable Compose draft only after confirmation when the current draft is
  non-empty. No dedicated Regenerate control ships; the user may invoke AI Suggest again.
- Use one in-flight request per surface with loading, Cancel, manual abort timeout, navigation/unmount
  cleanup, and stale-result protection. Do not auto-retry uncertain failed requests that may bill
  twice; present a deliberate Retry action for safe user choice.

### Field sharing controls and validation
- Add the existing schema-backed `share_with_ai` flag (default false) to the field editor as an
  explicit per-field control, preserving its metadata and dynamic-column safety boundaries.
- Provider payload parsing, HTTP errors, model-list failure, timeout/abort, and custom endpoint
  validation must return sanitized user-facing errors and never expose request bodies, headers,
  API keys, full endpoints, or provider response content.

### the agent's Discretion
- Exact token-only layout, copy, section order, model-list cache lifetime, bounded prompt limits,
  adapter abstractions, and the default template wording. Keep the implementation dependency-light:
  raw `fetch` plus the first-party Secure Store module, no provider SDK or AI framework.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/AiService.ts` already contains dormant cloud-provider adapters and mocked-fetch
  tests, but its Markdown context assembly, hardcoded models, and prompt logging must be replaced.
- `src/screens/ComposeScreen.tsx` owns the editable draft, Copy guarantee, SMS handoff, archived
  contact guard, and a reserved Phase-14 location.
- `src/db/fuel-read.ts:getRankedFuel` structurally excludes off-limits, unconfirmed-AI, and blank
  fuel in SQL. `src/db/field-values-dao.ts` provides the validated dynamic-column boundary.
- `src/db/app-settings-dao.ts` and migrations `002`/`003` establish the single-row settings and
  forward-only migration pattern. `src/screens/SettingsScreen.tsx` supplies guarded focus reload
  and persistence idioms.

### Established Patterns
- TypeScript correctness-critical logic is pure and node-tested; native/UI interactions have
  explicit Pixel UAT. Database writes use typed DAOs and forward-only migrations.
- Routes carry serializable data only; Compose self-loads by contact id. All UI colors use theme
  tokens; `check:colors` is a build gate.
- New Expo native modules use `npx expo install`, config-plugin registration as appropriate, and a
  clean prebuild/release-build UAT path.

### Integration Points
- Additive migration 004 and typed `app_settings` DAO extension for non-secret AI settings.
- Secure Store wrapper for provider-scoped keys; Settings screen for configuration and field editor
  for `share_with_ai`.
- AI-specific structured context DAO and pure prompt builder feed provider adapters.
- Compose owns generation, inspection, cancellation, and draft replacement; ContactProfile routes
  users into Compose with an AI request intent.

</code_context>

<specifics>
## Specific Ideas

- The product's only network egress is direct provider traffic. Make the disclosure concrete:
  users supply/own/revoke their key and Orbit never copies it into a backup or log; Custom endpoint
  privacy/retention cannot be asserted by Orbit.
- Prefer unary/non-streaming responses for the single short draft. It keeps cancellation, errors,
  and physical-device validation tractable.
- Required tests must prove the outbound payload never contains forbidden fuel, unapproved fields,
  interaction text, prompt text in logs, or secrets in storage/export paths.

</specifics>

<deferred>
## Deferred Ideas

- Multi-variant generation, a dedicated Regenerate action, article summarisation during capture,
  local/Ollama providers, LAN HTTP endpoints, and AI-driven automatic data writes.
- Monetisation/IAP entitlement around AI remains intentionally deferred; the BYO-key architecture
  leaves it addable later without rework.

</deferred>
