# ADR-119: Reusable Count-Only History Aggregation and Canonical Single-Contact History Read

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 32-interaction-history-insights
**Source decisions:** D-09, D-10, D-12 (32-CONTEXT.md) from dossier §D, §M, §AB
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The Heatmap, Intensity chart, Rolodex Browser, and shared Detail Sheet all need temporal views of a contact's history, and the dossier wants that logic reusable by future account/Category analytics rather than baked into each contact-hardcoded widget. Correctness lives here: the heatmap must count interactions only, a naïve whole-history intensity reads ~0 for any past window, nullable cadence must be guarded, and Group Event parents (Phase 33) must never become a second history row or inflate any count.

## Decision

We build a reusable, node-tested aggregation seam plus one canonical read. Pure services separate the concerns: `window.ts` generates ordered local-date grids per lens (7 Days / Month / Year, future cells flagged, prev/next today-clamped); `buckets.ts` maps a window + interaction rows to **count-only** per-cell counts and `heatmapLevel(count, lens)`; `cycles.ts` builds contact-frequency cycle blocks and, for a null interval or disabled tracking, returns the tagged `{ available:false }` guard reused verbatim from `impact.ts` (D-09); `intensity-window.ts` filters interactions to the selected window, passes `effectiveNow` = window end-of-day and `periodDays` = window day-span, and calls the pure `computeIntensity` core (never the whole-history wrapper with real `now`). `history-read.ts` is the canonical single-contact `ReadOnlyExecutor` read returning date-indexed interaction records, read-only lifecycle events, per-date markers, a distinct `hasLifecycleRecords` signal, and a knowledge-change family unioned over every registered current-state field. All counts resolve from `interactions` rows only (D-10). The group-link discriminator `isGroupLinked` is an **inert seam** — hard-false for every Phase-32 row, referencing no `group_event_id` column — until Phase 33's migration makes it live (D-12).

## Alternatives Considered

- **Maintain separate mutable visualization counts** — Rejected; the heatmap resolves from the same authoritative interaction data so deletes/re-dates naturally recompute.
- **A whole-history intensity wrapper reused for each window** — Rejected; it reads ~0 for any past window, so intensity is genuinely window-scoped in code.
- **A second nullable-cadence guard** — Rejected; both `cycles` and `intensity-window` reuse `impact.ts`'s `{ available:false }` shape verbatim.
- **Introduce the `group_event_id` column early to make the seam exercisable** — Rejected; that reverses D-07 (Phase 33 owns group persistence), so the seam stays structurally present but hard-false.
- **Union Group Event parents into counting queries** — Rejected; a parent is authoring context, never an interaction, so it must never be counted.

## Consequences

### Positive

- One aggregation seam and one canonical read serve every History surface; future analytics can supply broader query shapes without new counting logic.
- Correctness-critical count/cycle/window/intensity math is fully node-tested outside the un-loadable `.tsx` renderers.

### Negative

- The group-link seam is dead code in Phase 32 (documented and test-pinned as inert), not exercised until Phase 33.

### Risks

- A future consumer that counts lifecycle records or a group parent as interactions would break the count-only contract; `buckets` structurally receives interaction rows only.

## Implementation

**Key files:**
- `src/db/history-read.ts` — the canonical single-contact read (records, lifecycle events, markers, `hasLifecycleRecords`, knowledge-change family, inert `isGroupLinked`).
- `src/services/history/window.ts` — pure lens → local-date-window generation with today-clamped navigation.
- `src/services/history/buckets.ts` — count-only per-cell bucketing and `heatmapLevel`.
- `src/services/history/cycles.ts` — cadence cycle-block math with the nullable-cadence `{ available:false }` fallback.
- `src/services/history/intensity-window.ts` — window-scoped intensity over the pure `computeIntensity` core.
- `src/db/current-state-history-read.ts` — widened to a read-only `Pick<SqlExecutor,"getAllAsync">` surface so the read composes without a writable executor.

**Depends on:** ADR-027 (Derived Profile-Only Gravity and Intensity); ADR-062 (Bound/Unbound Lifecycle and One-Way Cadence Assignment); ADR-010 (Single-Writer Interaction Recency Spine)
**Required by:** None
