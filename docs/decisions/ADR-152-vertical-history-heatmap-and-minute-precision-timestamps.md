# ADR-152: Vertical History Heatmap and Minute-Precision Timestamps

**Status:** Accepted
**Date:** 2026-09-19
**Phase:** 38.1-profile-presentation-polish
**Source decisions:** dossier §J–K; D-08 from phase CONTEXT.md
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The Year heatmap required horizontal scrolling despite its mobile context, and several visible local timestamps exposed raw seconds-bearing values. Stored precision, relative-time language, history lenses, and heatmap interaction semantics remain correct and must not change.

## Decision

The Year heatmap uses vertically flowing, weekday-aligned week rows and its existing orientation-independent day-cell behavior. Explicit display timestamps use one local-wall-clock shared formatter that defaults to 12-hour minute precision and supplies a neutral malformed-value fallback; storage, structured raw values, and relative-time formatters remain unchanged.

## Alternatives Considered

- **Keep horizontal Year scrolling** — Rejected because Month and Year must follow the mobile vertical-scrolling convention.
- **Reformat timestamps at each call site** — Rejected because seconds would reappear through ad-hoc formatters.
- **Add a user time-format preference now** — Rejected because it would require a migration and backup-format work outside this no-schema phase.

## Consequences

### Positive

- History remains interactive while fitting the vertical mobile flow, and visible timestamps share a safe presentation rule.

### Negative

- New explicit timestamp displays must use the shared formatter rather than raw local storage text.

### Risks

- Native scrolling, touch behavior, and visual timestamp appearance require physical-device verification.

## Implementation

**Key files:**
- `src/components/history/ActivityHeatmap.tsx` — renders the Year lens as vertical week rows.
- `src/utils/dates.ts` — formats local timestamps through minute precision.
- `src/db/profile-history-read.ts` — formats the Profile Last Interaction display text only.
- `src/components/history/interaction-detail-logic.ts` — formats the Interaction Detail When row.
- `src/screens/MemoryHistoryScreen.tsx` — formats prior-entry captions.

**Depends on:** ADR-120 (Shared-Window Heatmap and Intensity with Persisted Lenses); ADR-121 (Rolodex Month/Day/Year History Browser)
**Required by:** None
