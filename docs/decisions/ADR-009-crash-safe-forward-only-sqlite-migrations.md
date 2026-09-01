# ADR-009: Crash-Safe Forward-Only SQLite Migrations

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 02-data-foundation-status-engine
**Source decisions:** dossier `01-data` cluster G; 02-CONTEXT DATA-01
**Reversibility:** one-way
**Migration:** 001
**Supersedes:** None
**Superseded by:** None

## Context

SQLite schema changes run on devices that cannot be remotely inspected or repaired. A partially applied version step with an unchanged `user_version` would rerun against a damaged schema and could permanently wedge the application.

## Decision

The system uses ordered, forward-only `PRAGMA user_version` migrations. Each version step runs in its own hand-rolled transaction that atomically commits its schema work and version bump; on failure it rolls back and preserves the original error. Connection PRAGMAs, including foreign keys, are set before any migration transaction opens.

## Alternatives Considered

- **Autocommit DDL followed by a separate version bump** — Rejected because a failure can leave partial schema work that retries cannot safely recover.
- **Expo transaction helpers** — Rejected because their rollback behavior can mask the original SQL error.
- **Down migrations or remote repair** — Rejected because Orbit is local-first and migration history is forward-only.

## Consequences

### Positive

- A failed step leaves the database at the last fully committed version and can be retried safely.
- Migration control flow is testable independently of the Expo SQLite runtime.

### Negative

- Every schema change needs an explicit numbered TypeScript migration and verification.

### Risks

- `foreign_keys` is per connection and ineffective when enabled inside a transaction; bootstrap ordering is load-bearing.

## Implementation

**Key files:**
- `src/db/migrations/runner.ts` — orders migrations and applies each version atomically.
- `src/db/database.ts` — opens the database and sets WAL, foreign keys, and busy timeout before migration.
- `src/db/types.ts` — defines the SQLite executor and migration contracts used by the runner.
- `src/db/migrations/001-initial.ts` — supplies the first migration step.

**Depends on:** None.
**Required by:** ADR-001 (Normalized Custom-Field Values); ADR-041 (Notification Settings, Privacy Channels, and Birthday Alerts); ADR-047 (App-Level Assignable Sun and Themed Self Identity); ADR-055 (Dedicated Weekly Digest Scheduling and Persisted Notification Policy); ADR-056 (Tombstone-Backed UID Reconciliation for Portable Restores); ADR-057 (Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots)
