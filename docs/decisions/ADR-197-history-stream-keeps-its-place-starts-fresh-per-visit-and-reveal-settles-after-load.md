# ADR-197: History Stream Keeps Its Place, Starts Fresh per Visit, and the Reveal Settles After Load

**Status:** Accepted
**Date:** 2026-10-09
**Phase:** 38.8-history-navigation-ux
**Source decisions:** D-31, D-61, D-62, D-72 (38.8-CONTEXT.md; ledger Q-53, Q-54, Batch 15 V6, owner sign-off "Yes to G1")
**Reversibility:** reversible (inferred)
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The stream has transient state: open years, loaded chunks and the user's place. That state must survive the edits it launches, without being remembered across visits. The device pass also found that with History collapsed, Last Interaction / View history could stop short. The reveal scroll (ADR-165) fired while History still showed "Loading history…", so it was clamped at the page end and never retried.

## Decision

After an edit, redate or delete from `InteractionDetail`, the stream refreshes through the Profile revision chain and keeps the user's place. A one-shot anchor carries the opened row's local date. It is consumed on a new history object, not on a model rebuild, and it anchors to the nearest remaining day if the target day disappears. A failed delete leaves the row visible with Retry, never removing it optimistically. There is no trash or undo. Each new Profile visit starts fresh: newest first, only the current year open, no extra chunks. `HistorySection` is keyed by contact, and no per-contact stream state is persisted. Returning from Detail, Edit, Log or MemoryHistory while the Profile is mounted keeps the place. Last Interaction / View history still land at the top of the section. An expanding reveal stays pending past its first, possibly clamped scroll. It settles with a second scroll once History's loaded content lays out (heatmap `onLaidOut`, the empty state or the read error), never on a timer and never on the loading placeholder. `ActivityHeatmap` reports the first layout whose grid is final, including the Year grid and the no-cadence Cycles explanation. A collapse drops the pending settle.

## Alternatives Considered

- **Remember per-contact list position between visits** — Rejected; each visit starts fresh (Q-54).
- **Optimistic delete, or a trash/undo tier** — Rejected; it carries forward ADR-122's hard-delete and failure rules (D-31).
- **Reset History to the current period on reveal** — Rejected; ADR-165's place-keeping reveal stands (D-61).
- **A timer-based re-scroll for the reveal** — Not taken; the settle waits on the loaded content's own layout signal (38.8-07).

## Consequences

### Positive

- Editing from the stream never loses the user's place, and the collapsed-History reveal lands under the app bar.

### Negative

- A record added above the current place (a + Log or a new knowledge value) moves the view down by its height. The day is kept, and that is the designed scroll-position behaviour.
- On the DEBUG build the Year-lens settle arrives about 1.5–2.5 s after paint; on the release check (`95ba2718`) the settle began about 0.05 s after paint.

### Risks

- A layout-settle callback that fires only after a measured-width re-render misses lenses whose first layout is already final. That was the second G1 root cause.

## Implementation

**Key files:**
- `src/profile/module-host-model.ts` — `createHistoryRevealScroll` with the pending settle after History's loaded layout.
- `src/components/profile/ProfileModuleHost.tsx` — the History anchor, reveal wiring and the per-contact `HistorySection` key.
- `src/components/history/HistorySection.tsx` — the one-shot place anchor, the loaded-content layout signal and the fresh-per-visit state.
- `src/components/history/ActivityHeatmap.tsx` — `onLaidOut` on the first final layout of every lens.
- `src/components/history/history-stream-logic.ts` — `nearestRemainingDay` and `recordDay`.

**Depends on:** ADR-165 (In-Profile History Reveal, Today-Following Rollover, and Snapshot-Coherent History); ADR-193 (Activity-First History Stream in Profile, Replacing the Rolodex); ADR-122 (Canonical Interaction Detail, Edit Route, and Shared Date Detail Sheet)
**Required by:** None
