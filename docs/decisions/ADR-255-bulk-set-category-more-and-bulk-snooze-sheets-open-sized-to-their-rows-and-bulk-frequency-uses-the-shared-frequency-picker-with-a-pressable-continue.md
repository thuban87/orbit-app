# ADR-255: Bulk Set Category, More… and Bulk Snooze Sheets Open Sized to Their Rows, and Bulk Frequency Uses the Shared Frequency Picker with a Pressable Continue

**Status:** Accepted
**Date:** 2026-10-19
**Phase:** 38.13-contacts-list-search-digest-ux
**Source decisions:** D-39, D-71, D-78, D-85, D-87 (38.13-CONTEXT.md; ledger Batch 4 triage D-67, Batch 5, plan-phase D-78, Batch 10 K1, Batch 11 D2); phase code review B-CR-01 (owner "Approve all"); carried D-14, D-18
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-204 (partial — owner ruling L1, "keep the tall sheet; a short sheet sized to its rows rejected", is lifted for the bulk Set Category modal only, which ADR-204 left to be decided per modal; every other option sheet stays the tall expanded `OptionSheet`, and there is still one themed option sheet)
**Superseded by:** None

## Context

Bulk Change Contact Frequency was a raw days field. The bulk Set Category sheet opened at 92% height even for five categories, while the other bulk sheets were compact; on the device pass the More… and bulk Snooze sheets were too short to show their last rows (Move to Bin, Close). The first build of the bulk frequency sheet disabled Continue on an invalid custom entry, which the phase code review caught as a reversal of ADR-199's "Save stays pressable", named for this exact sheet.

## Decision

Bulk Change Contact Frequency uses the shared `FrequencyPicker` in a compact `BulkFrequencySheet`, starting on Monthly and resetting on each open; the careful-action confirm still sits between Continue and the write (D-39, D-18). Continue stays pressable: an invalid press reveals the picker's error through `FieldError` and announces it (ADR-199, review B-CR-01). The bulk Set Category, More… and bulk Snooze sheets open **sized to their rows** through one rule, `sizedSheetVariantFor`: the smallest of compact and detail whose height cap holds every row and the sheet's chrome at the current text scale, decided when the sheet opens; a sheet that fits neither opens expanded and scrolls (D-71, D-78, D-85, D-87). Heights are computed from row geometry (`optionSheetContentHeight`, `bulkMoreSheetContentHeight`), not fixed row counts. A sized sheet keeps the rows and size it opened with while it fades closed. Only the Contacts bulk Snooze passes `sizeToContent`; every other `SnoozeSheet` host and every other `OptionSheet` caller is unchanged.

## Alternatives Considered

- **Back to the tall sheet for bulk Set Category (K2)** — rejected (Batch 10); L1 still holds elsewhere.
- **Open compact, then grow** — not chosen (D-78, "sized when it opens").
- **Keep every bulk sheet at one compact size (D-71 as first written), or always taller** — rejected (D-87, Batch 11 D2).
- **A disabled Continue on the bulk frequency sheet** — rejected at review (B-CR-01); it reversed ADR-199.

## Consequences

### Positive

- Short lists open short and long ones open where every row is reachable without scrolling, on both test phones at 1.0 and 1.15 text.

### Negative

- `OptionSheet` and `SnoozeSheet` each render two literal `<Sheet>` blocks (expanded with its own ScrollView; compact/detail) so the sheet-consumer scroll contract can read them.
- On a small phone with Unsnooze showing, bulk Snooze just exceeds detail and opens the fixed 92% sheet with empty space (accepted).

### Risks

- RN sizes rows border-box; a predictor that adds borders on top of `minHeight` overstates heights (fixed during the device pass).

## Implementation

**Key files:**
- `src/components/BulkFrequencySheet.tsx` — compact sheet around `FrequencyPicker`; pressable Continue with a forced, announced `FieldError`.
- `src/components/FrequencyPicker.tsx` — opt-in `errorAsFieldError`.
- `src/components/ui/option-sheet-logic.ts` — `sizedSheetVariantFor`, `optionSheetVariantFor`, `optionSheetContentHeight`.
- `src/components/ui/OptionSheet.tsx` — the opt-in sized path.
- `src/components/category/CategoryChoiceSheet.tsx` — `sizeToContent`.
- `src/components/bulk-sheet-fit.ts` — More… and Snooze height predictors.
- `src/components/use-sheet-fit-environment.ts` — window height, width and font scale for the predictors.
- `src/components/SnoozeSheet.tsx` — `sizeToContent` for the bulk host only.
- `src/components/BulkActionSurface.tsx` — the More… sheet sized and retained while closing.
- `src/screens/HomeScreen.tsx` — the bulk sheet hosts.

**Depends on:** ADR-199 (App-Wide Destructive-Action, Feedback and Validation Standards, and One Empty State); ADR-204 (One Themed Option Sheet Replaces Every Native Picker; Native Date and Time Pickers Stay); ADR-227 (One Snooze Sheet for the Profile Tile, Profile ⋯, Contacts Card and Bulk Bar)
**Required by:** None
