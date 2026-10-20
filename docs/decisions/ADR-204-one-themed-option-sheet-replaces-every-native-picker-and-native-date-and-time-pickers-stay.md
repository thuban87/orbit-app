# ADR-204: One Themed Option Sheet Replaces Every Native Picker; Native Date and Time Pickers Stay

**Status:** Accepted
**Date:** 2026-10-11
**Phase:** 38.9-ux-standards
**Source decisions:** D-28, D-29 (38.9-CONTEXT.md; ledger Q-02, Q-03; owner device ruling L1)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-144 (partial — the native picker for catalogs of 12 or fewer categories dies; the searchable sheet at 13+, the complete catalog, canonical ordering, the NULL Uncategorized policy and the grouped Orrery System selector survive)
**Superseded by:** ADR-255 (partial)

## Context

Single choices used the native `@react-native-picker/picker` spinner in nine places (category on Add/Edit Contact, Import review and Bulk import setup; social battery; Channel, Direction and Tone; the contact-method label), while categories switched to the themed `CategoryChoiceSheet` only at 13 or more (ADR-144). The custom-field dropdown ("Met via") was a third style. The audit read the spinners as part of the app looking like two apps (E-16, B-18), and Phase 39's tour needed a themed sheet it could detect.

## Decision

The system uses one themed single-choice `OptionSheet` (built from `CategoryChoiceSheet`) at every list length, opened from an `OptionSelectRow` trigger (D-28). It is the expanded `Sheet`, registers as an overlay, and draws the selected row in the D-05 top tier. Search appears only above `CATEGORY_SEARCH_THRESHOLD` (12), which no longer switches native versus themed. `CategoryChoiceSheet` is a thin wrapper over it; every native picker site and `DropdownFieldWidget` use it. A stored value outside the option set shows raw on the trigger and is never rewritten; null is an ordinary option value. Re-picking "Other" keeps a typed custom method label. An AST contract rejects any load of `@react-native-picker/picker`, and the package was removed from `package.json`. Short lists keep the tall expanded sheet; sheet sizing is decided per modal later (owner ruling L1). Native date and time pickers stay native; no themed picker is built (D-29), and they keep following Orbit's mode (ADR-176).

## Alternatives Considered

- **Keep the native spinners** — Rejected (Q-02).
- **Build themed date and time pickers** — Rejected; the native ones already follow Orbit's mode, and a themed picker is a large new component (Q-03).
- **A short sheet sized to its rows, as the mockup drew** — Rejected at the device pass; keep the tall sheet (L1).

## Consequences

### Positive

- Every single choice looks and behaves the same, sits in Orbit's theme, and is visible to the overlay registry.

### Negative

- A two-item choice now opens a 92%-height sheet with empty space.

### Risks

- A consumer that branches on the threshold itself would reintroduce two selection styles; screens no longer read `CATEGORY_SEARCH_THRESHOLD`.

## Implementation

**Key files:**
- `src/components/ui/OptionSheet.tsx` — the one single-choice sheet.
- `src/components/ui/OptionSelectRow.tsx` — the 44dp trigger row.
- `src/components/ui/option-sheet-logic.ts` — `optionSheetModel`, `shouldSearch`, `optionKey`.
- `src/components/ui/no-native-picker-contract.test.ts` — AST ban on the native picker package.
- `src/components/category/CategoryChoiceSheet.tsx` — now a wrapper over `OptionSheet`.
- `src/logic/category-logic.ts` — `CATEGORY_SEARCH_THRESHOLD`, now the search threshold only.
- `src/components/field-widgets/DropdownFieldWidget.tsx` — custom-field dropdowns on the sheet.
- `src/components/ContactMethodsEditor.tsx` — the method-label choice.
- `src/components/TouchpointRefineForm.tsx` — Channel, Direction and Tone.
- `src/screens/CreateContactScreen.tsx` — category and social battery.
- `src/screens/EditContactScreen.tsx` — category and social battery.
- `src/screens/ImportReviewScreen.tsx` — import category.
- `src/screens/BulkImportSetupScreen.tsx` — batch category.
- `package.json` — `@react-native-picker/picker` removed.

**Depends on:** ADR-144 (Complete Category Selection and Grouped Orrery System Discovery); ADR-176 (Authored Native Platform Configuration — Release-Only Overlay Removal, Orbit Launcher Identity, and Mode-Following Native Dialogs); ADR-198 (Themed Dialogs Through One Imperative Host, an Overlay Registry, and Snackbars Above Overlays)
**Required by:** ADR-205 (One Date-Only Display Formatter, and Native Pickers for Memory and Custom-Field Dates)
