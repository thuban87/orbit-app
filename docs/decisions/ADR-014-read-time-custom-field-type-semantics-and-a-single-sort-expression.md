# ADR-014: Read-Time Custom-Field Type Semantics and a Single Sort Expression

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 03-custom-fields
**Source decisions:** dossier `02-fields`; 03-CONTEXT.md `<decisions>` — TEXT storage, seven parsers, type-change semantics, and `sortExpr()`
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Custom-field types control widgets and interpretation, not SQLite storage: all value columns remain `TEXT`. Converting stored bytes during a type change would violate the phase's blast-radius-zero invariant and could destroy values that do not fit the target type.

## Decision

The system interprets custom-field values at read time with exactly seven permissive target-type parsers and a separate dropdown-option membership check. A type change updates only the definition and marks unconvertible or out-of-list values for a tap-to-fix state; custom-field sorting and filtering route through the sole guarded `sortExpr()` helper.

## Alternatives Considered

- **Forty-two pairwise type converters** — rejected because one parser per target type is simpler and preserves unconvertible values.
- **Rewriting or clearing incompatible values** — rejected because type changes must retain byte-identical value storage.
- **Direct custom-column interpolation in each query** — rejected because `sortExpr()` is the single auditable point for TEXT-specific ordering.

## Consequences

### Positive

- Type and option changes preserve stored data while exposing values that need attention.

### Negative

- Consumers must use the shared parser and sort-expression layers rather than treating raw TEXT as typed data.

### Risks

- CAST-based ordering can diverge from permissive parser display for noncanonical legacy text; resolve this before a production sort consumer is added.

## Implementation

**Key files:**
- `src/db/field-parsers.ts` — defines the seven read-time parsers and dropdown membership check.
- `src/db/field-sort.ts` — provides the guarded custom-field sort/filter expression.
- `src/db/field-type-change.ts` — preflights and applies no-rewrite type changes.
- `src/components/FieldValueInput.tsx` — dispatches field types to their input widgets.
- `src/components/CustomFieldValue.tsx` — renders valid values or the tap-to-fix state.

**Depends on:** ADR-013 (Runtime Two-Table Custom Fields with Whitelist-Constructed DDL)
**Required by:** _None._
