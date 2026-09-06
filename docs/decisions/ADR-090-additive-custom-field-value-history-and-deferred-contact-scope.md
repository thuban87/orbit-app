# ADR-090: Additive Custom-Field Value History and Deferred Contact Scope

**Status:** Accepted
**Date:** 2026-09-03
**Phase:** 24.2-contact-knowledge-egress-search-types
**Source decisions:** milestone-2 dossier `phase-03-contact-knowledge-foundation` §O; 24.2 CONTEXT D-06 and D-12; Plan 05 owner resolution
**Reversibility:** one-way
**Migration:** 018
**Supersedes:** None
**Superseded by:** None

## Context

Custom fields need optional retained value history, broader typed input, and future per-contact definitions without weakening ADR-001's normalized current-value pair. The pre-existing `field_history` is a short-lived destructive-operation audit trace, so it cannot serve as a user-visible value timeline.

## Decision

The system uses an additive `custom_field_value_history` table for prior raw values while preserving `custom_field_values` as the unique current pair. Migration 018 adds global-default scope, history-retained, and group metadata; public field creation remains global-only until Phase 31 delivers contact-scoped ownership, lifecycle, and UI together. URL, email, and phone extend the existing type set with one permissive, byte-preserving parser each.

## Alternatives Considered

- **Reuse `field_history`** — rejected because it is destructive-operation-only, unread, pruned after 30 days, and excluded from backup.
- **Relax the current-value uniqueness constraint for history** — rejected because it reverses ADR-001's durable pair invariant.
- **Expose contact-scoped field creation immediately** — rejected because durable ownership and owner-purge semantics are not yet implemented.

## Consequences

### Positive

- A real contact edit atomically retains its changed prior raw value, and backup/restore can preserve that timeline.
- Existing current-value identity, raw TEXT storage, parser, and sort invariants remain intact.

### Negative

- Merge, purge, and permanent definition deletion must explicitly reparent or tombstone history rows before a foreign-key cascade can remove them.

### Risks

- A migration or lifecycle writer that relies on cascade deletion can silently lose retained history; all three destructive paths require explicit tests.

## Implementation

**Key files:**
- `src/db/migrations/018-custom-field-scope-history.ts` — adds definition metadata and the retained-value table.
- `src/db/value-history-dao.ts` — appends and reads prior raw values.
- `src/db/contacts-dao.ts` — composes history capture into the production edit transaction.
- `src/db/field-ddl.ts` — explicitly tombstones retained history before permanent definition deletion.
- `src/db/merge-dao.ts` — reparents retained values to the merge survivor.
- `src/db/purge-dao.ts` — tombstones and removes retained history during contact purge.
- `src/db/field-parsers.ts` — supplies the exhaustive, permissive ten-type parser map.

**Depends on:** ADR-001 (Normalized Custom-Field Values); ADR-014 (Read-Time Custom-Field Type Semantics and a Single Sort Expression)
**Required by:** _None._
