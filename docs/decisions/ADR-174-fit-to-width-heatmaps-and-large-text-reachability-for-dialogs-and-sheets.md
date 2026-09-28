# ADR-174: Fit-to-Width Heatmaps and Large-Text Reachability for Dialogs and Sheets

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.4-audit-remediation-ui-performance-release
**Source decisions:** dossier Workstream E; 38.4-CONTEXT D-04, D-13, D-32, D-42(B), D-43, D-47, D-49, D-67, D-72(1, 2), D-73(b); RG-033 (`ui-accessibility/AUD-UIA-010`, `AUD-UIA-021`), RG-034 (`ui-accessibility/AUD-UIA-011`); OA-B2, OA-D3; review C WR-02
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Your Week used fixed 44dp cells. It did not overflow on the narrow Moto Razr but left obvious empty space on the right, and other heatmaps had no fit guarantee. Heatmap tap zones used symmetric slop that overlapped neighbouring cells in every lens. The Profile layout preview's geometry did not match the real overview.

On the device at font scale 2.0, `ConfirmDialog`'s single non-wrapping action row crushed Cancel to an unlabelled sliver, which confirmed RG-034. Later device passes found the same unreachable-action failure in `Sheet` compact/detail bodies, the resume prompts, Import Complete, the group title prompt behind the keyboard, and the post-log Edit Memory form.

## Decision

Heatmaps fit their measured width. `fitHeatmapCell` computes a whole-dp cell edge from `onLayout` width, columns, gap and a bounded maximum, and nothing renders until the width is known.
- Your Week uses `MIN_CELL` 36 as a documented floor and `MAX_CELL` 56, and is centred.
- The ActivityHeatmap day and cycle lenses are fitted and centred; Year is unchanged.
- Every day stays visible with no horizontal scroll.
- Tap zones come from `cellHitSlop`: each side grows toward 44dp but never past half the gap to the neighbouring cell (D-42B).
- The layout preview packs against the shared overview width basis (window − 66dp). It is hidden behind `PROFILE_LAYOUT_PREVIEW_VISIBLE = false` rather than deleted (D-47).

Confirmation and sheet actions stay reachable at large text:
- `ConfirmDialog` measures its actions. It keeps one row when both fit, and otherwise stacks them full-width with Cancel first (`confirmActionsFit`). Its body scrolls inside a card bounded by the window and safe area.
- `Sheet` compact and detail bodies scroll within their unchanged height caps (`SHEET_BODY_SCROLLS`). Self-scrolling consumers opt out with `scrollBody={false}`.
- Compact sheets lift above the keyboard, and their actions stack when they do not fit (`sheetKeyboardLayout`).
- The resume-import and resume-check prompts, Import Complete and the post-log Edit Memory form scroll their bodies with the actions kept reachable. Post-log Edit Memory opens its form by default.

Destructive confirmations stay non-dismissable (ADR-086), and the resume prompts keep explicit-action-only exits.

## Alternatives Considered

- **Wrap Your Week to a 4+3 layout** — not chosen (D-13); the owner asked to auto-size and centre.
- **A plain `flexWrap` action row** — tried and replaced; it produced a right-aligned staircase.
- **Delete the layout preview** — rejected (D-47); it is hidden behind a flag so its geometry tests stay.

## Consequences

### Positive

- Heatmaps use the available width with no overlapping tap zones, and every confirmation and sheet action is reachable at maximum text.

### Negative

- Your Week cells drop below 44dp on screens narrower than about 366dp; this is the accepted D-13 trade-off (D-43 B3).
- Narrow phones now show stacked destructive dialogs even at default text.

### Risks

- Large-text clipping outside sheets and dialogs remains; broad reflow belongs to Phase 40 (D-11).
- The pending-confirmations sheet keeps minor large-text findings (todo `2026-09-28-pending-confirmations-sheet-large-text.md`).

## Implementation

**Key files:**
- `src/components/heatmap-fit.ts` — `fitHeatmapCell` and `cellHitSlop`.
- `src/components/digest/YourWeekHeatmap.tsx` — measured, centred Your Week grid.
- `src/components/history/ActivityHeatmap.tsx` — fitted day/cycle lenses and capped tap zones.
- `src/components/profile/overview-geometry.ts` — shared overview width basis and preview packing.
- `src/components/profile/ProfileLayoutEditor.tsx` — preview hidden behind a flag.
- `src/components/ui/ConfirmDialog.tsx` — measured actions and bounded scrolling body.
- `src/components/ui/confirm-dialog-layout.ts` — `confirmActionsFit`.
- `src/components/ui/Sheet.tsx` — scrolling body and keyboard lift.
- `src/components/ui/sheet-contract.ts` — `SHEET_BODY_SCROLLS` and `sheetKeyboardLayout`.
- `src/components/ResumeImportPrompt.tsx` — scrolling body.
- `src/components/ResumeReconcilePrompt.tsx` — scrolling body.
- `src/screens/ImportCompleteScreen.tsx` — scrolling content with pinned actions.
- `src/components/group/GroupTitlePromptSheet.tsx` — keyboard-safe title prompt.
- `src/components/PostLogNoteEditor.tsx` — scrolling post-log memory editor.
- `src/components/MemoryEditor.tsx` — opens the edited memory's form by default.
- `src/components/ui/confirm-dialog-contract.test.ts` — dialog layout and non-dismissable destructive contract.
- `src/components/ui/sheet-consumers-contract.test.ts` — sheet scroll opt-out contract.
- `src/components/recovery-prompts-large-text-contract.test.ts` — resume prompt contract.

**Depends on:** ADR-086 (Semantic Icons and Accessible Interaction Primitives); ADR-120 (Shared-Window Heatmap and Intensity with Globally-Persisted Lenses); ADR-148 (Portable Your Week Period and Group-Deduplicated Activity Aggregation)
**Required by:** None
