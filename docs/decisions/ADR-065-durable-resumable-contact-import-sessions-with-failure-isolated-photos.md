# ADR-065: Durable Resumable Contact-Import Sessions with Failure-Isolated Photos

**Status:** Accepted
**Date:** 2026-08-26
**Phase:** 19-system-contact-import
**Source decisions:** dossier `19-system-contact-import` clusters F, P–S; 19-CONTEXT.md; 19-01, 19-09, 19-10, and 19-16 summaries
**Reversibility:** one-way
**Migration:** 012
**Supersedes:** None
**Superseded by:** None

## Context

An accepted system-picker selection must survive process death even though its provider grant does not. A large import can also contain malformed, unresolved, or photo-failing records, so a batch-wide rollback would discard safe relationship data and leave no truthful recovery path.

## Decision

The system uses migration-012 local-only import-session and import-row snapshots as the durable review and progress record. Each contact commits independently; completed contacts remain after interruption or discard, while unresolved rows offer Resume or Discard. Imported photos are staged privately, mastered only after the contact commit, and retain their input for retry on failure while successful staging references and raw files are retired.

## Alternatives Considered

- **Keep picker state only in navigation or memory** — Rejected because it is lost on process death and cannot outlive the temporary provider grant.
- **Make bulk import all-or-nothing** — Rejected because one record or photo failure must not discard independently safe contacts.
- **Make photo persistence part of contact creation** — Rejected because photo I/O failure must not invalidate an otherwise valid imported contact.

## Consequences

### Positive

- Recovery, completion counts, retry, and staging cleanup are derived from durable local state.
- Safe commits and photo-failure isolation preserve useful imports without a backend or cloud queue.

### Negative

- The schema and every row-state writer must preserve the session transition contract and staging lifecycle.

### Risks

- Incorrect status liveness or filesystem ordering could discard retry inputs or retain raw staged PII longer than intended.

## Implementation

**Key files:**
- `src/db/migrations/012-import-sessions.ts` — creates the durable session and row schema with state constraints.
- `src/db/import-session-dao.ts` — owns atomic session acceptance, row transitions, and staged-photo retirement.
- `src/db/import-session-read.ts` — reads resumable sessions and durable completion buckets.
- `src/services/import/contact-import-resume-sweep.ts` — reconciles resumable sessions and orphaned staging at launch.
- `src/services/import/import-photo.ts` — performs post-commit master persistence and failure-isolated staging cleanup.
- `src/backup/restore-apply.ts` — excludes local-only sessions from portable restore state and purges them for Replace-all.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations); ADR-021 (Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup)
**Required by:** ADR-066 (Deliberate Reviewed Import with Unbound Bulk Defaults).
