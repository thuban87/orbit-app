# Phase KB Manifest: 26

**Phase:** 26-dashboard-control-surface
**Processed:** 2026-09-06
**Decision-source tier:** dossier — `docs/dossier/milestone-2/phase-05-dashboard-control-surface-dossier-amended-group-events.md`, overlaid by phase CONTEXT and owner-approved UAT resolutions
**Source docs consumed:** 24 files (705,451 bytes): mapped dossier; 23 phase artifacts (CONTEXT, RESEARCH, PATTERNS, UI-SPEC, VALIDATION, REVIEW, REVIEWS, UAT, VERIFICATION, and plans/summaries 01–07)

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|-----------------|
| ADR-095 | Live-Applying Dashboard Floating Control Surface | dossier §§C–G, P–Q; CONTEXT D-11; UAT resolution |
| ADR-096 | Dashboard Header and Overflow Discovery Paths | dossier §§B, M–O; Group Events amendment; CONTEXT D-04–D-10 |
| ADR-097 | Scoped Dashboard Search and Dedicated Unbound Retrieval | dossier §§K, N; CONTEXT D-08, D-12 |

## ADRs Superseded

_None._ Existing supersessions were already recorded before this phase.

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/dashboard.md` | Added floating controls, current search/retrieval paths, entry behavior, decisions, and gotchas. |
| `docs/systems/app-shell.md` | Added compact header fallback, fixed overflow, transient controls, and child-route chrome. |

## System Docs Created

_None._

## Runbooks Updated

_None._

## Runbooks Created

_None._

## Deferred / Not Captured

- Legacy settings-key removal — remains coordinated with Phase 36's backup-format change.
- Group Event domain behavior and Card bulk selection — owned by their later phases; this phase records entry affordances only.

## Phase Stats

- **Plans in phase:** 7
- **Decisions captured:** 3 as 3 ADRs
- **Systems touched:** Dashboard; App Shell
- **New gotchas added:** 6
