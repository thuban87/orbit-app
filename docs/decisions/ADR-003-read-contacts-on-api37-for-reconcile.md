# ADR-003: `READ_CONTACTS` on API 37+ for Reconcile

**Status:** Accepted
**Date:** 2026-08-26
**Phase:** 20-contact-reconciliation-merge
**Source decisions:** 20-UAT-BLOCKER-read-contacts.md; 20-06-SUMMARY.md owner-approved resolution
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-002 (partial)
**Superseded by:** None

## Context

Reconciliation re-reads already-linked Android contacts to detect current drift. Device UAT on API 37 showed that ADR-002's `maxSdkVersion="36"` permission cap left this direct provider read without `READ_CONTACTS`; the one-shot system picker cannot supply an ongoing linked-set comparison.

## Decision

The system enables `READ_CONTACTS` on API 37+ only for a user-initiated reconciliation re-read. Both manifest enforcement points remove the cap, screens request permission in context before reading, and import continues to use its permissionless API-37+ picker path.

## Alternatives Considered

- **Re-pick the linked set with the system picker** — rejected because it cannot provide ongoing change detection.
- **Limit reconciliation to API 36 and below** — rejected because modern Android would lose the feature.
- **Retain the cap as a known gap** — rejected by the owner after device UAT.

## Consequences

### Positive

- Reconciliation works on API 37+ while retaining ADR-002's import design.

### Negative

- A user-visible Contacts permission and a Play Console CRM / Contact Management declaration become release obligations.

### Risks

- Permission can be denied or revoked; reconciliation must show a recoverable access state.

## Implementation

**Key files:**
- `modules/orbit-contact-picker/android/src/main/AndroidManifest.xml` — declares the library permission without an API-36 cap.
- `plugins/withContactPickerPermission.js` — writes the decisive app-manifest permission declaration during prebuild.
- `src/services/contacts/use-read-contacts-permission.ts` — checks, requests, and recovers the runtime grant for reconciliation.
- `src/screens/ReconcileDetailScreen.tsx` — gates a per-contact source re-read behind permission.
- `src/screens/ReconcileGridScreen.tsx` — gates the linked-contact batch read behind permission.

**Depends on:** ADR-002 (Cross-Version Contact Import — Hybrid Two-Picker)
**Required by:** None
