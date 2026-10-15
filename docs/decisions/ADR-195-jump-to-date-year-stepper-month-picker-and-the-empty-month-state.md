# ADR-195: Jump to Date: a Year-Stepper Month Picker and the Empty-Month State

**Status:** Accepted
**Date:** 2026-10-09
**Phase:** 38.8-history-navigation-ux
**Source decisions:** D-17, D-48, D-49, D-50, D-51, D-52, D-64, D-65, D-68 (38.8-CONTEXT.md; ledger Q-07, Q-38..Q-41, Q-39b, research OQ-1/OQ-2, convergence C4-01)
**Reversibility:** reversible (inferred)
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Removing the Rolodex (ADR-193) removed exact-date retrieval. Users still need to reach "roughly when" in a long history without scrolling through years, and an empty month must not look like a broken jump.

## Decision

A 'Jump to date' button sits directly above the first stream record. It opens a compact bottom sheet `JumpToDateSheet`: a year stepper (◀ YYYY ▶) above a 3×4 month grid. Years run from the earliest record's year, across all families and clamped to the current year, to the current year. Future months are disabled. A month holding any record of any family gets a dot, exposed in its accessible label. Empty months stay tappable. The picker opens on the month in view, or on the current month. Because the Jump button is not sticky, it opens on the current month in practice, which the owner accepted (D-68). A month tap scrolls to that month's header, opening its year and loading chunks as needed, without a highlight. An empty month shows a state directly under the Jump button, not under the heatmap: it names the month, offers the nearest record dates before and after as tappable jumps with the highlight (ADR-194), and offers Log with no prefilled date. It closes when its Log is pressed, and choosing a month clears the heatmap's empty note (D-69). There is no 'Back to newest' control.

## Alternatives Considered

- **Exact date (calendar)** — Rejected; month + year supports "I know roughly when" without traversing empty dates (Q-07).
- **Year chips only** — Rejected (Q-07).
- **Dropdowns (the first preview)** — Rejected in favour of the year stepper + month grid (Q-38, ledger Revisions).
- **Dots for interaction months only** — Rejected; any record of any family marks a month (Q-39b).
- **The empty-month state in the note slot under the heatmap** — Rejected; the Profile scrolls as a whole, so that slot can be off-screen after the sheet closes (OQ-1).
- **Nearest dates as plain text** — Rejected; they are jumps (OQ-2).
- **A 'Back to newest' button** — Rejected; users scroll up or Jump again (Q-41).

## Consequences

### Positive

- Any month in the contact's history is two taps away, and empty months explain themselves with a route to the nearest records.

### Negative

- Jumping into March of the oldest year took about 1 s on the release build, with one long frame. Accepted; a bounded read or a virtualized list is the follow-up if it feels slow.

### Risks

- The opening month depends on measuring registered month headers. A bounded `PICKER_MEASURE_TIMEOUT_MS` (150 ms) falls back to the current month.

## Implementation

**Key files:**
- `src/components/history/JumpToDateSheet.tsx` — the compact sheet with the year stepper, month grid, dots and disabled future months.
- `src/components/history/history-stream-logic.ts` — `pickerModel`, `pickerInitialMonth`, `resolveMonthJump`, `nearestRecordDays` and the empty-month texts.
- `src/components/history/HistorySection.tsx` — the Jump button, month jump, empty-month state and picker timeout.
- `src/components/history/HistoryStream.tsx` — month groups registered as measurable jump targets.
- `src/components/history/HistoryTargetNote.tsx` — the empty-month variant with nearest-date links.

**Depends on:** ADR-193 (Activity-First History Stream in Profile, Replacing the Rolodex); ADR-194 (Heatmap Jump-and-Highlight with No Count Card, and Honest Empty Targets)
**Required by:** None
