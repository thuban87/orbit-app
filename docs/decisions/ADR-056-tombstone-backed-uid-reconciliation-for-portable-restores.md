# ADR-056: Tombstone-Backed UID Reconciliation for Portable Restores

**Status:** Accepted
**Date:** 2026-08-24
**Phase:** 17-backup-export-restore
**Source decisions:** dossier `15-backup` clusters C/D; D-01–D-05 from phase CONTEXT.md
**Reversibility:** one-way
**Migration:** 007
**Supersedes:** None
**Superseded by:** ADR-060 (partial)

## Context

Portable restore must distinguish a row that was never seen from one deliberately deleted on another device. Phase 16 also established that normalized custom-field `NULL` rows are meaningful clears, not absent values. Without durable deletion evidence and a shared UID policy, Merge can resurrect data, violate parent or pair constraints, or merge malformed input partially.

## Decision

The system uses indefinite, typed tombstones and a standalone UID reconciliation module. Reconciliation applies newer `modified_at` rows, lets deletion win timestamp ties, validates the complete backup before writes, blocks children whose parents do not survive, rejects identity collisions, preserves explicit `NULL` custom-field clears, and recomputes derived contact recency after apply.

## Alternatives Considered

- **No deletion evidence** — rejected because an older backup could silently resurrect a hard-deleted entity.
- **Best-effort restore** — rejected because skipping malformed, duplicate, or orphaned records would create an incomplete local state.
- **Pair-key or `col_name` alias merge** — rejected because distinct stable UIDs would be silently discarded.

## Consequences

### Positive

- Restore and a future sync apply path share deterministic, testable conflict policy.
- A newer explicit normalized clear remains a real portable edit.

### Negative

- Every mergeable hard-delete writer must capture the UID and write its tombstone in the same transaction.

### Risks

- Tombstones are retained indefinitely, so their table grows with permanent deletions.

## Implementation

**Key files:**
- `src/db/migrations/007-tombstones.ts` — adds durable tombstones, revision tracking, and stable singleton identities.
- `src/db/tombstones-dao.ts` — defines the closed entity vocabulary and transaction-composable tombstone writes.
- `src/db/data-revision-dao.ts` — records monotonic exportable-data revisions.
- `src/db/purge-dao.ts` — captures contact fan-out deletion evidence before purge.
- `src/db/field-ddl.ts` — tombstones permanently deleted definitions and normalized values.
- `src/backup/reconciliation.ts` — implements UID, tombstone, parent-survival, and incompatibility policy.

**Depends on:** ADR-001 (Normalized Custom-Field Values); ADR-009 (Crash-Safe Forward-Only SQLite Migrations).
**Required by:** ADR-057 (Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots); ADR-060 (Versioned Portable Method Graph and Collision-Normalized Restoration).
