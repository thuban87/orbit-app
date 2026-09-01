# ADR-001: Normalized Custom-Field Values

**Status:** Accepted
**Date:** 2026-08-24
**Phase:** 16-custom-field-value-normalization
**Source decisions:** D-01–D-12, D-06a, and D-06b from 16-CONTEXT.md; 16-DISCUSSION-LOG.md
**Reversibility:** one-way
**Migration:** 006
**Supersedes:** ADR-013; ADR-014 (partial); ADR-015 (partial)
**Superseded by:** None

## Context

Dynamic `TEXT` columns in the per-contact custom-value table coupled each field's visible compatibility key to SQLite schema. The model lacked a portable identity for each current value and required replicated DDL for ordinary field lifecycle work.

## Decision

The system uses `custom_field_values` as the normalized current-state store: every contact-and-definition pair has a durable uid-bearing row, including blank and quarantined pairs. Migration 006 atomically validates and copies legacy values, retires the dynamic table, and thereafter uses pair-keyed UPSERTs without runtime custom-field DDL; `col_name` remains compatibility and history metadata, never SQL syntax.

Loss-bearing legacy inconsistencies roll back unchanged. A non-loss-bearing orphan dynamic column is snapshotted to `field_history` in the same transaction and the upgrade proceeds; both migration-specific and generic bootstrap failures keep navigation unmounted and state only accurate recovery guidance.

## Alternatives Considered

- **Lazy or sparse value rows** — rejected because clearing must preserve durable blank current state.
- **Dual read/write migration** — rejected because two stores could diverge on an unreachable device.
- **Best-effort migration** — rejected because skipped values or invented definitions would lose or falsify data.
- **Replacing `col_name` with definition uid** — rejected because history and photo-path compatibility retain the stable key.
- **Rewriting raw values or duplicating parsers in SQL** — rejected because type-change behavior must preserve raw TEXT.

## Consequences

### Positive

- The pair constraint enforces at-most-one current row while migration and creation seeding maintain complete coverage.
- Existing parser, visibility, photo-path, type-change, quarantine, and AI-sharing behavior retains its compatibility projection.

### Negative

- The forward-only representation cannot be rolled back on upgraded user databases.
- `field_history` remains a bounded local audit trail, not backup or recovery; a permanently deleted photo definition can leave a bounded local photo orphan.

### Risks

- A loss-bearing malformed legacy database stays on its prior version until a compatible repair path exists.
- Future backup, restore, and multi-device conflict policy must consume the documented timestamp provenance without being decided here.

## Implementation

**Key files:**
- `src/db/migrations/006-normalize-custom-field-values.ts` — atomically converts and validates legacy dynamic values.
- `src/db/database.ts` — registers migration 006 and serializes bootstrap opening.
- `src/db/field-values-dao.ts` — provides normalized, defs-filtered reads and pair-keyed UPSERTs.
- `src/db/field-ddl.ts` — seeds and removes normalized value pairs during field lifecycle operations.
- `src/db/field-defs-dao.ts` — manages definitions and normalized emptiness checks.
- `src/db/field-type-change.ts` — snapshots raw values while changing definition metadata.
- `src/db/field-sort.ts` — supplies the static normalized-value expression for a future constrained join.
- `src/db/contacts-dao.ts` — seeds the complete pair matrix within contact creation.
- `src/db/purge-dao.ts` — deletes normalized value children in the archived-contact purge transaction.
- `App.tsx` — gates navigation and renders accurate migration/bootstrap failure states.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations)
**Required by:** ADR-056 (Tombstone-Backed UID Reconciliation for Portable Restores)
