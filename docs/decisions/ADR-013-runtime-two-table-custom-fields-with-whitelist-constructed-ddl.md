# ADR-013: Runtime Two-Table Custom Fields with Whitelist-Constructed DDL

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 03-custom-fields
**Source decisions:** dossier `02-fields`; 03-CONTEXT.md `<decisions>` — two-table model, TEXT-forever storage, and `col_name` safety
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-001

## Context

Migration 001 already provides empty custom-field definition, value, and history tables, but each user-created field needs an independently addressable value without turning the app schema into a predeclared set of columns. User labels also cross an SQL-identifier boundary, while a fixed contact or value-table column must never be shadowed.

## Decision

The system uses a definition row in `custom_field_defs` and a same-named, dynamically added `TEXT` column in `contact_custom_values` for each custom field. Labels become stable, whitelist-constructed `col_name` values; every dynamic identifier is guarded and quoted, while runtime values remain bound parameters. Field creation, value writes, metadata changes, and destructive DDL serialize through the shared write transaction.

## Alternatives Considered

- **Single JSON value column** — rejected because the decided model requires independently queryable dynamic fields.
- **Escaping arbitrary user-provided identifiers** — rejected because a restricted, single-producer whitelist is auditable and prevents fixed-column collisions.
- **Typed SQLite value columns** — rejected because every value column must remain `TEXT` so type changes do not require a column rebuild.

## Consequences

### Positive

- Fields remain queryable while their runtime schema changes are atomic and injection-safe.

### Negative

- Dynamic DDL requires a strict serialization and identifier-validation boundary.

### Risks

- Adding an index or `UNIQUE` constraint to a value column would prevent its future `DROP COLUMN`.

## Implementation

**Key files:**
- `src/db/col-name.ts` — constructs and validates custom-field column identifiers.
- `src/db/reserved-columns.ts` — reserves fixed schema names from custom-field collisions.
- `src/db/field-ddl.ts` — atomically creates and drops custom-field value columns.
- `src/db/field-defs-dao.ts` — owns serialized definition metadata operations.
- `src/db/field-values-dao.ts` — performs guarded dynamic value reads and writes.
- `src/db/transaction.ts` — provides the shared non-reentrant write transaction.

**Depends on:** ADR-008 (Initial Contact Schema as a Cross-Phase Data Contract)
**Required by:** ADR-014 (Read-Time Custom-Field Type Semantics and a Single Sort Expression); ADR-015 (Lossless Field Changes with Quarantine and Launch-Time Retention Sweep); ADR-016 (Fixed-First Contact Forms and Atomic Contact Creation); ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out); ADR-028 (Per-Item Conversational Fuel with Fixed Kinds); ADR-050 (Closed AI Prompt Egress Allowlist and Opt-In Field Sharing)
