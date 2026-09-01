# ADR-053: Local-First LiteLLM AI Model Catalog

**Status:** Accepted
**Date:** 2026-08-18
**Phase:** 14-ai-message-suggestions
**Source decisions:** 14-08 through 14-11 summaries; 14-VALIDATION.md owner close-out
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Provider model-list endpoints are advisory, can require a key, and can expose stale, deprecated, or non-chat choices. A default picker needs to work offline without a provider request while retaining manual entry for models outside its catalog.

## Decision

The system ships a generated LiteLLM-filtered chat-model seed, uses a user-instigated public refresh to maintain a local cache, and renders either all eligible models or at most three latest-per-tier frontier choices per provider. Free-text entry remains available; OpenAI and Gemini omit artificial output caps, while Anthropic receives its catalog-required maximum.

## Alternatives Considered

- **Hardcoded provider model arrays** — rejected because they rot between releases.
- **Provider discovery as the default picker** — rejected because it needs keys/network and can expose unsuitable models.
- **A flat output-token cap** — rejected after it starved thinking models and produced empty or truncated drafts.

## Consequences

### Positive

- First-run and offline settings use a bundled seed; a refresh carries no key or contact data.

### Negative

- The seed is a snapshot and requires developer regeneration when catalog policy changes.

### Risks

- LiteLLM schema or provider naming drift can make a refresh fail; the prior cache or bundled seed remains intact.

## Implementation

**Key files:**
- `scripts/gen-models.ts` — generates the committed LiteLLM-filtered seed.
- `src/ai/model-catalog-filter.ts` — filters and maps provider chat catalog entries.
- `src/ai/model-catalog-cache.ts` — loads cached catalog data and performs explicit refreshes.
- `src/ai/model-registry.ts` — resolves All and latest-per-tier Frontier model choices.
- `src/screens/SettingsScreen.tsx` — exposes model scope and explicit refresh controls.

**Depends on:** ADR-049 (BYO-Key AI Configuration and Credential Boundary)
**Required by:** None
