# ADR-008: Initial Contact Schema as a Cross-Phase Data Contract

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 02-data-foundation-status-engine
**Source decisions:** dossier `01-data` clusters A, D–F; 02-CONTEXT DATA-02/03
**Reversibility:** one-way
**Migration:** 001
**Supersedes:** None
**Superseded by:** None

## Context

Orbit is a local-first, on-device SQLite app with no remote database repair path. The first schema therefore has to establish the contact identity, fixed-column boundary, lifecycle fields, and mergeable-table metadata that later phases cannot truthfully backfill.

## Decision

The system uses migration 001 to create the initial ten-table data contract: stable surrogate identities and UIDs, the contact/category/profile/link/interaction foundations, and the custom-field and fuel tables required by later phases. Contact names remain non-unique, categories are editable relational data, and fields that other systems must safely read remain fixed contact columns.

## Alternatives Considered

- **Use the contact name as identity** — Rejected because renames and duplicate names would corrupt or ambiguously attach owned data.
- **Store category or required fixed fields as custom fields** — Rejected because dashboard grouping, the AI prompt, and other readers cannot depend on user-deletable schema.
- **Defer un-backfillable columns and supporting tables** — Rejected because unreachable devices make a later truthful backfill impossible.

## Consequences

### Positive

- Later features share stable relational identities and migration-1 metadata from day one.
- Custom fields and fuel can add behavior without reshaping the original database.

### Negative

- The initial schema carries columns and tables before every owning UI is implemented.

### Risks

- A migration-1 schema error is permanent for affected devices; the schema and seeds require exhaustive node-side verification.

## Implementation

**Key files:**
- `src/db/migrations/001-initial.ts` — defines the initial schema, ordered DDL, and category/profile seeds.
- `src/db/uid.ts` — generates mergeable row identities.
- `src/db/database.ts` — registers migration 001 in the application migration list.

**Depends on:** None.
**Required by:** ADR-010 (Single-Writer Interaction Recency Spine); ADR-012 (Opt-Out Android Backup for Third-Party PII); ADR-013 (Runtime Two-Table Custom Fields with Whitelist-Constructed DDL); ADR-017 (Multi-Link Contact Reachability); ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out).
