# Phase KB Manifest: 37

**Phase:** 37-settings-personalization
**Processed:** 2026-09-21
**Decision-source tier:** dossier — `docs/dossier/milestone-2/phase-37-settings-personalization-dossier.md`, as named by `37-CONTEXT.md`; the phase→dossier map has no phase-37 row.
**Source docs consumed:** 27 files (phase dossier; CONTEXT, DISCUSSION-LOG, RESEARCH, PATTERNS, 8 plans, 8 summaries, REVIEW, REVIEWS, UAT, VALIDATION, VERIFICATION, deferred-items)

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|------------------|
| ADR-140 | Navigation-First Settings Directory and Canonical Sub-Routes | dossier §§A–C, M, Q, S; D-01, D-03, D-09 |
| ADR-141 | Explicit-Host Dual-Home Backup Navigation | dossier §I; D-08 |

## ADRs Superseded

_None._

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/app-shell.md` | Settings directory, runtime route contract, and dual-home Backup navigation. |
| `docs/systems/backup-restore.md` | Explicit-host canonical Backup tree. |
| `docs/systems/profile.md` | Global-only Settings presentation defaults. |
| `docs/systems/orrery.md` | Shared Settings/Orrery preference source. |
| `docs/systems/ai-suggestions.md` | Canonical AI Settings category. |
| `docs/systems/notifications.md` | Dedicated notification settings and permission category. |
| `docs/systems/interaction-assist.md` | Specialized opt-out writer retained after migration. |

## System Docs Created

_None._

## Runbooks Updated / Created

_None._

## Deferred / Not Captured

- Category CRUD and deletion fallout — deferred to phase 37.1; ADR-140 records only the Phase-37 inert reservation.
- D-02, D-04–07, and D-10 — enforce or expose existing contracts; captured as system-doc consequences rather than new ADRs.
- Phase→dossier map entry — process metadata gap; not changed by this extraction.

## Phase Stats

- **Plans in phase:** 8
- **Decisions captured:** 10 as 2 ADRs
- **Systems touched:** App shell, Backup & Restore, Profile, Orrery, AI suggestions, Notifications, Interaction Assist
- **New gotchas added:** 5
