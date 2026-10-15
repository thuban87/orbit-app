# ADR-196: Cycles Whole-Page Paging, No-Cadence Month Fallback, and Year-Bearing Off-Year Dates

**Status:** Accepted
**Date:** 2026-10-09
**Phase:** 38.8-history-navigation-ux
**Source decisions:** D-24, D-25, D-26, D-27, D-66, D-67, D-70, D-71, D-74, D-75 (38.8-CONTEXT.md; ledger Q-11..Q-13, Batch 5 scope ruling, convergence C2-08/C3-07, post-review rulings, owner sign-off 2026-10-09)
**Reversibility:** reversible (inferred)
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The phase-11 dossier §F (:314-318) asked for Cycles navigation, but it never shipped, so the Cycles lens was anchored at today. A contact with no cadence showed an unavailable Cycles default. The four lens labels truncated ("Cycl…") on device. Once paging reached past years, month-day dates became ambiguous about the year. The owner limited heatmap work in this phase to these already-ruled items (Batch 5).

## Decision

All four lenses (Cycles, 7 Days, Month, Year) and the 5/10/15/20 presets stay, with their global `app_settings` persistence and backup values unchanged (confirms ADR-120). The lens row uses an opt-in `density="compact"` on `SegmentedControl` (`COMPACT_SEGMENT`) so the labels read in full at default text size; other callers keep the regular density. Cycles gets the day lenses' prev/next row, moving one whole page (the preset count) of current-cadence cycles. Next is disabled on the page that ends today, and Intensity follows the paged span through the shared window. Paging back stops following today; a lens or preset change returns to the current page. Historical cadence is never reconstructed. When the persisted lens is Cycles and the contact has no cadence, History shows Month with `NO_CADENCE_FALLBACK_NOTE` and writes nothing. On such a contact a Cycles tap never writes the global `history_lens`: it shows "Cycles need a set frequency for this contact." Leaving that explanation with Month also writes nothing (`lensTapIntent` returns `persist: null`). 7 Days and Year taps persist as usual. The preset row stays visible under the explanation. Dates carry the year when they are not wholly in the current year. That covers the Cycles page title, cycle-cell labels, the empty-span note, day-lens cell labels and the empty-day note. The 7 Days window title stays month-day only.

## Alternatives Considered

- **Keep four lenses but drop the presets, or trim the lens set** — Rejected; the analysis stays useful while the stream does browsing (Q-11).
- **Leave Cycles anchored** — Rejected; paging implements the recorded §F intent (Q-12).
- **One-cycle steps as well as whole pages** — Rejected; the owner kept whole-page only, narrowing phase-11 §F (partial supersession of the dossier, Batch 5).
- **Keep the unavailable Cycles view for no-cadence contacts** — Rejected (Q-13).
- **Fall back and save Month globally** — Rejected; one Unbound contact would change every contact's lens (Q-13).
- **A year on the 7 Days title** — Rejected; it crowds the title and isn't needed (D-75).

## Consequences

### Positive

- Cycles can be explored backwards with Intensity aligned, and no-cadence contacts never show a dead lens or change other contacts' lens.

### Negative

- Paged cycles are today's cadence projected backwards, not the cadence that applied at the time.

### Risks

- The no-cadence guards depend on every lens tap going through the one `lensTapIntent` function. A direct `history_lens` write would reintroduce the side effect.

## Implementation

**Key files:**
- `src/components/history/history-section-logic.ts` — `pagedCycles`, the Cycles prev/next refs, `resolveEffectiveLens`, `lensTapIntent` and `NO_CADENCE_FALLBACK_NOTE`.
- `src/components/history/ActivityHeatmap.tsx` — the Cycles prev/next row, fallback caption, compact lens row and year-bearing labels and titles.
- `src/components/history/HistorySection.tsx` — the per-mount `cyclesExplained`, the shown lens, paging and the intent-routed lens taps.
- `src/components/history/history-stream-logic.ts` — `dayDateLabel` and the year-bearing empty-day and empty-span note texts.
- `src/components/SegmentedControl.tsx` — the opt-in `compact` density (`COMPACT_SEGMENT`).

**Depends on:** ADR-120 (Shared-Window Heatmap and Intensity with Globally-Persisted Lenses); ADR-165 (In-Profile History Reveal, Today-Following Rollover, and Snapshot-Coherent History)
**Required by:** None
