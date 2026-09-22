# Phase KB Manifest: 38-your-week

**Phase:** Digest & Navigation Restructure
**Processed:** 2026-09-21
**Decision-source tier:** dossier — `docs/dossier/milestone-2/phase-38-digest-navigation-restructure-dossier.md`, resolved by `38-CONTEXT.md` D-01
**Source docs consumed:** 29 phase documents (542,773 bytes) plus the authoritative dossier

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|------------------|
| ADR-146 | Digest-Centered Five-Tab Shell and Semantic Root Routing | D-01, D-03 |
| ADR-147 | Derived Digest Composition and Canonical Contacts Drill-Through | D-02, D-04, D-10 |
| ADR-148 | Portable Your Week Period and Group-Deduplicated Activity Aggregation | D-05, D-08, D-09 |

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/app-shell.md` | Recorded five equal roots, default Digest, semantic resets, and Settings-only Backup. |
| `docs/systems/digest.md` | Recorded fixed modules, derived reads, canonical drills, period setting, and aggregation boundary. |
| `docs/systems/dashboard.md` | Renamed the user-facing system Contacts and documented exact Never Contacted drill semantics. |
| `docs/systems/persistence-core.md` | Added migration 030 and the app-setting-versus-Digest-state boundary. |
| `docs/systems/backup-restore.md` | Added format v7 period export/restore and v6 forward default. |
| `docs/systems/interaction-history.md` | Documented shared heatmap language and `week-window` reuse. |
| `docs/systems/notifications.md` | Recorded semantic Digest routing and isolated DEV UAT identifiers. |
| `docs/systems/group-events.md` | Recorded parent-once Your Week activity aggregation. |
| `docs/systems/README.md` | Updated Contacts and Digest routing entries. |

## System Docs Created

None.

## Runbooks Updated

None — Phase 38 changes product behavior and bounded DEV UAT helpers, not a reusable operating procedure.

## Runbooks Created

None.

## Deferred / Not Captured

- Day-detail load state, compact-width heatmap layout, and repeated DEV probe cleanup — advisory post-phase review warnings; retained for backlog triage, not ADR-grade decisions.
- Repository-wide Vitest failure in `src/components/orrery/orrery-controls-render.test.tsx` — pre-existing and outside phase 38’s subsystem.
- Missing Phase 38 row in `docs/dossier/README.md` — the phase Context explicitly names its dossier, so provenance was resolved without expanding this extraction’s source-map maintenance scope.

## Phase Stats

- **Plans in phase:** 8
- **Decisions captured:** 10 as 3 ADRs
- **Systems touched:** app shell, Digest, Contacts query, persistence, backup/restore, interaction history, notifications, Group Events
- **New gotchas added:** 3
