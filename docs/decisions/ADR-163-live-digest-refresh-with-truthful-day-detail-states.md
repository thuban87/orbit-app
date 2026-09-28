# ADR-163: Live Digest Refresh with Truthful Day-Detail States

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.3-audit-remediation-runtime-state
**Source decisions:** dossier Workstream D; 38.3-CONTEXT D-13, D-14, D-15, D-16; RG-026; review B-WR-06
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Digest re-read only on focus, so a Quick Log, Undo, headless log, or assist confirmation on the already-mounted Digest left Up Next, Horizon, and Your Week stale until a tab change. A new local day did not move Your Week's window, and a failed or pending day-detail read rendered as "No activity on this date", closing nothing of Phase 38 review WR-01.

## Decision

Digest re-reads and recomposes immediately on the shell-refresh tick (committed writes) and on every foreground tick, which is ordered after the launch/foreground sweep (ADR-162). Rows shift with the standard list transition, none under reduced motion. Refresh triggers live only in `DigestScreen`; sections add no focus effect or AppState listener. On a new local day the chosen period is kept and the window moves; a selected day survives only if it is still in the window. Day detail uses explicit `idle | loading | loaded | error` states behind request-scoped tokens: loading shows an inline indicator, error shows "Couldn't load this day" with Retry, and "No activity" appears only after a successful empty read. A Your Week refresh failure keeps the loaded week and shows a section-local, read-only Retry.

## Alternatives Considered

- **Refresh counts now, defer the list** — rejected (D-13); the logged person should drop out immediately.
- **Refresh only on a new day** — rejected (D-14); every resume reads the sweep's writes.
- **Keep the period but clear the selected day on rollover** — rejected (D-15) in favour of keeping an in-window day.
- **Keep old rows dimmed while a day reloads** — rejected (D-16) in favour of a loading indicator then error + Retry.
- **A persistent Digest cache or snapshot** — rejected by D-03.

## Consequences

### Positive

- Digest agrees with committed writes without leaving the tab, and an unread day is never presented as empty.

### Negative

- Every resume costs a Digest re-read, and a retained selected day re-reads (showing its spinner) on each refresh.

### Risks

- Month/year rollover and the in-range keep leg are unit-covered only; the owner accepted them as risk pending a natural boundary resume.

## Implementation

**Key files:**
- `src/screens/DigestScreen.tsx` — sole owner of shell/foreground refresh triggers and date checks.
- `src/screens/digest-refresh.ts` — refresh sequencing and new-day window resolution.
- `src/components/digest/DigestListTransition.tsx` — standard list transition with one reduced-motion read per group.
- `src/components/digest/YourWeekSection.tsx` — period re-window, retained-day rules, and the day-read authority.
- `src/components/digest/your-week-section-logic.ts` — `createYourWeekPeriodReader` and the day-detail state machine.
- `src/components/digest/DigestDayDetail.tsx` — loading, error-with-Retry, and successful-empty presentation.

**Depends on:** ADR-147 (Derived Digest Composition and Canonical Contacts Drill-Through); ADR-148 (Portable Your Week Period and Group-Deduplicated Activity Aggregation); ADR-162 (Sweep-Ordered Foreground Refresh and Latest-Request Publication Authority)
**Required by:** None
