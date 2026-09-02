# Phase KB Manifest: 20

**Phase:** 20-contact-reconciliation-merge
**Processed:** 2026-09-01
**Decision-source tier:** dossier — `docs/dossier/20-contact-reconciliation-merge.md`, overlaid by phase CONTEXT and implementation/UAT artifacts
**Source docs consumed:** 26 files — `docs/dossier/20-contact-reconciliation-merge.md`; `20-CONTEXT.md`, `20-RESEARCH.md`, `20-PATTERNS.md`, `20-01-PLAN.md` through `20-06-PLAN.md`, `20-01-SUMMARY.md` through `20-06-SUMMARY.md`, `20-REVIEWS.md`, `20-VALIDATION.md`, `20-UI-SPEC.md`, `20-UAT.md`, `20-UAT-FINDINGS-reconcile-bugs.md`, `20-UAT-BLOCKER-read-contacts.md`, `20-BUGB-DIAGNOSIS.md`, `20-UAT-HANDOFF.md`, `20-UAT-RUNBOOK-RESEARCH.md`, and `COVERAGE.md`

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|------------------|
| ADR-003 (reclaimed) | `READ_CONTACTS` on API 37+ for Reconcile | UAT blocker; 20-06 owner resolution |
| ADR-068 | User-Triggered, Source-Only Reconciliation with Durable Review | dossier 20 clusters A–S |
| ADR-069 | Atomic Tombstone-Backed Orbit Contact Merge | dossier 20 clusters T–AC |

## ADRs Superseded

| Existing ADR | Superseded by | Scope |
|--------------|---------------|-------|
| ADR-002 | ADR-003 | Partial: reconciliation permission only; import remains unchanged. |

## Legacy Reclaim

ADR-003 was regenerated from the phase corpus; its pre-KB body is preserved at `docs/decisions/_archive/ADR-003-read-contacts-on-api37-for-reconcile.md`.

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/persistence-core.md` | Documented migration 013 reconciliation and bulk-review state. |
| `docs/systems/contacts.md` | Documented atomic duplicate merge and tombstone retirement. |
| `docs/systems/contact-methods.md` | Documented canonical reconciliation comparison and primary-method merge resolution. |
| `docs/systems/photos.md` | Documented reconciliation photo staging and post-commit promotion. |
| `docs/systems/contact-import.md` | Documented reconcile-only permission use and birthday Fix/Ignore review. |
| `docs/systems/app-shell.md` | Documented reconciliation/merge routes and resume precedence. |

## System Docs Created

| System Doc | Covers |
|------------|--------|
| `docs/systems/contact-reconciliation.md` | User-triggered source reconciliation and explicit Orbit-to-Orbit merge. |

## Runbooks Updated

_None._

## Runbooks Created

| Runbook | Process |
|---------|---------|
| `docs/runbooks/android-contact-reconciliation-uat.md` | Device-backed merge and reconciliation UAT with WAL-aware DB evidence. |

## Deferred / Not Captured

- Background monitoring, source write-back, generic synchronization, and visual similarity matching — explicitly deferred by the dossier.
- Hermes hashing and React-key fixes — implementation bugs, not enduring architectural decisions.
- Lookup-key rename hardening and display-only UAT findings — future follow-up candidates outside this phase.

## Phase Stats

- **Plans in phase:** 6
- **Decisions captured:** 3 as 3 ADRs (including the ADR-003 reclaim)
- **Systems touched:** contact reconciliation, persistence, contacts, contact methods, photos, contact import, app shell
- **New gotchas added:** 12
