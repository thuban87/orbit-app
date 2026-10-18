# ADR-238: Review Matches Becomes a List with a Per-Person Sheet, an Already-Linked Contact Is Caught Before the Form, and the Bin Is Never a Link Target

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-107, D-51, D-52, D-53, D-145, D-154, D-155 (38.12-CONTEXT.md; ledger Q-13, Acceptance, mid-execution rulings R1, R1b); carried D-15 (39 D-75)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Review matches showed two-column cards that did not name the likely match. Tapping one did nothing (`onInspect={() => undefined}`), and linking went through two centred dialogs whose list could not scroll or cancel. A pending link queue survived closing, and weak candidates were offered. Single import checked for an existing link only when the user pressed Import, after an editable form. People in the Bin were offered as link targets.

## Decision

Review matches is a one-column list (D-107). Each row shows the incoming person, "Might be: <Orbit name> (+N)" and the strongest evidence. A row with no offered candidate shows "Needs a closer look". Tapping a row opens a bottom sheet titled with that person. It lists the candidate Orbit contacts as scrollable choices, with Link, Import as new, Skip and Cancel, and each outcome confirms with a snackbar ("Linked Ann Lee to Ann Leigh"). Long-press keeps multi-select with the bulk bar (D-15), and the two centred dialogs are gone. The tap is wired in DuplicateReview only, resolving through `resolveAction(action, [item])` with its latched writes (D-51, ADR-168). Reconcile keeps its own card grid and tap.

Closing the sheet clears any pending link queue, but is ignored while a write runs. The row and the sheet read one filtered, ordered choice list: phone and email matches first, nothing scored below "possible" (D-52, ADR-067). Import review's own choices are unchanged.

The already-linked check runs before the review form, through the deterministic `findActiveExternalLink`. The user sees "Already in Orbit as <name>" with Open instead of an editable form (D-53).

People in the Bin are excluded from import matching and are never offered as link targets (D-145). A picked phone contact linked only to a Bin person is never imported as a duplicate (D-154). Single review shows "In the Bin: <name>" with **Open the Bin** and Done, with no Restore outside the Bin list (D-155, ADR-018). Bulk import skips that contact, and Import complete lists it under its own "In the Bin" outcome. A phone contact linked to both a live person and a Bin person counts as "Already in Orbit".

## Alternatives Considered

- **Keep the cards and add "Might be"**, or **one person at a time** — rejected for list plus sheet (Q-13 B, C).
- **Offer Bin people as link targets** — rejected; "No is fine" (R1).
- **Restore from the single import review** — the first D-154 wording; amended by D-155 to Open the Bin, keeping ADR-018's single home for restore (R1b).

## Consequences

### Positive

- The user sees who each incoming person might be before opening anything, and decides one person at a time in a sheet that scrolls and cancels.
- A person already in Orbit, live or binned, is never duplicated by import.

### Negative

- DuplicateReview no longer shares the candidate card grid with Reconcile; the two hosts diverge.

### Risks

- A phone match ranked below several name matches depends on the sort; a device fixture checked this (N-02).

## Implementation

**Key files:**
- `src/components/ReviewMatchesList.tsx` — the one-column list and bulk bar.
- `src/components/MatchChoiceSheet.tsx` — the per-person sheet.
- `src/screens/DuplicateReviewScreen.tsx` — tap to sheet, queue cleared on close, held while writing.
- `src/screens/existing-contact-choices.ts` — `REVIEW_MATCH_CHOICES` ordering and minimum strength; Bin people excluded.
- `src/services/import/duplicate-evidence.ts` — `candidateEvidenceStrength`; the link lookup reports a Bin link, and Bin people are never candidates.
- `src/components/ExistingContactChoice.tsx` — the old centred chooser reshaped.
- `src/screens/ImportReviewAlreadyLinked.tsx` — "Already in Orbit as" and "In the Bin" views.
- `src/screens/ImportReviewScreen.tsx` — the check before the form.
- `src/services/import/import-acquire.ts` — routing a picked contact that is already linked.
- `src/services/import/import-driver.ts` — bulk skips a Bin-linked contact.
- `src/db/import-session-dao.ts` — the in-Bin row outcome.
- `src/screens/ImportCompleteScreen.tsx` — the "In the Bin" outcome.

**Depends on:** ADR-067 (Conservative Advisory Identity Matching and Explicit Source Consolidation); ADR-168 (Truthful Read Phases for Import, Review, and Settings Screens); ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out)
**Required by:** None
