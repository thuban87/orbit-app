# ADR-049: BYO-Key AI Configuration and Credential Boundary

**Status:** Accepted
**Date:** 2026-08-18
**Phase:** 14-ai-message-suggestions
**Source decisions:** dossier `13-ai.md` clusters C/D; 14-CONTEXT.md `<decisions>`
**Reversibility:** costly
**Migration:** 004
**Supersedes:** None
**Superseded by:** None

## Context

Orbit needs an optional AI suggestion feature without introducing a service, entitlement layer, or a portable secret. The feature is its sole user-configured network path, so credentials and ordinary configuration need separate persistence boundaries.

## Decision

The system uses four BYO-key providers—OpenAI, Anthropic, Gemini, and HTTPS-only Custom—disabled by default. Provider keys live only in provider-scoped Expo SecureStore; migration 004 keeps non-secret selection, model, endpoint, template, and per-provider acknowledgement state in the singleton SQLite settings row.

## Alternatives Considered

- **A local/LAN Ollama provider** — rejected because it reopens the declined cleartext local-egress path.
- **SQLite- or export-backed API keys** — rejected because a portable backup must not contain live credentials.
- **AI entitlement or IAP gate in v1** — rejected because BYO keys create no Orbit server cost and monetisation is deferred.

## Consequences

### Positive

- Settings remain exportable while credentials remain device-local and re-enterable after uninstall.

### Negative

- A new device requires provider-key reconfiguration, and official model discovery must preserve manual model entry on failure.

### Risks

- SecureStore protects a key at rest but cannot make privacy claims for a user-selected Custom provider.

## Implementation

**Key files:**
- `src/db/migrations/004-ai-settings.ts` — adds only non-secret AI settings and acknowledgement columns.
- `src/db/database.ts` — registers migration 004 and schema version 4.
- `src/db/app-settings-dao.ts` — validates and persists the exportable settings boundary.
- `src/services/ai-key-store.ts` — isolates provider keys in Expo SecureStore.
- `src/services/ai-types.ts` — defines the closed provider and configuration types.

**Depends on:** ADR-005 (AiService Port Omits the Local/LAN Provider)
**Required by:** None
