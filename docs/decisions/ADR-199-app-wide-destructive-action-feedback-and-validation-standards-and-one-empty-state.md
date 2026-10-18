# ADR-199: App-Wide Destructive-Action, Feedback and Validation Standards, and One Empty State

**Status:** Accepted
**Date:** 2026-10-11
**Phase:** 38.9-ux-standards
**Source decisions:** D-19, D-20, D-30, D-31, D-32, D-39, D-46, D-71 (38.9-CONTEXT.md; ledger Q-04, Q-05, Q-06, Q-13, Q-21, Batch 12; owner device ruling L2); carried D-04, D-09, D-12
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-212 (partial); ADR-226 (partial)

## Context

Destructive actions were confirmed, undone or done silently case by case; many writes gave no feedback; Add and Edit Contact built "Enter a name to save." but never rendered it, and their scroll-to-error passed a numeric node handle to `measureLayout`. Empty states were screen-local. Phase 38.9 was to write the rules once so 38.10–38.12 and Phase 39 apply them instead of inventing their own (D-01).

## Decision

**Destructive actions (D-30):** a reversible action happens at once with an Undo snackbar; an irreversible one gets the themed destructive confirm (warning glyph, non-dismissable); a destructive button is never the loudest control at rest; on list cards destructive actions sit behind ⋯. The D-09 carve-outs hold: Purge keeps its impact summary, interaction delete stays a hard, confirmed delete, Unbind stays confirmed. Archive, Restore and Bind act at once with a snackbar naming the person and Undo (D-32), wired by 38.11/38.12. No new recoverable-delete storage is added (D-31): the holding zones remain Archived contacts, memories in Recently Deleted (ADR-089), soft-deleted key people for Undo only, and custom fields in Quarantine; interactions, Off Limits items, photos, Systems and background templates delete permanently and are therefore confirmed.

**Feedback (D-39, D-46):** every write that is silent today shows a snackbar naming the person (and the channel for logs), verb first ("Logged Message with Ann", "Archived Ann Lee"); Undo is offered where reversible and confirms itself ("Log removed"). Every snackbar stays 6000 ms (D-04). 38.9 writes the rule; the areas apply it to their writes.

**Validation (D-19):** one primitive, `FieldError` under the field, cleared when it changes, plus `useFirstErrorReveal`, which measures against the ScrollView's inner content view and scrolls and focuses the first blocking problem on Save; Save stays pressable. Applied to Add/Edit Contact (E-02), Group Log title, System builder name and the bulk-frequency sheet.

**Empty state (D-20, D-71):** one `EmptyState` with an icon, a heading saying what is empty, one help line and one action; a search echo is truncated. Actions: "Clear search" for a search that found nothing, "Log an event" and "Try again" on Events, "Log interaction" on History. "Clear search" stays a primary button (owner ruling L2).

## Alternatives Considered

- **Destructive rule plus always-stated counts** — Not chosen (Q-04 option b).
- **Recoverable deletes for key people, or for key people and interactions** — Rejected; the second reverses phase-11's "no interaction Trash" (Q-05).
- **Archive confirms first** — Rejected; Archive is reversible, so it gets Undo (Q-06).
- **Snackbars on one-tap paths only** — Rejected (Q-13).
- **Other snackbar copy patterns (SN-B/SN-C)** — Not chosen (Q-21).
- **A secondary "Clear search" button as drawn in the mockup** — Rejected at the device pass (L2).

## Consequences

### Positive

- Later phases decide per action only whether it is reversible; the treatment follows.

### Negative

- The rules ship before their application: Archive/Bind Undo and person-naming copy at area writes are deferred to 38.10–38.12 and 39 (Quick Log still read "Logged" at phase close).

### Risks

- An area that adds Undo to another area's screen in passing breaks the per-area ownership the rule relies on.

## Implementation

**Key files:**
- `src/components/ui/FieldError.tsx` — the inline error caption and live region.
- `src/components/ui/use-first-error-reveal.ts` — scroll-and-focus to the first blocking field, measured against the inner content view.
- `src/components/ui/field-error-logic.ts` — `firstBlockingField`, `clearFieldError`, `toFieldErrors`.
- `src/screens/create-contact-logic.ts` — the Add Contact name error and reveal order.
- `src/screens/CreateContactScreen.tsx` — renders the name error; `findNodeHandle` removed.
- `src/screens/EditContactScreen.tsx` — the same primitive on Edit Contact.
- `src/screens/GroupLogScreen.tsx` — Group Log title error separate from the save error.
- `src/screens/SystemBuilderScreen.tsx` — the System name error leaves Preview and reveals Name.
- `src/screens/HomeScreen.tsx` — bulk-frequency sheet error inline; the Contacts no-match empty state.
- `src/components/PhotoSourcePicker.tsx` — URL errors inline; Remove photo as a destructive confirm.
- `src/components/ui/EmptyState.tsx` — the one empty-state component.
- `src/components/ui/empty-state-logic.ts` — `truncateSearchEcho`, `emptyStateHeading`, `SEARCH_ECHO_MAX_CHARS`.
- `src/screens/GroupEventsScreen.tsx` — Events empty, no-match and load-failure states.
- `src/components/history/HistorySection.tsx` — History's empty state on the shared component.
- `src/stores/snackbar-store.ts` — `showSnackbar` and the 6000 ms duration.

**Depends on:** ADR-086 (Semantic Icons and Accessible Interaction Primitives); ADR-089 (Recoverable Memory Lifecycle and Contact-Operation Integrity); ADR-150 (Semantic Profile Hierarchy and Source-Owned Knowledge Editing); ADR-198 (Themed Dialogs Through One Imperative Host, an Overlay Registry, and Snackbars Above Overlays)
**Required by:** ADR-212 (One Delete Pattern for Things to Remember — At Once with Undo, Then Permanent); ADR-221 (Two Snackbar Looks, Shown Full Width Above the Round Buttons and Held in Place); ADR-226 (Archive Becomes the Bin, and Move to Bin Confirms First with No Undo); ADR-227 (One Snooze Sheet for the Profile Tile, Profile ⋯, Contacts Card and Bulk Bar); ADR-232 (A Binned Person Gets a Bin Banner, an "In the Bin" Status and DAO Guards, and the Bin List Reloads with Restore and Undo); ADR-246 (One Settings Row and Section Card on Every Settings Page, One Drag-and-⋯ List Pattern, a Truthful About Privacy Line, and Plain Switch Labels)
