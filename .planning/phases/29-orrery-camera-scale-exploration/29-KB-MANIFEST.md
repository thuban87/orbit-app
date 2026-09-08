# Phase KB Manifest: 29

**Phase:** 29-orrery-camera-scale-exploration
**Processed:** 2026-09-08
**Decision-source tier:** dossier — `docs/dossier/milestone-2/phase-08-orrery-camera-scale-exploration-dossier.md`
**Source docs consumed:** 39 files — mapped dossier; `29-CONTEXT.md`; `29-RESEARCH.md`; `29-PATTERNS.md`; `29-UI-SPEC.md`; `29-NATIVE-CHECKLIST.md`; review, verification, UAT, validation, coverage, and deferred-item artifacts; Plans and Summaries 01–12.

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|-----------------|
| ADR-104 | Durable Orrery Preferences and Live System Scope | §§H, S, V; D-05/D-06 |
| ADR-105 | Scoped Relationship Satellites for System-Member Context | §§W–Y; D-09/D-11 |
| ADR-106 | Derived Orrery Gravity Visual Mass and Accessible Context | §§E, Z; plans 29-04/12 |

## ADRs Superseded

| Existing ADR | Superseded by | Scope |
|--------------|---------------|-------|
| ADR-027 | ADR-106 | Partial: Orrery visual mass and accessible companion context only. |

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/orrery.md` | Added ADR cross-links and completed the ADR-027 display-scope handoff. |
| `docs/systems/persistence-core.md` | Documented migration 021 and its constrained Orrery preferences. |

## System Docs Created

_None._

## Runbooks Updated

| Runbook | What Changed |
|---------|--------------|
| `docs/runbooks/orrery-visual-layer.md` | Replaced retired dual-view instructions with canonical world/camera/System guidance. |

## Runbooks Created

_None._

## Deferred / Not Captured

- Native E1–E9 acceptance evidence — still requires physical-device observation.
- Custom Systems, portable preference emission, Category administration, and release calibration — owned by phases 30, 36, 37, and 40.

## Phase Stats

- **Plans in phase:** 12
- **Decisions captured:** 3 as 3 ADRs
- **Systems touched:** Orrery; Persistence core
- **New gotchas added:** 6
