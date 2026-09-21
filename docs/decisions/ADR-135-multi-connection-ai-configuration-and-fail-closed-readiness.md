# ADR-135: Multi-Connection AI Configuration and Fail-Closed Readiness

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 36-ai-configuration-prompting
**Source decisions:** milestone-2 dossier `phase-16-ai-configuration-prompting` §§B–J; 36-CONTEXT D-03–05, D-09–11
**Reversibility:** one-way
**Migration:** 029
**Supersedes:** None
**Superseded by:** None

## Context

The prior AI settings model held one provider and model, but cannot retain multiple configured lanes or distinguish deliberately disabled AI from an incomplete active configuration. Credentials must remain outside SQLite and portable backup under ADR-049.

## Decision

The system uses durable non-secret connection metadata with one lane-stable active pointer, separately retained provider credentials in SecureStore, and a global AI Enabled setting. Readiness is fail-closed: enabled AI requires an active configured lane, local credential when that lane needs one, and a selected available model; incomplete state is Needs Attention and never silently selects another lane or model.

## Alternatives Considered

- **One mutable provider/model settings record** — rejected because it cannot retain inactive connections and their remembered models.
- **Automatic model or provider fallback** — rejected because it would hide the user-selected connection failure.
- **SQLite- or backup-backed credentials** — rejected because a portable restore must never carry live API keys.

## Consequences

### Positive

- A working connection survives an incomplete or failed setup of another lane.
- Restored configuration cannot incorrectly appear Ready without a newly supplied local credential.

### Negative

- Connection activation and availability require coordinated metadata and SecureStore checks.

### Risks

- Migration 029 is forward-only; lane names and settings defaults must remain validated on every writer and restore path.

## Implementation

**Key files:**
- `src/db/migrations/029-ai-configuration.ts` — adds non-secret settings, connection rows, and personalization storage.
- `src/db/ai-connections-dao.ts` — owns lane CRUD, remembered models, and transactional activation.
- `src/logic/ai-availability.ts` — derives Off, Ready, or Needs Attention without fallback.
- `src/services/ai-key-store.ts` — keeps provider credentials in SecureStore only.
- `src/services/AiService.ts` — resolves generation from the active connection.

**Depends on:** ADR-049 (BYO-Key AI Configuration and Credential Boundary)
**Required by:** None
