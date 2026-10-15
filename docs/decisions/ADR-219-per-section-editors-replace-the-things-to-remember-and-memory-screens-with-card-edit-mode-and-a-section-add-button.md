# ADR-219: Per-Section Editors Replace the Things to Remember and Memory Screens, with Card Edit Mode and a Section Add Button

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-08, D-63, D-64, D-75, D-115, D-130, D-131, D-144, D-145 (38.10-CONTEXT.md; ledger Q-13, Q-14, Q-46 note, Q-48; convergence c2 Q-P4; plan-19 sign-off and re-check); carried D-19
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-150 (partial — the scoped `FuelEditor` wrapper for Off Limits dies; scoped Off Limits write safety survives, and its rejected "Build a dedicated Off Limits editor model" is revived by the owner's 38.4 D-54)
**Superseded by:** None

## Context

The Things to Remember editor screen edited only some sections, each differently; the owner wanted it gone and each pencil to open an editor for just that section (Q-46, Q-48). The Memory screen sat between + → Memory and the form and returned with no feedback (G-11). Off Limits rode on the old Fuel editor (38.4 D-54). At sign-off, forms opened below long lists, off screen (O1).

## Decision

We will retire the Things to Remember editor screen and the Memory screen (D-63, D-75). Each section gets its own editor: Last Talked About and Current Location → their history page (ADR-210); Key People → `KeyPeopleEditorScreen`; Off Limits → a rebuilt `OffLimitsEditorScreen` on the `off_limits` table with one shared `OffLimitsForm` (D-08); Memories, Thought of Them, Gift Ideas and Imported → one `SectionEditorScreen` design per type; Custom Fields → Edit Contact. + → Memory opens the add form directly (`MemoryAddScreen`) and returns where the user started, with "Memory saved for <name>" and a way to open that Profile (D-63, D-64). Update Contact → Memory edits in place inside Update Contact with a type picker (Memory, Gift Ideas, Thought of Them), the one exception to the shared editors (D-115). On the section pages each card has a pencil; tapping it or the card opens that card's form in place, revealing Move and a red Delete; Open link stays visible (D-130). The Add button sits at the top of every section page and, scrolled out of view, morphs into a second round button at the bottom left showing the page's icon with a small +; it is driven on the UI thread and pauses when blurred or backgrounded (D-131). While a form is open, held cards are dimmed and the empty-state text hides (D-144, D-145). Every surface applies the 38.9 standards (D-19).

## Alternatives Considered

- **One Things to Remember screen edits every section** — the owner's first answer (Q-13), withdrawn by D-75 once its scope was clear.
- **Keep the scoped FuelEditor wrapper** — rejected by the owner's 38.4 D-54 ruling.
- **The forms open below the list** — rejected at sign-off (O1).
- **A separate phase for the section button** — rejected: "no use being stingy now" (D-131).

## Consequences

### Positive

- Each section edits the way its data works; + → Memory lands back where the user was (fixes G-11).

### Negative

- Update Contact's in-place memory editor is a second host of the memory form to keep aligned.

### Risks

- The morph runs on Reanimated worklets; a helper defined below its caller crashes Hermes on device (memory note), which vitest cannot catch.

## Implementation

**Key files:**
- `src/screens/SectionEditorScreen.tsx` — the memory-type section editor.
- `src/screens/section-editor-logic.ts` — titles, entries, Add labels, snackbars.
- `src/screens/KeyPeopleEditorScreen.tsx` — the Key People editor.
- `src/screens/OffLimitsEditorScreen.tsx` — the rebuilt Off Limits editor.
- `src/screens/off-limits-editor-controller.ts` — scoped re-read before every write and Undo.
- `src/components/OffLimitsForm.tsx` — the one Off Limits form.
- `src/screens/MemoryAddScreen.tsx` — + → Memory add form.
- `src/screens/UpdateContactScreen.tsx` — the in-place memory editor.
- `src/components/MemoryEditor.tsx` — card edit mode, fixed type, Allow AI in the draft.
- `src/components/MemoryCard.tsx` — pencil, link Open, pushpin.
- `src/components/RelationshipEditor.tsx` — card edit mode, top Add, live linked names.
- `src/components/card-edit-slots.ts` — where an open form renders.
- `src/components/SectionAddFab.tsx` — the morphing section Add button.
- `src/components/section-add-fab-logic.ts` — morph worklets and tunables.
- `src/stores/section-fab-store.ts` — section-button presence for snackbar placement.
- `src/navigation/types.ts` — SectionEditor, KeyPeopleEditor and Memory routes.
- `src/screens/ThingsToRememberScreen.tsx` — deleted.
- `src/screens/MemoryScreen.tsx` — deleted.
- `src/screens/off-limits-draft-adapter.ts` — deleted.

**Depends on:** ADR-150 (Semantic Profile Hierarchy and Source-Owned Knowledge Editing); ADR-168 (Truthful Read Phases for Import, Review, and Settings Screens); ADR-200 (Unsaved-Work Guard in Route, In-Screen Sub-Editor and Overlay Variants); ADR-173 (Universal FAB Semantic Visibility)
**Required by:** None
