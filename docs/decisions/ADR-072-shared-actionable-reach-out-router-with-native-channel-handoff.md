# ADR-072: Shared Actionable Reach Out Router with Native Channel Handoff

**Status:** Accepted
**Date:** 2026-08-31
**Phase:** 21-interaction-assist-reach-out
**Source decisions:** dossier `21-interaction-assist-reach-out` clusters A, B, C, D, AC, AD
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Reaching out from Orbit needs one reusable path shared by the profile, Compose, and the widget, rather than per-surface communication code. `contact_methods.is_actionable` records only "valid phone" vs "valid email" — phone line-type is parsed then discarded — so route enabling is phone/email-granular, not channel-granular. A person with several numbers or emails needs endpoint disambiguation without forcing a tap when only one endpoint exists.

## Decision

The system exposes one `performReachOut` handoff service and a `ReachOutRouter` that offers only channels backed by an actionable stored method: any actionable phone enables **both** Call and Text (a landline is offered as textable), any actionable email enables Email. The path is at most three taps — Reach Out → channel → (endpoint, only when ≥2 exist for that channel) — launching directly on a single endpoint and emphasizing the primary method when a selector is shown. If a contact has no actionable phone or email at all, the Reach Out action is hidden entirely (no dead entry point). Native handoff is `expo-sms` `sendSMSAsync` for Text and `Linking.openURL('tel:'|'mailto:')` for Call/Email; the selected endpoint is operational context only and never becomes endpoint-level history. Compose Send routes through the same `performReachOut` (creating a pending assist, writing no interaction at send time).

## Alternatives Considered

- **Per-endpoint call-vs-text gating** — rejected because shipped code stores no line-type; separating Text from Call per endpoint is net-new work out of Phase 21 scope.
- **Open an empty modal for method-less contacts** — rejected in favor of hiding the action so there is no dead entry point.
- **Always show the endpoint selector** — rejected; a single usable endpoint launches directly to keep the common path to two taps.
- **Promote provider channels (WhatsApp/Signal, SMS vs RCS, Gmail vs Outlook)** — rejected; interaction history stays intentionally coarse (`call`/`text`/`email`).
- **Compose writes the interaction at Send** — rejected; Send only hands off and creates intent, preserving intent-vs-confirmed-contact.

## Consequences

### Positive

- Every surface (profile, Compose, widget) reuses one router and one handoff seam, so channel logic lives in exactly one place.

### Negative

- A landline is offered as textable and Text is never gated separately from Call, because per-endpoint capability is not stored.

### Risks

- Native handoff content leaves via OS intents the user invokes; no delivery is claimed and no content egresses to any server (T-21-05, accepted).

## Implementation

**Key files:**
- `src/components/ReachOutRouter.tsx` — the themed channel chooser that hides on no-route, launches directly on one endpoint, and opens the selector on many.
- `src/components/EndpointSelector.tsx` — the scrollable phone/email chooser with the primary method emphasized.
- `src/services/reach-out/handoff.ts` — `performReachOut`: the shared Call/Text/Email native launch over canonical method values.
- `src/db/contact-methods-read.ts` — the pure actionable-primary method selection reused by every reach-out caller with no second query.
- `src/screens/ContactProfileScreen.tsx` — derives the profile Reach out entry synchronously from already-loaded method groups.
- `src/screens/ComposeScreen.tsx` — routes Send through `performReachOut` with the draft, writing no interaction.

**Depends on:** ADR-059 (Normalized Contact Methods, Canonical Actionability, and Local Provenance); ADR-061 (DAO-Selected Actionable Primary SMS Handoff); ADR-035 (Native SMS Handoff with Guaranteed Clipboard Copy); ADR-036 (Entry-Agnostic Compose Navigation and Transmittable Fuel Guardrails)
**Required by:** None
