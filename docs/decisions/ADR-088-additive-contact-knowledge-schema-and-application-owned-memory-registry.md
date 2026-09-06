# ADR-088: Additive Contact-Knowledge Schema and Application-Owned Memory Registry

**Status:** Accepted
**Date:** 2026-09-03
**Phase:** 24.1-contact-knowledge-foundation
**Source decisions:** milestone-2 dossier `phase-03-contact-knowledge-foundation` §§A–G, J–L; 24.1 CONTEXT D-03–05
**Reversibility:** one-way
**Migration:** 016
**Supersedes:** None
**Superseded by:** None

## Context

Orbit had fixed-kind conversational fuel but no typed contact-knowledge model, structured relationships, or retained current-state history. The new durable model had to coexist with fuel during this additive phase, preserve first-class contact semantics, and keep Memory types application-owned under ADR-028.

## Decision

The system uses migration 016 to add `memories`, `relationships`, and `current_state_entries`, with an in-code Memory registry. Users can label individual `custom` Memory items but cannot create system types; relationships can optionally link another Orbit contact, and current-state entries retain history while SQLite enforces at most one current value per contact and field.

## Alternatives Considered

- **Reshape conversational fuel in this migration** — rejected because the fuel-to-Memory data move is destructive and belongs to phase 24.2.
- **User-created Memory system types** — rejected because it would reverse ADR-028; flexibility comes from the application-owned `custom` type and per-item label.
- **Flatten all contact knowledge into one generic feed** — rejected because first-class properties, relationships, and typed Memory have distinct semantics despite sharing one presentation surface.

## Consequences

### Positive

- Profile and later consumers can read a typed local knowledge model without conflating it with conversational fuel.
- Optional relationship links, deterministic Memory ordering, retained current-state history, and database self-link/current-row constraints protect future writers.

### Negative

- The frozen additive schema spans three tables and requires dedicated DAO/read boundaries.

### Risks

- Migration 016 is forward-only; it must preserve all earlier tables and cannot introduce a hidden data move or custom-field change.
- The default general Memory display name remains a single-source provisional constant pending owner reconciliation.

## Implementation

**Key files:**
- `src/db/migrations/016-contact-knowledge.ts` — defines the additive tables, constraints, and read indexes.
- `src/db/database.ts` — registers migration 016 and advances the schema target.
- `src/db/memory-registry.ts` — declares the application-owned Memory and current-state metadata contracts.
- `src/db/memories-dao.ts` — validates and writes typed Memory rows through the shared transaction boundary.
- `src/db/memories-read.ts` — reads live and deleted Memory projections with registry-driven visibility.
- `src/db/relationships-dao.ts` — writes structured relationships with an application self-link guard.
- `src/db/relationships-read.ts` — reads live relationships with optional linked-contact names.
- `src/db/current-state-history-dao.ts` — atomically sets, promotes, and edits retained current-state values.
- `src/db/current-state-history-read.ts` — reads current and historical state rows.
- `src/db/first-class-knowledge-read.ts` — projects first-class contact knowledge for the unified surface.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations); ADR-028 (Per-Item Conversational Fuel with Fixed Kinds)
**Required by:** _None._
