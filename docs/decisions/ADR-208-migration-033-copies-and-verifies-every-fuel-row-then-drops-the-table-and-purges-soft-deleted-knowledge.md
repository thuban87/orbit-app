# ADR-208: Migration 033 Copies and Verifies Every Fuel Row, Then Drops the Table and Purges Soft-Deleted Knowledge

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-54, D-56, D-60, D-88, D-97, D-128 (38.10-CONTEXT.md; ledger Q-06a, Q-06b, Q-07; code review CR-01); carried D-18
**Reversibility:** one-way
**Migration:** 033
**Supersedes:** None
**Superseded by:** None

## Context

ADR-207 gives every kept fuel kind a new home. Existing devices hold fuel rows of every kind, fuel tombstones, `custom` memories and soft-deleted memories and key people whose Recently Deleted screen goes away (ADR-212). There is no remote access to a user's database, so the move must be lossless, verifiable and safe from any starting version (CLAUDE.md "SQLite migrations").

## Decision

Migration 033 (`KNOWLEDGE_HOMES_SCHEMA_VERSION = 33`) moves each fuel row by kind (D-56): `off_limits` → the Off Limits table; `gift` → Gift Ideas; `topic` (share or typed) → Thought of Them; `recent` → Last Talked About dated by the row's `created_at` (date only), with a labelled row stored as `"<label>: <text>"` (D-128); `fact` → Memories. Every copied row starts with Allow AI off, keeps its uid and timestamps, and is re-read and proven before its source is removed. Rows of any other kind with no text, label or URL are skipped and counted; contentless `off_limits` rows are copied as they are (D-97). Fuel tombstones become tombstones for the three home tables. uids that collide are re-minted deterministically (`legacy-<table>-<uid>`, `-2`, …) once, before any copy. Then the migration drops `fuel` (D-54), purges soft-deleted memories and key people with tombstones (D-88), converts `custom` memories to `general` keeping the label (ADR-207), and runs a foreign-key check scoped to its own tables. No legacy-repair steps run (D-60).

## Alternatives Considered

- **Keep the fuel table after copying** — rejected; the owner chose to drop it (Q-06b, "Drop it").
- **Repair legacy rows (restore the Imported type, move old share Memories)** — rejected; no installed base, test contacts cleaned on the phones instead (Q-07, "Skip both").
- **Facts split between Memories and custom fields** — not possible in a migration (it cannot tell attributes from one-offs); existing facts land in Memories and can be moved (Q-06a).
- **Drop a labelled Recent row's label** — rejected at code review (CR-01) as silent one-way loss.

## Consequences

### Positive

- Proven per row by uid; the backup converter (ADR-209) applies the same mapping and an equivalence test pins them together.

### Negative

- One-way: the `fuel` table and the stored current flag cannot come back.
- Soft-deleted knowledge written on test builds between 033 and plan 18 had no cleanup path (review IN-04; none found on the device).

### Risks

- A row with a non-text value fails the whole migration as `Migration033IntegrityError` ("Couldn't start Orbit") rather than being guessed at; reachable only through a bug.

## Implementation

**Key files:**
- `src/db/migrations/033-knowledge-homes.ts` — the schema, copy, proof, tombstone conversion, purge and drop.
- `src/db/legacy-fuel-mapping.ts` — the shared mapping and uid allocator the converter reuses.
- `src/db/database.ts` — `TARGET_VERSION` 33.
- `src/db/tombstones-dao.ts` — `off_limits` replaces the fuel entity type; `deleteTombstoneCore`.
- `src/db/purge-dao.ts` — purge counts and deletes the `off_limits` children.

**Depends on:** ADR-207 (Knowledge Homes After Fuel); ADR-009 (Crash-Safe Forward-Only SQLite Migrations); ADR-081 (Retire AI-Proposed Fuel for Explicit Per-Item Permission)
**Required by:** ADR-209 (Backup Format 8 Converts v7 Files with the Migration Mapping, and Merge Keeps the Lower Allow AI)
