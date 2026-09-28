# ADR-162: Sweep-Ordered Foreground Refresh and Latest-Request Publication Authority

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.3-audit-remediation-runtime-state
**Source decisions:** dossier Workstream C; 38.3-CONTEXT D-03, D-14, D-22, D-23, D-30; RG-020, RG-022; review A-WR-01, A-WR-02
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Screens refreshed on private AppState listeners, focus, and a shell-refresh counter with no ordering against the launch/foreground sweep, so a resume read could miss the sweep's purges and expiry. Contacts Home also ran redundant background read bundles, let older async results overwrite newer rows, counts, and errors, and could stay inert after a panel dismissal because its mirrored open state never cleared.

## Decision

The system publishes a **foreground tick**, a second counter in the existing shell-refresh Zustand store, exactly once per owning launch-sweep run after all hooks settle (`onSweepSettled`); resume freshness subscribes to it via `useForegroundRefresh` instead of a private AppState listener or a timer. Each sweep hook is awaited for at most `SWEEP_HOOK_TIMEOUT_MS`; an over-budget hook is logged, treated as settled and unavailable for dependents, never cancelled or re-run (D-30). Every async read that publishes UI state goes through a `createLatestRequestAuthority()` token, so data, counts, errors, and loading settles publish only for the latest request. Home owns refresh in one seam (`dashboard-refresh-scheduler.ts`): requests while hidden or backgrounded defer to focus, animation/lifecycle state never triggers reads, and bulk paths issue one refresh. Dashboard panel open state has a single owner (`dashboard-panel-store.ts`) from which Home derives inertness.

## Alternatives Considered

- **A universal event bus or new state library** — rejected by D-03; a second counter in the existing store suffices.
- **Midnight or polling timers for date freshness** — rejected by D-22; nothing watches a timestamp, so day changes are detected on resume, focus, and refresh events.
- **Refresh hidden Home in the background** — rejected by D-23; it wasted reads and raced visible state.
- **Publish the tick before the backup hook finishes** — offered in review A-WR-02; the owner chose a bounded per-hook budget (D-30) so D-14 ordering stays intact.

## Consequences

### Positive

- Resume reads observe the sweep's writes, and stale results can no longer overwrite newer state.
- One owner per refresh signal and per panel state removes the desync classes RN-001 and RG-022 found.

### Negative

- A hung sweep hook still delays the foreground tick by up to the budget.
- Every new read surface must adopt the authority token or it can reintroduce stale publication.

### Risks

- The budget is sized for a normal automatic backup; a slower legitimate hook is reported unavailable to its dependents for that pass.

## Implementation

**Key files:**
- `src/services/launch-sweep.ts` — `onSweepSettled` owning-run publication and the per-hook `SWEEP_HOOK_TIMEOUT_MS` budget.
- `src/stores/shell-refresh-store.ts` — shell tick plus the foreground tick and `useForegroundRefresh`.
- `App.tsx` — wires `onSweepSettled(publishForegroundRefresh)` before the sweep trigger.
- `src/utils/latest-request.ts` — the shared latest-request authority.
- `src/screens/dashboard-refresh-scheduler.ts` — Home's single publication seam and hidden-request deferral.
- `src/screens/HomeScreen.tsx` — consumes the scheduler and derives panel inertness from the store.
- `src/components/control-surface/dashboard-panel-store.ts` — single-owner panel state with capture-before-clear dismissal.
- `src/components/control-surface/DashboardOverlayHost.tsx` — delegates dismissal to `dismissDashboardPanel`.
- `src/services/notifications/notification-actions.ts` — warm Mark/Snooze publish the shell tick.

**Depends on:** ADR-070 (Durable Pending Interaction-Assist Lifecycle and Portable Opt-Out); ADR-095 (Live-Applying Dashboard Floating Control Surface); ADR-146 (Digest-Centered Five-Tab Shell and Semantic Root Routing); ADR-156 (Foreground Maintenance Fault Isolation with Per-Pass Dependencies)
**Required by:** ADR-163 (Live Digest Refresh with Truthful Day-Detail States); ADR-164 (Shared Post-Commit Assist Publisher with Surfaced Assist Failures); ADR-165 (In-Profile History Reveal, Today-Following Rollover, and Snapshot-Coherent History)
