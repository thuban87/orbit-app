# Phase KB Manifest: 17

**Phase:** 17-backup-export-restore
**Processed:** 2026-09-01
**Decision-source tier:** dossier + context-dxx — `docs/dossier/15-backup.md`, overlaid by D-01–D-18 and the Phase 17 discussion log
**Source docs consumed:** 33 files — `15-backup.md`; `17-CONTEXT.md`, `17-DISCUSSION-LOG.md`, `17-RESEARCH.md`, `17-PATTERNS.md`, `17-UI-SPEC.md`, `17-VALIDATION.md`, `17-REVIEWS.md`, `17-AUDIT-A-FINDINGS.md`, `17-AUDIT-B-FINDINGS.md`; plans 01–12; summaries 01–10 and 12.

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|-----------------|
| ADR-056 | Tombstone-Backed UID Reconciliation for Portable Restores | D-01–D-05 |
| ADR-057 | Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots | D-06–D-10 |
| ADR-058 | Optional Encrypted Backups and Previewed Local Restoration | D-11–D-15 |

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/persistence-core.md` | Migrations 007/008, revisions, snapshots, and recovery. |
| `docs/systems/contacts.md` | Tombstones, stable identities, and UID restore. |
| `docs/systems/custom-fields.md` | Explicit clears and permanent-delete evidence. |
| `docs/systems/interaction-log.md` | Tombstones and derived-recency restore. |
| `docs/systems/conversational-fuel.md` | Fuel deletion evidence and restore. |
| `docs/systems/contact-methods.md` | Contact-link deletion evidence and restore. |
| `docs/systems/photos.md` | Embedded bytes and committed-only recovery. |
| `docs/systems/app-shell.md` | Backup routes and ready-gated recovery. |
| `docs/systems/dashboard.md` | Temporary entry and rare health nudge. |

## System Docs Created

| System Doc | Covers |
|------------|--------|
| `docs/systems/backup-restore.md` | Local full-state backup, encryption, SAF snapshots, and restore. |

## Runbooks Updated

| Runbook | What Changed |
|---------|--------------|
| `docs/runbooks/sqlite-migration-pipeline.md` | Migrations 007/008 and shared full-chain testing. |

## Runbooks Created

_None._

## ADRs Superseded

_None._

## Deferred / Not Captured

- Developer backup-operation runbook — no repeatable engineering process beyond the updated migration workflow was established.
- Sync, background scheduling, and final Data Management navigation — explicitly deferred by the phase.

## Phase Stats

- **Plans in phase:** 12
- **Decisions captured:** 15 as 3 ADRs
- **Systems touched:** Backup & Restore, persistence, contacts, custom fields, interaction log, fuel, contact methods, photos, app shell, dashboard
- **New gotchas added:** 21
