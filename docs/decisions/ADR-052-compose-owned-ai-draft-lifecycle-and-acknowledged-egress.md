# ADR-052: Compose-Owned AI Draft Lifecycle and Acknowledged Egress

**Status:** Accepted
**Date:** 2026-08-18
**Phase:** 14-ai-message-suggestions
**Source decisions:** dossier `13-ai.md` cluster A; 14-CONTEXT.md `<decisions>`; 14-05 summary
**Reversibility:** reversible
**Migration:** 004
**Supersedes:** None
**Superseded by:** ADR-079 (partial — acknowledgement and Profile entry)

## Context

AI suggestions must remain user-authored messages, not automatic contact actions. Compose already owns the editable draft, Copy fallback, and best-effort SMS handoff, while the profile needs an entry point without creating a competing result surface.

## Decision

Compose is the sole AI result surface: profile entry routes there with a serializable consume-once intent, and a returned suggestion becomes an editable draft. One lifecycle owns cancellation, timeout, stale-result protection, durable first-send acknowledgement of the exact prompt, and confirmation before replacing a non-empty draft; generation writes neither a touchpoint nor recency.

## Alternatives Considered

- **Compose-only invocation** — rejected because profile browsing also needs a drafting entry point.
- **Profile-owned result UI** — rejected because it duplicates the editable-draft and send flow.
- **Standalone Copy/Regenerate card** — rejected because it loses the mobile Compose handoff.

## Consequences

### Positive

- The inspected, acknowledged, and transmitted prompt is one immutable object, while Copy remains the guaranteed SMS fallback.

### Negative

- A declined, cancelled, timed-out, or stale request intentionally produces no draft and never auto-retries.

### Risks

- An Android SMS composer may ignore a prefilled body; the user must retain the Copy fallback.

## Implementation

**Key files:**
- `src/logic/ai-suggestion-logic.ts` — owns the one-request lifecycle and stale-result guards.
- `src/screens/ComposeScreen.tsx` — renders generation, inspection, acknowledgement, replacement, Copy, and SMS flow.
- `src/screens/ContactProfileScreen.tsx` — provides the configured-provider AI draft entry.
- `src/navigation/ai-suggestion-navigation.ts` — consumes the profile request intent once.
- `src/db/app-settings-dao.ts` — owns the dedicated acknowledgement writer.

**Depends on:** ADR-035 (Native SMS Handoff with Guaranteed Clipboard Copy); ADR-036 (Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails)
**Required by:** None
