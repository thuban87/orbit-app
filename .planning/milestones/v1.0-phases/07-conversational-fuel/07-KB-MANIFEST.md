# Phase KB Manifest: 07

**Phase:** 07-conversational-fuel
**Processed:** 2026-09-01
**Decision-source tier:** dossier — `docs/dossier/03-fuel.md`
**Source docs consumed:** 16 files — mapped dossier; Plans 01–04; Summaries 01–04; RESEARCH, PATTERNS, UI-SPEC, VALIDATION, REVIEWS, CODE-REVIEW, and VERIFICATION.

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|-----------------|
| ADR-028 | Per-Item Conversational Fuel with Fixed Kinds | `03-fuel` Clusters A/C |
| ADR-029 | In-Query Fuel Eligibility and a Shared Ranked Projection | `03-fuel` Clusters C/D |
| ADR-030 | Explicit Confirmation of AI-Proposed Fuel | `03-fuel` Cluster E; Plan 03 |
| ADR-031 | Bound Local Fuel Search without FTS5 | `03-fuel` Cluster F; Plan 04 |

## ADRs Superseded

_None._

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/app-shell.md` | Added the Phase-7 FuelSearch route and Settings entry. |

## System Docs Created

| System Doc | Covers |
|------------|--------|
| `docs/systems/conversational-fuel.md` | Fuel storage, eligibility/ranking, provenance confirmation, and local search. |

## Runbooks Updated

_None._

## Runbooks Created

_None._

## Deferred / Not Captured

- Share-intent capture, notification/widget surfaces, dashboard placement, and AI provider/prompt delivery — downstream phase work prescribed by the dossier, not implemented in Phase 7.

## Phase Stats

- **Plans in phase:** 4
- **Decisions captured:** 4 as 4 ADRs
- **Systems touched:** Conversational fuel; app shell
- **New gotchas added:** 5
