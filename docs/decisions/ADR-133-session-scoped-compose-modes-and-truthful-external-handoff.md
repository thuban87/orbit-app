# ADR-133: Session-Scoped Compose Modes and Truthful External Handoff

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 35-messaging-ai-compose
**Source decisions:** dossier `phase-14-messaging-ai-compose` §§C–I, W; CONTEXT D-03–06, D-10
**Reversibility:** one-way
**Migration:** 028
**Supersedes:** None
**Superseded by:** None

## Context

Compose needed to become a drafting workspace for Text and Email without becoming a durable messaging client. It also needed to hand work to native composers honestly while retaining ADR-070/071's durable assist lifecycle and its handoff-time interaction record.

## Decision

The system uses a session-only Compose draft with Text/Email mode, subject, destination, and Message Focus held in memory. Two portable `app_settings` preferences select the initial mode; Compose resolves an actionable primary destination with fallback, hands off through the shared native service, and logs only a user-attested confirmation at the original handoff time.

## Alternatives Considered

- **Durable per-contact message drafts and backup support** — Rejected because Compose state is an in-progress workspace, not a message-record domain.
- **In-app transport, inboxes, or delivery receipts** — Rejected because Orbit hands off to external apps and cannot truthfully observe delivery.
- **Treating an ad-hoc mode switch as a preference change** — Rejected because Remember Last Choice advances only after Copy or Transmit commits the composition.

## Consequences

### Positive

- Manual drafting remains usable without any destination, while Email and Text reuse canonical contact methods.
- A confirmed outreach preserves the sole recency writer and can recover through the app-global assist UI after the Compose session is gone.

### Negative

- A process death or fresh launch intentionally loses an unfinished composition.
- The additive migration makes message-mode preference vocabulary part of the durable settings contract.

### Risks

- Native handoff is not delivery evidence; Compose must never claim that Orbit sent a message.
- A confirmation must retain the assist UID and call `markAssistLogged` so it uses `handoff_at`, not confirmation time.

## Implementation

**Key files:**
- `src/db/migrations/028-compose-message-mode.ts` — adds the forward-only default and remembered Compose mode settings.
- `src/db/app-settings-dao.ts` — validates and reads/writes the durable mode preferences.
- `src/stores/compose-session-store.ts` — holds one non-durable per-contact Compose session.
- `src/logic/compose-logic.ts` — resolves mode fallback, capability, copy, and exit dispositions without UI arithmetic.
- `src/db/contact-methods-dao.ts` — transactionally establishes a selected method as its type's primary destination.
- `src/services/reach-out/handoff.ts` — creates the pending assist before native Text or Email handoff and returns its outcome.
- `src/screens/ComposeScreen.tsx` — composes, copies, transmits, and requests user-attested follow-through.

**Depends on:** ADR-059 (Normalized Contact Methods, Canonical Actionability, and Local Provenance); ADR-070 (Durable Pending Interaction-Assist Lifecycle and Portable Opt-Out); ADR-071 (User-Attested Handoff-Time Interaction Logging Through the Sole Recency Writer); ADR-072 (Shared Actionable Reach Out Router with Native Channel Handoff)
**Required by:** _None._
