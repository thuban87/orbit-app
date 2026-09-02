# ADR-036: Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails

**Status:** Accepted
**Date:** 2026-08-16
**Phase:** 09-compose-screen-sms-handoff
**Source decisions:** 09-CONTEXT “Fuel display” and “Navigation & reuse”; 09-02-SUMMARY; 09-REVIEW WR-01 resolution
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-078 (partial — Off Limits visible on the Research side)

## Context

The compose screen is a cross-phase surface that later notification, widget, and AI flows must open without callbacks or retained caller state. It shows conversational reference material immediately before a user may transmit a message, so stale, private, unconfirmed, or archived data must not become a live handoff surface.

## Decision

The system registers a self-fetching `Compose` route with serializable `{ contactId }` parameters and resets both software and Android hardware Back to Home. It renders all rows from the existing eligible ranked-fuel read, keeps the blank draft in memory only, treats missing or archived contacts as unavailable, and never writes to SQLite from Send or Copy.

## Alternatives Considered

- **Caller callbacks or preloaded compose data** — Rejected because later entry points need a reusable, serializable route contract.
- **Pop Back to the profile** — Rejected because the compose flow must always finish at the dashboard regardless of where it began.
- **An editor read or UI-side privacy filter for fuel** — Rejected because it could expose `off_limits` or unconfirmed AI rows on a transmittable surface.

## Consequences

### Positive

- Notification, widget, and AI work can navigate using only a contact id while the screen reloads current eligible data on focus.

### Negative

- The screen carries focused loading/capability state and must retain its cancellation, archive, and Back-reset guards.

### Risks

- Bypassing the ranked read or allowing an archived header through would expose material on a live messaging surface.

## Implementation

**Key files:**
- `src/screens/ComposeScreen.tsx` — self-fetches, applies fuel/archive guards, and resets both Back paths to Home.
- `src/navigation/types.ts` — declares the serializable `Compose` route parameters.
- `src/navigation/RootNavigator.tsx` — registers the Compose native-stack screen.
- `src/screens/ContactProfileScreen.tsx` — provides the initial Message entry point.
- `src/db/contact-read.ts` — supplies the live/archive state and phone needed by Compose.

**Depends on:** ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out); ADR-019 (Native Stack Contact Lifecycle Navigation); ADR-029 (In-Query Fuel Eligibility and a Shared Ranked Projection).
**Required by:** ADR-040 (Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing); ADR-044 (Headless Widget Actions and Dashboard-Rooted Deep Links); ADR-052 (Compose-Owned AI Draft Lifecycle and Acknowledged Egress); ADR-072 (Shared Actionable Reach Out Router with Native Channel Handoff)
