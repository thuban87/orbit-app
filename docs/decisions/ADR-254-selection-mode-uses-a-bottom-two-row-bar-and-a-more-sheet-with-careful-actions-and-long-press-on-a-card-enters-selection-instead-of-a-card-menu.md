# ADR-254: Selection Mode Uses a Bottom Two-Row Bar and a More… Sheet with Careful Actions, and Long-Press on a Card Enters Selection Instead of a Card Menu

**Status:** Accepted
**Date:** 2026-10-19
**Phase:** 38.13-contacts-list-search-digest-ux
**Source decisions:** D-69, D-72, D-74, D-75, D-76, D-40, D-41, D-77, D-80, D-89 (F1), D-90 (38.13-CONTEXT.md; ledger Batches 5–7, plan-phase OQ-1, convergence cycle 2 Q2, Batch 11); carried D-18
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-102 (partial — the rejected "bottom action bar" alternative and "Selection replaces the normal control area" die, and Move to Bin joins Change Contact Frequency in the careful group instead of a routine Archive button; the frozen entry-time universe, Select All over that snapshot, card taps toggle, Back exits selection first, explicit Add/Remove wording, careful-group separation and count-aware log routing survive); ADR-221 (partial — a live root snackbar may move once, upward, when the selection bar appears; it never moves for FAB morphs, the keyboard or the bar going away)
**Superseded by:** None

## Context

Card-view selection replaced the control row at the top with a count, Select All, Done and nine wrapping buttons that filled about half the screen (owner: "you're selecting from a tiny portion of the screen while this stupid menu takes up the top 50% statically"). Select All never became Deselect all, every action was enabled whatever was selected, "Working…" showed while a confirm still waited, and long-press opened a per-card context menu.

## Decision

The selection bar is mockup M3b, at the bottom above the tab bar (D-69, D-72): row one is [✕] "N selected" … "Select All"; row two is four equal bordered buttons, icon over label: Quick Log, Snooze, Favorite, More…. While selecting, the Population/Filters/Sort row, the search row, the + button and the ⋯ entries that change the query (Reset, Select Contacts) are hidden, so the frozen universe stays frozen (D-76). Select All reads "Deselect all" once everything is selected, and each action is disabled when it cannot apply (D-40). Favorite always adds and never flips; it is disabled when everyone selected is already a favourite (D-74). More… holds Log Interaction, Remove from Favorites (only when a selected person is a favourite), Set Category, then a "Careful actions" group: Change Contact Frequency, Move to Bin (D-75, D-18). "Working…" shows only once an action is confirmed (D-41). Unbound people from an All Contacts search are selectable; Favorite, Remove from Favorites and Snooze skip them through an action-time database read (`readSelectionLifecycle`, `bulkWriteIds`), and the other actions apply (D-77, ADR-233). A root snackbar lifts once to sit above the bar when it appears and stays there (D-80). A Digest drill ends selection before changing the Contacts query (D-89 F1). Long-press on a card enters selection with that card selected; the per-card context menu is retired and its eight actions remain as card accessibility actions, so nothing depends on long-press (D-90).

## Alternatives Considered

- **The owner's three-row draft (M1), M2, or bare-icon M3** — not chosen (Batch 6; M3b picked from real mockups).
- **Keep the bar at the top (B2/R2)** — rejected (Q-15, Q-17).
- **A Favorite button that flips to Unfavorite** — rejected (Q-18 caveat); removal is hidden under More….
- **A greyed, visible control row while selecting (H2)** — rejected (Q-19).
- **Exclude Unbound people from the selection universe** — not chosen (OQ-1).
- **Strict D-151: the pill may sit under the bar** — not chosen (convergence Q2).
- **Keep the per-card context menu** — retired by the owner after the device batch (D-90).

## Consequences

### Positive

- Selection uses the full grid; the bar matches the signed-off mockups (S1, S2).

### Negative

- Bulk Favorite writes only Bound non-favourites and Remove only Bound favourites, so counts are exact but a selected Unbound or already-favourite person is silently skipped.
- A snoozed Unbound person can no longer be unsnoozed from the bulk sheet.

### Risks

- The drill's exit relies on Home's bulk sheets being modal over the tab bar; a non-modal bulk surface would leave a sheet or claim behind (verification advisory).

## Implementation

**Key files:**
- `src/components/BulkActionSurface.tsx` — the M3b bar and the More… sheet with its Careful actions group.
- `src/logic/dashboard-selection-applicability.ts` — `selectionApplicability`, `selectAllLabelFor`, `bulkWriteIds`, `SELECTION_INCLUDES_UNBOUND`.
- `src/db/dashboard-read.ts` — `readSelectionLifecycle`.
- `src/stores/dashboard-selection-store.ts` — `deselectAll`.
- `src/logic/dashboard-bulk-action-session.ts` — pending reported on consume, not acquire.
- `src/components/snackbar-host.ts` — `bottomBarHeight`; upward-only re-latch.
- `src/components/UniversalFab.tsx` — hidden on Home while selecting.
- `src/screens/dashboard-overflow-actions.ts` — Reset and Select Contacts dropped while selecting.
- `src/screens/HomeScreen.tsx` — hidden rows, bar placement, `enterCardSelection`.
- `src/screens/DigestScreen.tsx` — the drill ends selection first.
- `src/components/CardGrid.tsx` — long-press enters selection.
- `src/components/GridCard.tsx` — card accessibility actions; `onLongPress` kept while selecting.
- `src/components/CardContextMenu.tsx` — deleted (D-90).

**Depends on:** ADR-102 (Frozen-Universe Dashboard Multi-Select); ADR-103 (Atomic Composed Dashboard Bulk Mutations); ADR-221 (Two Snackbar Looks, Shown Full Width Above the Round Buttons and Held in Place); ADR-227 (One Snooze Sheet for the Profile Tile, Profile ⋯, Contacts Card and Bulk Bar); ADR-233 (The Profile ⋯ Follows Lifecycle State, Bind and Unbind Show Undo, and Unbound People Get a Bind-Card Frequency, a Disabled Star and a Settings Row)
**Required by:** None
