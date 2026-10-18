# ADR-236: Check Linked Contacts Never Re-Asks a Reviewed Difference, Applies Only Tapped Values, and Only a User's Tick Elects a Primary

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-45, D-132, D-50, D-47, D-102, D-144, D-148, D-48, D-163, D-162, D-164, D-46, D-141, D-49, D-103, D-104 (38.12-CONTEXT.md; ledger Q-08, Q-09, Q-10, Q-P1, mid-execution rulings Q4, Q9, R4, device batch PHO, PRE, ZERO); carried D-22
**Reversibility:** one-way
**Migration:** 034
**Supersedes:** ADR-179 (partial — the persistent Galaxy Dark danger string "Unlink source" dies as a label: it reads "Unlink from phone contact"; its opaque backing and red styling survive on the renamed string)
**Superseded by:** None

## Context

Every reviewed linked contact came back on every check. The classifier emitted `unchanged-since-review` and nothing filtered it. A kept Orbit photo was remembered as a path while the source was compared by hash, and an impossible phone birthday was offered and then refused at apply. A missing-source "Keep as is" was not remembered at all, and the grid and detail read the memory differently. Apply added every phone value with its labels dropped. Developer words ("Source missing", "Manual review") showed to users, and the bulk "Apply recommendation" did nothing.

## Decision

**Reviewed differences never come back (D-45).** The scan and the detail drop unchanged-since-review fields, and the cards store only actionable fields. The grid and detail read the memory the same way through `reconcile-memory-read`, with the region `override ?? device`. A source's photo is compared by a fingerprint of the phone's own photo (`photoFingerprint`, SHA-256 of the thumbnail bytes) rather than the stored master. Import records that fingerprint, so the full-size import of ADR-240 is not seen as a difference (D-132). Kept Orbit photos are remembered with the same comparable value. An unreadable phone birthday is dropped at classify time. A missing-source "Keep as is" is remembered in a new `'source'` review family (migration 034 widens `reconcile_source_snapshot.field_family`). The detail Apply records its completion disposition, and the grid's card UPDATE moved into a DAO (D-50).

**Only what the user taps is applied (D-47).** The Orbit option shows readable methods, one per line. Source options show the phone's value with its own label ("Work · (312) 555-0122"), and Apply adds only the options chosen, with their labels. Picking the phone's value adds it as the primary and keeps the old Orbit value as a secondary. Nothing is deleted (D-102). Pre-ticked new values are still added, but only a value the user ticked becomes primary. Unticking a pre-ticked value does not count as a choice, so with no tap Orbit's primary stays (D-144, D-148).

**Feedback (D-48).** A successful Apply returns to the grid with a snackbar and cannot re-run. Every choice row shows a visible radio or checkbox, and a choice shown selected enables Apply without a second tap (D-163). The keep-photo option reads "Keep Orbit photo", or "Keep no photo" when Orbit has none (D-162). "Not in phone Contacts" cards show no "N differences left" line (D-164).

**Words and counts.** Check complete counts contacts with `plural()` (D-46). Its buckets are exclusive: a missing-source card counts once, under the not-in-phone count (D-141). The grid and detail use one name, "Check linked contacts" (D-49). The four developer labels become "Not in phone Contacts", "Needs your choice", "Link to a different phone contact" and "Unlink from phone contact", which keeps its red styling (D-103). Check linked contacts has no "Apply recommendation"; Review matches keeps its own (D-104).

Reconcile stays one-way and user-triggered, and never deletes (D-22, ADR-068).

## Alternatives Considered

- **Replace the Orbit value with the phone's** — rejected; never auto-delete (Q-08 B).
- **Add the phone's value without making it primary** — rejected for primary plus kept secondary (Q-08 C).
- **Make "Apply recommendation" real with per-card recommendations** — rejected; remove it here (Q-10 B).
- **Accept one re-ask of every linked person with a phone photo after full-size import** — the research option; the owner asked for a stored ID instead (Q-P1), which became D-132.
- **Any pre-ticked value can become primary** — rejected; only an explicit tick (Q9, R4).

## Consequences

### Positive

- A check after resolving everything opens empty.
- No Orbit value is lost when the user takes the phone's.

### Negative

- The Orbit side can accumulate secondary methods the user never cleans up.

### Risks

- Migration 034's table rebuild is one-way; it copies, counts and verifies every review row before dropping the old table.
- If Android changes the thumbnail bytes for an unchanged photo, the fingerprint changes and that person is asked once again.

## Implementation

**Key files:**
- `src/db/reconcile-memory-read.ts` — `loadReviewMemory`, `classifyLinkedContact`, `scanLinkedContacts`, one memory read for grid and detail.
- `src/logic/reconcile-diff.ts` — `actionableReconcileFields`, photo comparable value, unreadable birthdays dropped, `orbitMethods`.
- `src/logic/reconcile-selection.ts` — tapped options only, `electPrimary`, `buildReconcileSelections`.
- `src/db/reconcile-apply.ts` — primary election, Keep Orbit photo memory inside the apply transaction.
- `src/db/reconcile-snapshot-dao.ts` — the `'source'` family, `MISSING_SOURCE_KEPT`, `recordImportedPhotoFingerprint`.
- `src/db/reconcile-session-dao.ts` — `setCardCompletionDisposition`.
- `src/db/reconcile-session-read.ts` — exclusive Check complete counts.
- `src/db/migrations/034-snooze-review-memory-resume.ts` — part a, the `field_family` CHECK widened.
- `src/logic/picked-method-label.ts` — the phone's own method label.
- `src/screens/ReconcileGridScreen.tsx` — no Apply recommendation; the card write through the DAO.
- `src/screens/ReconcileDetailScreen.tsx` — Apply returns to the grid with a snackbar.
- `src/screens/ReconcileCompleteScreen.tsx` — contact counts.
- `src/components/FieldChoiceGroup.tsx` — radio and checkbox selection look, multi-pick.
- `src/components/CandidateCardGrid.tsx` — no count line on not-in-phone cards.
- `src/components/PhotoChoice.tsx` — "Keep Orbit photo" / "Keep no photo".
- `src/constants/glossary.ts` — `CHECK_LINKED_CONTACTS`, `NOT_IN_PHONE_CONTACTS`, `NEEDS_YOUR_CHOICE`, `LINK_DIFFERENT_PHONE_CONTACT`, `UNLINK_FROM_PHONE_CONTACT`.
- `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/PhotoFingerprint.kt` — the photo fingerprint.
- `src/logic/reconcile-second-scan.test.ts` — a second scan after resolving everything produces no cards.

**Depends on:** ADR-068 (User-Triggered, Source-Only Reconciliation with Durable Review); ADR-059 (Normalized Contact Methods, Canonical Actionability, and Local Provenance); ADR-206 (Glossary — Canonical Terms Kept, Retired Forms Enforced, Plain-Word Rewrites, and a Shared Plural Helper)
**Required by:** None
