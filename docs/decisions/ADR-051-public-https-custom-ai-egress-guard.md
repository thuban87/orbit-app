# ADR-051: Public-HTTPS Custom AI Egress Guard

**Status:** Accepted
**Date:** 2026-08-18
**Phase:** 14-ai-message-suggestions
**Source decisions:** dossier `13-ai.md` cluster C; 14-REVIEWS.md; 14-07/06 summaries
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

A user-configured OpenAI-compatible endpoint controls a network destination. Scheme-only validation cannot prevent a hostname from resolving to a private address, following a redirect, or bypassing origin validation through a proxy.

## Decision

The Custom provider accepts only validated public HTTPS endpoints and sends them exclusively through the native `orbit-secure-fetch` transport. JavaScript rejects malformed, credentialed, `.local`, and non-public literal URLs; the native layer resolves once, rejects non-public destinations, pins the vetted address, disables redirects and proxy routing, and exposes only sanitized failures.

## Alternatives Considered

- **Plain HTTP or LAN Custom endpoints** — rejected because they weaken the app-wide cleartext and local-egress posture.
- **Raw React Native fetch with redirect handling** — rejected because it cannot enforce connection-time address and redirect guarantees on Android.
- **Dropping Custom entirely** — rejected because HTTPS Custom still supports compatible hosted and self-hosted providers.

## Consequences

### Positive

- The user-controlled destination has URL-, DNS-, literal-, redirect-, and proxy-layer protections.

### Negative

- Some unusual non-public or over-blocked address ranges cannot be used as Custom endpoints.

### Risks

- The owner approved a single device smoke test in place of the original full on-device escape matrix; remaining address cases rely on the green shared-vector JVM tests.

## Implementation

**Key files:**
- `src/ai/custom-endpoint.ts` — validates Custom endpoint literals before persistence or transport.
- `src/ai/secure-fetch.ts` — provides the sanitized JavaScript wrapper and host re-check.
- `src/services/AiService.ts` — routes Custom generation through the guarded transport.
- `modules/orbit-secure-fetch/src/OrbitSecureFetchModule.ts` — performs native address, redirect, proxy, and cancellation enforcement.
- `src/ai/__fixtures__/non-public-vectors.json` — shared non-public address test vectors.

**Depends on:** ADR-005 (AiService Port Omits the Local/LAN Provider)
**Required by:** None
