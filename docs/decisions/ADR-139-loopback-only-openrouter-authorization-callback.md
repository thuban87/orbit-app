# ADR-139: Loopback-Only OpenRouter Authorization Callback

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 36-ai-configuration-prompting
**Source decisions:** 36-CONTEXT D-04, D-05, D-13; 36-11 plan and owner-approved localhost callback correction
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Physical-device testing showed that OpenRouter does not accept Orbit's custom URI as its provider callback. The replacement must retain mandatory anti-CSRF state and PKCE while keeping authorization material out of intents, logs, storage, and any hosted service.

## Decision

OpenRouter authorization uses one temporary Android listener bound to `127.0.0.1` on an OS-assigned port. The provider callback embeds state in that exact localhost URL; native and TypeScript validate the single callback's destination and state before exchanging its code with PKCE. After validation, the listener returns only a credential-free `orbit://openrouter-auth` foreground wake, and only the exchanged key is written to SecureStore.

## Alternatives Considered

- **Use `orbit://openrouter-auth` as OpenRouter's callback** — rejected because the live provider callback contract does not support it.
- **Accept a missing state when PKCE succeeds** — rejected because Orbit always sends state and a missing echo must fail closed.
- **Host a public callback service** — rejected because AI remains a user-configured, local-first capability with no Orbit backend.
- **Manual copy/paste of an authorization code** — rejected because it degrades the recommended connection path and expands exposed secret material.

## Consequences

### Positive

- Browser authorization succeeds on-device without a backend or credential-bearing deep link.
- The callback is bounded, one-shot, and cleaned up on success, failure, timeout, cancellation, and module destruction.

### Negative

- The native module requires a custom Android client and real-device verification.

### Risks

- Any relaxation of localhost binding, exact callback parsing, state validation, or cleanup changes the owner-approved OAuth security posture.

## Implementation

**Key files:**
- `modules/orbit-openrouter-loopback/android/src/main/java/expo/modules/orbitopenrouterloopback/OrbitOpenRouterLoopbackModule.kt` — hosts the bounded one-attempt loopback listener.
- `modules/orbit-openrouter-loopback/src/OrbitOpenRouterLoopbackModule.ts` — exposes the typed native bridge.
- `src/ai/openrouter-oauth.ts` — coordinates PKCE, state validation, exchange, and SecureStore persistence.
- `src/services/ai-key-store.ts` — persists only the returned OpenRouter key.
- `app.config.ts` — retains the credential-free foreground-wake URI handling.

**Depends on:** ADR-135 (Multi-Connection AI Configuration and Fail-Closed Readiness)
**Required by:** None
