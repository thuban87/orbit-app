# ADR-015: Lossless Field Changes with Quarantine and Launch-Time Retention Sweep

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 03-custom-fields
**Source decisions:** dossier `02-fields`; 03-CONTEXT.md `<decisions>` — field history, dynamic delete/quarantine, and fixed 30-day sweep
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-001 (partial)

## Context

Dropping a populated dynamic value column or changing a field type can otherwise make user data unrecoverable on a local-only device. Timestamp-based expiry has no watcher, and the shared write mutex is non-reentrant, so a sweep must not compose its work by nesting a second transaction.

## Decision

The system snapshots destructive custom-field changes to `field_history` in the same transaction. Empty fields delete immediately; populated fields quarantine with data intact, then a launch-time sweep permanently drops definitions and columns older than the fixed 30-day window while pruning retained history. The sweep rechecks staleness under its own serialized transaction before each drop.

## Alternatives Considered

- **Immediate deletion of every field** — rejected because populated-field data needs a reversible recovery window.
- **Timers or database triggers for expiry** — rejected because timestamp expiry runs through the existing launch-sweep hook registry.
- **A configurable retention window** — rejected for v1 in favor of one fixed, top-of-file 30-day constant.

## Consequences

### Positive

- Destructive operations remain recoverable during quarantine and retain an in-transaction history record.

### Negative

- Permanent cleanup occurs only on app launch and each field drop needs a separate serialized transaction.

### Risks

- Nesting the non-reentrant write transaction would deadlock the launch-sweep registry; the sweep calls the stale-expiry entry directly.

## Implementation

**Key files:**
- `src/db/field-ddl.ts` — snapshots values, performs dynamic drop operations, and rechecks stale quarantine.
- `src/db/field-type-change.ts` — snapshots pre-change values with definition type updates.
- `src/services/field-sweep.ts` — registers expiry and history-retention cleanup at launch.
- `src/db/transaction.ts` — serializes each destructive operation without nested mutex acquisition.
- `src/db/database.ts` — exposes the migrated executor used by the registered sweep.
- `App.tsx` — registers the field sweep before the cold-start trigger runs.

**Depends on:** ADR-013 (Runtime Two-Table Custom Fields with Whitelist-Constructed DDL)
**Required by:** ADR-021 (Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup); ADR-089 (Recoverable Memory Lifecycle and Contact-Operation Integrity)
