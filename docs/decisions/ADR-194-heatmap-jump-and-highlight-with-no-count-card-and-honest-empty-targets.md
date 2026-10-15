# ADR-194: Heatmap Jump-and-Highlight with No Count Card, and Honest Empty Targets

**Status:** Accepted
**Date:** 2026-10-09
**Phase:** 38.8-history-navigation-ux
**Source decisions:** D-19, D-20, D-21, D-22, D-23, D-28, D-29, D-53, D-54, D-55, D-56, D-69, D-73 (38.8-CONTEXT.md; ledger Q-08..Q-10, Q-16, Q-18, Q-43..Q-46)
**Reversibility:** reversible (inferred)
**Migration:** None
**Supersedes:** ADR-122 (partial — `DateDetailSheet` as the History record-list surface; `InteractionDetail`, canonical Edit, hard-delete, the recency writer and the family taxonomy survive); ADR-123 (partial — the heatmap cell → context card → sheet and drawer → sheet flows; the record → `InteractionDetail` → Edit/Delete chain survives)
**Superseded by:** None

## Context

A heatmap tap opened a count card, then a Date Detail Sheet. The card read "1 interactions", outlived lens and paging changes, and described off-screen cells. An empty cycle span prefilled Log with its end date, which contradicts phase-11 §L :425 ("do not invent an arbitrary date"). With the stream (ADR-193) showing records in place, a second record-list surface was redundant. This partially supersedes phase-11 dossier §L :398-400 (card-first reveal for populated cells).

## Decision

A tap on a day cell with records scrolls the stream to that day, opening its year and loading chunks as needed, and highlights its records. A tap on a cycle cell scrolls to the newest record in the span and highlights every record in it. There is no count card and no filtering. Emptiness is resolved across all three record families, so a zero-count cell holding lifecycle or knowledge records still jumps. A truly empty day shows 'Nothing logged on <day>' with Log interaction prefilled to that day. A truly empty span offers Log with no `prefillDate` (the form opens at now). The note sits directly under the heatmap, with ✕. It clears on another heatmap tap, a lens change or paging, and closes when its Log is pressed. Only one empty note shows at a time: a Jump month choice clears it. When it would land off-screen (the tall Year grid), it scrolls just into view and keeps its slot. The highlight is an accent bar plus a faint tint from theme tokens, fading over `HIGHLIGHT_FADE_MS` (5000). Under reduced motion it holds and then disappears, and the jump scroll is not animated. Each jump is announced once to screen readers without pulling focus. Scrolling the stream never moves the heatmap or Intensity window. The stream header carries only Jump to date; logging comes from the Profile + button and these empty-state offers. `DateDetailSheet` and `HeatmapContextCard` are removed, and their rows move into `HistoryStreamRows`.

## Alternatives Considered

- **Card, then jump** — Rejected; one record-navigation model, with the record as the useful object (Q-08).
- **Filter the stream to the tapped day** — Rejected; it hides surrounding history (Q-08).
- **Prefill the last or first day of an empty span or month** — Rejected; it invents a date (Q-10, Q-18).
- **A Log form that requires a date pick** — Rejected; it grows scope into the Log form (Q-18).
- **A History-specific Log button beside Jump** — Rejected (Q-16).
- **A heatmap that follows the list's scroll** — Rejected; the two stay independent (Q-45).

## Consequences

### Positive

- Every heatmap tap lands on real records or an honest empty state. The card defects (plural, stale card, invented span date) are gone with the card.

### Negative

- The highlight is clearly visible for about 4 of its 5 s because the fade eases out (designed timing).

### Risks

- Jump scrolls depend on measuring stream targets against the History anchor inside Profile's ScrollView. Stale requests are dropped by a per-mount generation check.

## Implementation

**Key files:**
- `src/components/history/history-stream-logic.ts` — `resolveHeatmapTarget`, the reveal state, pending-scroll reducer, note texts and announcements.
- `src/components/history/HistorySection.tsx` — heatmap tap → reveal, scroll, highlight and announce, or the empty note; note clearing and lead-in.
- `src/components/history/HistoryHighlight.tsx` — the bar-and-tint highlight and its fade and reduced-motion hold.
- `src/components/history/HistoryTargetNote.tsx` — the empty-day/span note with Log interaction and Dismiss.
- `src/components/history/history-section-logic.ts` — `buildLogRoute` with an optional `prefillDate`.
- `src/components/profile/ProfileModuleHost.tsx` — the History anchor and `requestHistoryScroll` measuring.
- `src/profile/module-host-model.ts` — `scrollWithinHistory` and `completeHistoryScroll`.
- `src/components/history/DateDetailSheet.tsx` — retired (rows moved to the stream).
- `src/components/history/HeatmapContextCard.tsx` — retired (empty-day role taken by the note).

**Depends on:** ADR-193 (Activity-First History Stream in Profile, Replacing the Rolodex); ADR-120 (Shared-Window Heatmap and Intensity with Globally-Persisted Lenses); ADR-122 (Canonical Interaction Detail, Edit Route, and Shared Date Detail Sheet)
**Required by:** ADR-195 (Jump to Date: a Year-Stepper Month Picker and the Empty-Month State); ADR-205 (One Date-Only Display Formatter, and Native Pickers for Memory and Custom-Field Dates)
