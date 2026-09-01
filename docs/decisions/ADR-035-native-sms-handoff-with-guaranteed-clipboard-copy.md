# ADR-035: Native SMS Handoff with Guaranteed Clipboard Copy

**Status:** Accepted
**Date:** 2026-08-16
**Phase:** 09-compose-screen-sms-handoff
**Source decisions:** 09-CONTEXT “SMS + Copy handoff mechanics”; 09-01-SUMMARY
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-061 (partial)

## Context

Compose needs a user-invoked text handoff that preserves a draft containing punctuation, newlines, or emoji without claiming that a message was sent. A phone number can be absent and Android SMS availability is device-dependent, so the surface needs a reliable alternative.

## Decision

The system uses `expo-sms.sendSMSAsync` for best-effort, prefilled SMS-composer handoff and `expo-clipboard.setStringAsync` as the guaranteed Copy handoff. Phone and device capability determine whether Send appears; Copy remains available in every state, and neither action writes a touchpoint or changes contact recency.

## Alternatives Considered

- **React Native `Linking` with an `sms:` URI** — Rejected because Android capability detection can fail under package visibility and URI encoding can corrupt draft content.
- **Send-only handoff** — Rejected because the receiving SMS app may not honor its prefilled body and no-phone or no-SMS devices still need a usable handoff.

## Consequences

### Positive

- Native address/body marshalling avoids a hand-built messaging URI and Copy remains usable without telephony.

### Negative

- The two autolinked Expo modules require a clean prebuild and release build for device verification.

### Risks

- Android can report an unknown composer outcome, so the app must not display sent confirmation or record a contact event.

## Implementation

**Key files:**
- `package.json` — declares the SDK-pinned `expo-sms` and `expo-clipboard` native modules.
- `src/logic/compose-logic.ts` — resolves the tested phone and SMS-capability control states.
- `src/db/contact-read.ts` — additively exposes the contact phone through the lightweight header read.
- `src/screens/ComposeScreen.tsx` — invokes the native handoffs with a Send latch and Copy fallback.

**Depends on:** _None._
**Required by:** ADR-052 (Compose-Owned AI Draft Lifecycle and Acknowledged Egress); ADR-061 (DAO-Selected Actionable Primary SMS Handoff); ADR-072 (Shared Actionable Reach Out Router with Native Channel Handoff)
