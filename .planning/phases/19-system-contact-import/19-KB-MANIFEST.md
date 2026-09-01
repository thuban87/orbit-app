# Phase KB Manifest: 19

**Phase:** 19-system-contact-import
**Processed:** 2026-09-01
**Decision-source tier:** dossier — `docs/dossier/19-system-contact-import.md`, overlaid by phase prose context and implementation artifacts
**Source docs consumed:** 53 files (mapped dossier plus phase context, research, 20 plans, 20 summaries, verification, reviews, UAT, UI, validation, and diagnostic artifacts)

## ADRs Produced

| ADR | Title | Source Decisions |
|---|---|---|
| ADR-064 | Permissionless Android 17 System-Contact Snapshot Acquisition | Dossier clusters A–C |
| ADR-065 | Durable Resumable Contact-Import Sessions with Failure-Isolated Photos | Dossier clusters F, P–S |
| ADR-066 | Deliberate Reviewed Import with Unbound Bulk Defaults | Dossier clusters D–E, L, N–Q |
| ADR-067 | Conservative Advisory Identity Matching and Explicit Source Consolidation | Dossier clusters G–M |

## ADRs Superseded

_None._

## System Docs Updated

| System Doc | What Changed |
|---|---|
| `docs/systems/persistence-core.md` | Added migration-012 local-only import-session state. |
| `docs/systems/contacts.md` | Added canonical reviewed imported create/link composition. |
| `docs/systems/contact-methods.md` | Added canonical import evidence and provenance writes. |
| `docs/systems/photos.md` | Added failure-isolated selected-contact photo staging. |
| `docs/systems/app-shell.md` | Added import routes, Settings entry, and durable-resume navigation. |
| `docs/systems/dashboard.md` | Added manual/import speed-dial behavior and inert collapsed scrim. |
| `docs/systems/backup-restore.md` | Documented local-only import-session omission and Replace-all cleanup. |

## System Docs Created

| System Doc | Covers |
|---|---|
| `docs/systems/contact-import.md` | Android selected-contact acquisition, durable review, safe import, and recovery. |

## Runbooks Updated

_None._

## Runbooks Created

_None._

## Legacy-ADR Reclaim

_None._ ADR-002 remains reserved for phase 19.1.

## Deferred / Not Captured

- iOS and older-Android picker support — outside phase 19's Android-17-only boundary.
- Reconciliation, source refresh, remembered conflicts, and generic Orbit-contact merge — explicitly deferred to phase 20.
- Open picker/row edge cases recorded in the phase's UAT findings — not represented as fixed work by this extraction.

## Phase Stats

- **Plans in phase:** 20
- **Decisions captured:** 4 as 4 ADRs
- **Systems touched:** Contact Import, Persistence Core, Contacts, Contact Methods, Photos, App Shell, Dashboard, Backup & Restore
- **New gotchas added:** 12
