# ADR-123: Profile History Section Replacing the Vertical Timeline, with Detailed-Log Backfill Routing

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 32-interaction-history-insights
**Source decisions:** HIST-01, HIST-15 from dossier §A, §B, §Z
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-024 (partial — the profile-timeline refinement surface)
**Superseded by:** None

## Context

The profile previously refined interactions from a weak newest-first vertical timeline (ADR-024). The dossier decides History & Insights is a dedicated temporal experience that **replaces** that timeline rather than polishing it — an Activity Heatmap, a window-aligned Intensity chart, and a Rolodex Browser — mounted in the profile's existing History slot. It also needs a low-friction way to backfill an empty historical date without misusing Quick Log (which means "now").

## Decision

`HistorySection` composes the Heatmap, window-scoped Intensity, and Rolodex Browser over one shared window derived from the globally-persisted lens, reads the canonical `readContactHistory` on focus, and mounts behind the existing `ProfileModuleHost.renderHistory()` seam — the channel·occurredAt vertical-timeline stub is removed, while profile layout persistence and the `interaction-history` summary case are untouched. It wires the cross-surface flows: heatmap cell → context card → shared `DateDetailSheet`; drawer → the same sheet; sheet row → `InteractionDetail` (Edit → the canonical Edit route; Delete → the hard-delete confirm); and knowledge-change rows → the profile's existing knowledge navigation via a threaded `onOpenKnowledgeChange`. A contact is "empty" **only** when it has zero interactions **and** no lifecycle records (`hasLifecycleRecords`), so a lifecycle-only contact still shows the zero-count surfaces. Empty-date logging routes a typed `LogContact { contactId, prefillDate }` contract — structurally never a Quick Log payload — registered in Dashboard, Orrery, and Settings stacks; the target is still a placeholder screen because Phase 34 owns the real detailed-log form (HIST-15 hand-off).

## Alternatives Considered

- **Keep/polish the vertical timeline** — Rejected; the dossier replaces it with the History surfaces (§A/§B), and a conventional always-visible timeline is not required.
- **Frame "empty" on interactions alone** — Rejected; a lifecycle-only contact is not empty and must still render the surfaces (the two-signal predicate).
- **Route empty-date backfill through Quick Log** — Rejected; Quick Log means "now", so backfill routes the typed detailed-log contract pre-dated to the selected day.
- **Build the detailed-log form here** — Rejected; Phase 34 owns it, so Phase 32 establishes only the typed route/context contract.

## Consequences

### Positive

- The profile gains one coherent, explorable History experience behind the existing renderer seam, with every entry point wired to the shared sheet and canonical routes.
- The typed `LogContact` contract lets Phase 34 supply the form without a route change.

### Negative

- Knowledge-only contacts (no interactions, no lifecycle) fall to the empty state; their knowledge changes are reachable via the profile's knowledge flow, not the History surfaces.
- The `LogContact` target is a placeholder until Phase 34, so empty-date logging is contract-only this phase.

### Risks

- `navigate("LogContact"/"EditInteraction")` throws if a Profile-hosting stack lacks the route; all three stacks register them.

## Implementation

**Key files:**
- `src/components/history/HistorySection.tsx` — the assembled History section owning lens/window/preset state, persistence, and sheet/card/detail mounting.
- `src/components/history/history-section-logic.ts` — pure `resolveActiveWindow`, `isEmptyHistory`, `buildLogRoute`, `countByCycle`.
- `src/components/profile/ProfileModuleHost.tsx` — `renderHistory()` mounts `HistorySection` (stub removed; layout persistence untouched).
- `src/screens/ContactProfileScreen.tsx` — threads `onOpenKnowledgeChange` from the existing knowledge navigation.
- `src/navigation/types.ts` — `LogContact` gains `prefillDate`; route params registered across the Profile-hosting stacks.
- `src/navigation/tabs/OrreryStack.tsx` — registers the `LogContact` placeholder screen.
- `src/navigation/tabs/SettingsStack.tsx` — registers `LogContact`, `ThingsToRemember`, and `MemoryHistory` so Settings-originated Profiles resolve them.

**Depends on:** ADR-108 (Durable Independent-Axis Profile Presentation and Inheritance); ADR-119 (Reusable Count-Only History Aggregation and Canonical History Read); ADR-120 (Shared-Window Heatmap and Intensity with Persisted Lenses); ADR-121 (Rolodex Month/Day/Year History Browser); ADR-122 (Canonical Interaction Detail, Edit Route, and Shared Date Detail Sheet)
**Required by:** ADR-132 (Focused Rapid Capture Workflows)
