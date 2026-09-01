# ADR-061: DAO-Selected Actionable Primary SMS Handoff

**Status:** Accepted
**Date:** 2026-08-27
**Phase:** 18.1-contact-method-normalization
**Source decisions:** dossier `18-contact-data-normalization` clusters B, D, and O; 18.1-05 summary
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-035 (partial)
**Superseded by:** None

## Context

After migration 009, a contact can have several phone rows and a scalar header phone no longer exists. Profile and Compose must show durable display values without independently parsing endpoint data, and the existing native handoff must never receive an invalid or ambiguous destination.

## Decision

The system uses the method-read DAO's selected actionable primary phone as the only SMS destination. Profile renders stored display and actionability state without exposing canonical values, while Compose retains its existing Copy fallback whenever no actionable primary phone is available.

## Alternatives Considered

- **Reparse raw method input in Profile or Compose** — Rejected because region-sensitive actionability and canonical identity have one DAO-owned boundary.
- **Choose the first stored phone row** — Rejected because it can be invalid or not the user-selected primary.
- **Remove Copy when SMS is unavailable** — Rejected because the established handoff remains useful without a phone or SMS capability.

## Consequences

### Positive

- The OS receives only a canonical destination selected from stored actionable state.
- Invalid and incomplete methods remain visible and editable without becoming handoff inputs.

### Negative

- Profile and Compose must make an additional method read instead of using a scalar contact-header field.

### Risks

- A UI or logging path that exposes raw/canonical method data is a privacy boundary failure; focused tests and device UAT cover suppression.

## Implementation

**Key files:**
- `src/db/contact-methods-read.ts` — selects the actionable effective primary phone.
- `src/screens/contact-profile-logic.ts` — shapes safe method presentation for Profile.
- `src/screens/ContactProfileScreen.tsx` — renders method groups and invalid-state helpers.
- `src/logic/compose-logic.ts` — resolves SMS and Copy control states from an actionable primary.
- `src/screens/ComposeScreen.tsx` — passes only the selected canonical destination to the native SMS handoff.

**Depends on:** ADR-035 (Native SMS Handoff with Guaranteed Clipboard Copy); ADR-059 (Normalized Contact Methods, Canonical Actionability, and Local Provenance)
**Required by:** None.
