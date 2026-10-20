# ADR-221: Two Snackbar Looks, Shown Full Width Above the Round Buttons and Held in Place

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-132, D-140, D-143, D-151 (38.10-CONTEXT.md; plan-19 sign-off G4, Q-G4, re-check D1; gap code review IN-04)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-198 (partial — error snackbars' own look, "a `danger` outline, a warning glyph", dies: errors share the warning look; their assertive announcement and alert role, and per-window snackbar hosts above overlays, survive)
**Superseded by:** ADR-254 (partial)

## Context

Snackbars looked like page cards, destructive results read as ordinary notices, the text sat off-centre (O5), the pill's Undo overlapped the + button (O2), and the new section Add button (ADR-219) added a second round button at the bottom.

## Decision

We will use two snackbar looks (D-132, D-140): a **notice**, accent background with `onAccent` text, and a **warning**, for destructive results (deletes, removals) and for errors ("Couldn't save…"). The warning is an inverted pill (`textPrimary` fill and outline, background-coloured text and glyph), AA in every palette. Errors keep their alert role and assertive announcement (38.9 D-72). Root snackbars sit full width just above the round buttons on every screen, whether only the universal + or also a section button shows, with more vertical padding (D-143, replacing D-132's ~80%/~60% widths). A root snackbar keeps the position it appeared at for its whole life, so it does not hop when the section button appears or hides (D-151). The pill passes touches through while the + dial is open, so it cannot fire Undo over "Add Contact" (gap review CR-01). Overlay hosts keep their placement; the shared padding change also makes their pills taller (accepted, D-155).

## Alternatives Considered

- **Width by button presence (~80% left / ~60% centred)** — D-132, replaced by D-143 at the re-check.
- **A third, red error look** — rejected: "two looks in total" (D-140).
- **Let the pill move with the section button** — rejected (D-151).

## Consequences

### Positive

- A delete reads as a warning at a glance; the round buttons stay tappable.

### Negative

- The full-width pill covers more of the screen bottom for its 6 s.

### Risks

- The looks are palette keys resolved at render; a new palette must pass the snackbar contrast check.

## Implementation

**Key files:**
- `src/stores/snackbar-store.ts` — `SnackbarKind` success, warning, error.
- `src/components/snackbar-host.ts` — `snackbarPresentation`, `snackbarLayout`, latched geometry.
- `src/components/Snackbar.tsx` — the pill, padding and touch pass-through while the dial is open.
- `src/stores/section-fab-store.ts` — section-button presence read for placement.
- `src/logic/share-card-logic.ts` — share Undo snackbars with their kinds.

**Depends on:** ADR-198 (Themed Dialogs Through One Imperative Host, an Overlay Registry, and Snackbars Above Overlays); ADR-199 (App-Wide Destructive-Action, Feedback and Validation Standards); ADR-173 (Universal FAB Semantic Visibility)
**Required by:** ADR-254 (Selection Mode Uses a Bottom Two-Row Bar and a More… Sheet)
