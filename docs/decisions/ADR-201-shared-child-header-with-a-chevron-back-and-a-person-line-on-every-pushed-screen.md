# ADR-201: Shared Child Header with a Chevron Back and a Person Line on Every Pushed Screen

**Status:** Accepted
**Date:** 2026-10-11
**Phase:** 38.9-ux-standards
**Source decisions:** D-16, D-17, D-44, D-45, D-58, D-59, D-64, D-69, D-73 (38.9-CONTEXT.md; ledger Q-19, Q-20, Batches 8, 10, 11; phase code review WR-07; owner device ruling L3); carried D-07
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Pushed screens used about a dozen header and Back styles (boxed, in-body, button and text Backs; header-less focused routes with no Back at all), and five screens painted an opaque `colors.background` over the theme art. ADR-175 already required one Back per screen, the header's, and the phase-01 dossier named `ShellAppBar` the house header (D-01-044), but neither fixed the Back glyph or covered every pushed screen.

## Decision

Every pushed screen in all five tab stacks uses `ShellAppBar variant="child"`, including the formerly header-less focused routes (Crop photo, Import complete, Merge conflicts, Survivor select, Check linked contacts, Check complete, Backup restored, Merge impact summary); tab roots keep `variant="root"`, and only the Profile (ADR-109) and Capture keep their own chrome (D-16). Loading, error and not-found states render the same header. The Back is an icon-only chevron (the registry `back` glyph, as on the Profile) labelled "Back" with a 44dp target (D-44). Confirm-or-abandon screens (Crop photo, Merge impact summary) use `backKind="cancel"`, an icon-only ✕ labelled "Cancel", and Crop photo's footer Cancel goes so the screen has one exit (D-59). An `onBack` override runs after the open-transient check. Person-scoped forms keep a fixed title with a `PersonLine` (avatar and name) under it, with more space than the mockup drew (D-45); Edit Contact shows the title only, because it is where that name and photo are edited (D-64). Compose and AI Research are titled "Compose" and "Research" (D-58). System builder's Preview gets the header, and Back in Preview returns to editing through the guard's sub-editor (D-69). On "Import complete" and "Check complete", header and system Back act like Done (`useBackActsAsDone`, D-73). Pushed screens show the theme art: the opaque fills on Edit Group Event, Edit participant, Group Log, Research and AI Preview go (D-17). The single-Back source contract now covers every pushed screen in every stack.

## Alternatives Considered

- **Text "Back" (BK-A, the recommendation)** — Rejected by the owner, who chose the chevron (Q-19).
- **Chevron plus "Back" text** — Rejected (Q-19).
- **The person line tucked tight under the title, as drawn** — Rejected; the owner asked for more padding (Q-20), and confirmed the device gap as "looks perfect" (L3).
- **The person line on Edit Contact** — Rejected (D-64).
- **Back from a completion screen returns to its setup** — Rejected at code review (D-73); it landed on a leftover "0 contacts selected" setup.

## Consequences

### Positive

- One predictable Back per screen across the app, and the header reads the same on every pushed screen.

### Negative

- Header changes move `settings-chrome-contract.test.ts` lists in the same commit (D-07, ADR-175).

### Risks

- A narrow phone can truncate a title beside a trailing header action (Things to Remember; owner ruling L4, routed to 38.10).
- Whether TalkBack speaks the chevron as "Back" was owner-deferred; the UI tree exposes the label.

## Implementation

**Key files:**
- `src/components/ShellAppBar.tsx` — chevron Back, `backKind="cancel"`, `onBack`, `backDisabled` and the person slot.
- `src/components/PersonLine.tsx` — avatar and name as one accessibility element.
- `src/hooks/use-contact-header.ts` — `useContactHeader(contactId)` for the person line.
- `src/screens/settings-chrome-contract.test.ts` — every pushed screen renders the child header and no in-body Back.
- `src/navigation/back-acts-as-done.ts` — `useBackActsAsDone` for completion screens.
- `src/screens/ImportCompleteScreen.tsx` — header Back acts like Done.
- `src/screens/ReconcileCompleteScreen.tsx` — header Back acts like Done.
- `src/screens/CropPhotoScreen.tsx` — ✕ Cancel header; footer Cancel removed.
- `src/components/MergeImpactSummary.tsx` — ✕ Cancel header.
- `src/screens/SurvivorSelectScreen.tsx` — step two as a guard sub-editor.
- `src/screens/survivor-select-logic.ts` — `canContinueToImpact` and `makeCloseStepTwo`.
- `src/screens/SystemBuilderScreen.tsx` — page-aware header and in-builder Back.
- `src/screens/EditGroupEventScreen.tsx` — header and art (opaque fill removed).
- `src/screens/EditParticipantScreen.tsx` — header, person line and art.
- `src/screens/GroupLogScreen.tsx` — header and art.
- `src/screens/ComposeResearchScreen.tsx` — "Research" header, person line and art.
- `src/screens/AIPreviewScreen.tsx` — opaque fill removed.

**Depends on:** ADR-175 (Header-Only Back and a Shared Root Header on Every Tab Root and Settings Child); ADR-109 (Fixed-Hero Semantic Profile Composition and Focused Accessible Editors); ADR-177 (Mode-Specific Background Art and Signed Per-Combination Art Treatments); ADR-200 (Unsaved-Work Guard in Route, In-Screen Sub-Editor and Overlay Variants)
**Required by:** None
