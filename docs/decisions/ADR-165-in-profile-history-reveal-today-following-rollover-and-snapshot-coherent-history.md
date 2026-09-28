# ADR-165: In-Profile History Reveal, Today-Following Rollover, and Snapshot-Coherent History

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.3-audit-remediation-runtime-state
**Source decisions:** dossier Workstreams B and D; 38.3-CONTEXT D-10, D-11, D-12, D-22, D-28; RG-021 (architecture/AUD-ARCH-008), RG-024, RG-025; review A-WR-08
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Profile's Last Interaction tile and the Orbit Status sheet's View history navigated to Things to Remember, not interaction history. History read its own data on focus only, so a delete or log could leave Profile metrics and History disagreeing, and its memoized `today` never advanced across a day change. The relationship sheet's Frequency/Snooze Retry never settled the retried selector.

## Decision

History actions never navigate: Last Interaction and View history close any open sheet, scroll to the in-Profile `HistorySection` (ADR-123), and expand it through the same persisted per-contact collapse override a header tap writes (D-28), without resetting History's period or selection. If the Profile layout omits History, the actions are not offered and the tile is informational only. History re-reads from the parent Profile revision, so Profile metrics and History refresh together. History tracks an explicit "following today" state distinct from `refDate`: on a local date change it advances only when it was showing the current window; a picked past date stays put, and today-bound limits always update. Date checks run on resume, tab return, and Profile focus, never a timer. Frequency/Snooze writes and Retry go through `createRelationshipSheetRunner`, which settles only the retried selector. A persisted lens or preset is adopted from re-reads only until the user picks locally.

## Alternatives Considered

- **Scroll and reset History to the current period** — rejected (D-10); the action must not discard the user's view.
- **Rename the actions and keep the Things to Remember destination** — rejected (D-10); the label promised history.
- **A standalone timeline screen** — rejected; it contradicts ADR-123.
- **Temporarily reveal an omitted History module** — rejected (D-11); no layout mutation.
- **Always stay on the old date after rollover** — rejected (D-12) for users viewing the current period.

## Consequences

### Positive

- Profile and History present one coherent snapshot, and History follows today without surprising users browsing the past.

### Negative

- History's re-read and day check depend on a successful Profile snapshot publication.

### Risks

- If the Profile read fails on focus, History neither re-reads nor re-checks the day (verification coincidental-reliance item; review IN-03).

## Implementation

**Key files:**
- `src/screens/ContactProfileScreen.tsx` — History actions reveal in place and bump the History revision from the snapshot.
- `src/screens/contact-profile-logic.ts` — stable Profile loader with latest-request publication.
- `src/profile/module-host-model.ts` — `createHistoryRevealScroll` reveal controller.
- `src/components/profile/ProfileModuleHost.tsx` — History reveal, persisted expand, and scroll settlement.
- `src/components/history/HistorySection.tsx` — revision-driven re-read and today-following state.
- `src/components/history/history-section-logic.ts` — read-state transitions and `historyDayAfterNext`.
- `src/components/history/InteractionDetail.tsx` — delete publishes the shell tick.
- `src/components/profile/RelationshipOverview.tsx` — informational Last Interaction tile when History is absent.
- `src/components/profile/ProfileRelationshipSheets.tsx` — optional History route and runner-driven Retry.
- `src/profile/relationship-sheet-runner.ts` — Frequency/Snooze write and selector settlement.
- `src/profile/relationship-sheet-model.ts` — `history` route only when History is available.

**Depends on:** ADR-109 (Fixed-Hero Semantic Profile Composition and Focused Accessible Editors); ADR-110 (Coherent Local Profile Snapshot and Source-Owned Knowledge Projection); ADR-120 (Shared-Window Heatmap and Intensity with Globally-Persisted Lenses); ADR-123 (Profile History Section Replacing the Vertical Timeline); ADR-162 (Sweep-Ordered Foreground Refresh and Latest-Request Publication Authority)
**Required by:** None
