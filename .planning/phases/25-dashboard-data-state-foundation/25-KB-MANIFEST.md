# Phase KB Manifest: 25

**Phase:** 25-dashboard-data-state-foundation
**Processed:** 2026-09-06
**Decision-source tier:** dossier — `docs/dossier/milestone-2/phase-04-dashboard-data-state-foundation-dossier.md` (with binding phase-04 planning notes appendix)
**Source docs consumed:** 23 files (phase corpus, mapped dossier, and planning-notes appendix)

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|-----------------|
| ADR-092 | Durable Shared Dashboard Query State | dossier §§B, F, M–N; D-03, D-10 |
| ADR-093 | Scoped Composable Dashboard Population and Filter Model | dossier §§C–I; D-04–D-07, D-12–D-14 |
| ADR-094 | Eligibility-Scoped Semantic Dashboard Search | dossier §§I–L; D-08–D-09 |

## ADRs Superseded

_None._ ADR-075 and ADR-076 had already recorded the relevant supersessions.

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/dashboard.md` | Shared state, result universe, semantic search, and retirements. |
| `docs/systems/persistence-core.md` | Migration 019 and Dashboard preferences. |
| `docs/systems/backup-restore.md` | Future-portable Dashboard key allowlist. |
| `docs/systems/contact-knowledge.md` | Scoped search provenance and corpus contract. |
| `docs/systems/contacts.md` | Binary favourite membership and retired rank rewrite. |
| `docs/systems/widget.md` | Favorites Default order and Home-only reset. |
| `docs/systems/app-shell.md` | Retired Dashboard routes and Settings controls. |
| `docs/systems/digest.md` | Retained backlog count with live Home target. |

## Runbooks Updated / Created

_None._

## Deferred / Not Captured

- Runtime Dashboard session restoration — render phases 26–28 own the UI wiring.
- Typed Unbound lookup and visible Not Contacted control — owner-approved transition, Phase 26.
- Rich birthday presentation — deferred Your Week work; Phase 25 retains only the Birthday population.
- Physical-Pixel search and Gravity performance — validation work, not a new architecture decision.

## Phase Stats

- **Plans in phase:** 7
- **Decisions captured:** 3 as 3 ADRs
- **Systems touched:** Dashboard, Persistence core, Backup & Restore, Contact knowledge, Contacts, Widget, App shell, Digest
- **New gotchas added:** 14
