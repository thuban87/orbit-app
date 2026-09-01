# Persistence Core

**Last updated:** 2026-08-14
**Updated by phase:** 02-data-foundation-status-engine
**Owners:** `src/db/database.ts`, `src/db/migrations/runner.ts`, `src/db/migrations/001-initial.ts`, `src/db/mutex.ts`

## Purpose

The persistence core opens Orbit's on-device SQLite database and advances its schema safely. It provides the forward-only migration contract and serialized write primitive that the data systems use; it has no backend or remote-repair path.

## Architecture

### Data Model

The schema version is SQLite's `PRAGMA user_version`. Migration 001 creates the initial application tables in a single version step; its relational data model is documented by the owning system docs.

**Tables:**
- `categories` — seeded, user-editable single-select contact groups.
- `profile` — the single self/profile record.
- `contacts` — the primary person record and maintained recency summary.
- `interactions` — dated contact touchpoints.
- `contact_links`, `events`, `custom_field_defs`, `contact_custom_values`, `field_history`, `fuel` — durable supporting data introduced in the first schema.

**Types** (`src/db/types.ts`):
- `SqlExecutor` — database operations shared by Expo SQLite and the node-side test adapter.
- `Migration` / `MigrationDeps` — a numbered migration step and its deterministic seed dependencies.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Bootstrap | `src/db/database.ts` | Opens `orbit.db`, configures the connection, and runs migrations. |
| Migration runner | `src/db/migrations/runner.ts` | Applies pending version steps in ascending order. |
| Migration | `src/db/migrations/001-initial.ts` | Defines migration-1 schema and seeds. |
| Concurrency utility | `src/db/mutex.ts` | Serializes database write transactions in one JS runtime. |

### Key Files

| File | Role |
|---|---|
| `src/db/database.ts` | Bootstrap, PRAGMAs, migrated database access, and local timestamp helper. |
| `src/db/migrations/runner.ts` | Per-step atomic `user_version` migration control flow. |
| `src/db/migrations/001-initial.ts` | Initial DDL and category/profile seeds. |
| `src/db/types.ts` | Testable database and migration interfaces. |
| `src/db/mutex.ts` | Promise-chain serialization primitive. |

## How It Works

### Opening and migrating the database

1. The app calls `openAndMigrate()` before normal data reads.
2. The bootstrap opens `orbit.db` and sets WAL, `foreign_keys=ON`, and `busy_timeout` before a transaction begins.
3. `runMigrations()` reads `PRAGMA user_version`, orders pending migrations, and runs each in its own `BEGIN`/`COMMIT` transaction.
4. A successful step commits its DDL and version bump together; a failing step rolls back and leaves the version at the prior committed value.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `BUSY_TIMEOUT_MS` | `5000` | `src/db/database.ts` | Wait budget for a busy shared connection. |
| `TARGET_VERSION` | `1` | `src/db/database.ts` | Schema version expected by the phase-2 application. |

## Decisions

- **ADR-008:** Initial Contact Schema as a Cross-Phase Data Contract — migration 001 establishes the durable first schema.
- **ADR-009:** Crash-Safe Forward-Only SQLite Migrations — every version step commits atomically.
- **ADR-012:** Opt-Out Android Backup for Third-Party PII — persistent contact data is excluded from Android Auto Backup.

## Gotchas

1. **Set `foreign_keys` before the transaction.** SQLite treats this pragma as a no-op inside a transaction, which would make cascade declarations ineffective.
2. **Do not use Expo transaction helpers for migration steps.** A throwing rollback can mask the original SQL error; the runner uses a hand-rolled rollback that preserves it.
3. **A failed bootstrap needs an explicit UI error state.** At phase close, an unhandled `openAndMigrate()` rejection could leave the launch shell loading indefinitely.

## Related Systems

- **Contacts** — owns the contact data and recency writes stored in the initial schema.
- **Status engine** — reads the migrated contact and interaction data at query time.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-14 | 02 | Created the SQLite bootstrap, migration-1 contract, and shared write serialization. |
