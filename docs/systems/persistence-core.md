# Persistence Core

**Last updated:** 2026-08-17
**Updated by phase:** 13-orrery
**Owners:** `src/db/database.ts`, `src/db/migrations/runner.ts`, `src/db/migrations/001-initial.ts`, `src/db/mutex.ts`, `src/db/transaction.ts`, `src/services/launch-sweep.ts`

## Purpose

The persistence core opens Orbit's on-device SQLite database and advances its schema safely. It provides the forward-only migration contract and serialized write primitive that the data systems use; it has no backend or remote-repair path.

## Architecture

### Data Model

The schema version is SQLite's `PRAGMA user_version`. Migration 001 creates the initial application tables, migration 002 adds the single-row notification-policy table, and migration 003 adds app-level Orrery sun preferences; each relational data model is documented by its owning system doc.

**Tables:**
- `categories` — seeded, user-editable single-select contact groups.
- `profile` — the single self/profile record.
- `contacts` — the primary person record and maintained recency summary.
- `interactions` — dated contact touchpoints.
- `contact_links`, `events`, `custom_field_defs`, `contact_custom_values`, `field_history`, `fuel` — durable supporting data introduced in the first schema.
- `app_settings` — a singleton SQLite row for backup-native notification policy, privacy choice, local delivery/quiet hours, and nullable Orrery sun preferences.

**Types** (`src/db/types.ts`):
- `SqlExecutor` — database operations shared by Expo SQLite and the node-side test adapter.
- `Migration` / `MigrationDeps` — a numbered migration step and its deterministic seed dependencies.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Bootstrap | `src/db/database.ts` | Opens `orbit.db`, configures the connection, and runs migrations. |
| Migration runner | `src/db/migrations/runner.ts` | Applies pending version steps in ascending order. |
| Migration | `src/db/migrations/001-initial.ts` | Defines migration-1 schema and seeds. |
| Migration | `src/db/migrations/002-app-settings.ts` | Adds and seeds the notification-policy singleton. |
| Migration | `src/db/migrations/003-orrery-settings.ts` | Adds nullable `sun_contact_id` and `self_sun_colour` settings. |
| Settings DAO | `src/db/app-settings-dao.ts` | Validates and persists the singleton's notification and Orrery preference updates. |
| Concurrency utility | `src/db/mutex.ts` | Serializes database write transactions in one JS runtime. |
| Transaction utility | `src/db/transaction.ts` | Opens a hand-rolled transaction inside the shared non-reentrant mutex. |
| Launch-sweep registry | `src/services/launch-sweep.ts` | Runs registered local maintenance hooks after migration. |

### Key Files

| File | Role |
|---|---|
| `src/db/database.ts` | Bootstrap, PRAGMAs, migrated database access, and local timestamp helper. |
| `src/db/migrations/runner.ts` | Per-step atomic `user_version` migration control flow. |
| `src/db/migrations/001-initial.ts` | Initial DDL and category/profile seeds. |
| `src/db/migrations/002-app-settings.ts` | Additive app-settings DDL and default notification-policy seed. |
| `src/db/migrations/003-orrery-settings.ts` | Adds the nullable app-level sun occupant and self-star colour. |
| `src/db/app-settings-dao.ts` | Typed, bounds-validated read and update boundary for application settings. |
| `src/db/types.ts` | Testable database and migration interfaces. |
| `src/db/mutex.ts` | Promise-chain serialization primitive. |
| `src/db/transaction.ts` | Shared `inWriteTransaction()` primitive used by serialized database writers. |
| `src/services/launch-sweep.ts` | Registry and trigger for launch-time maintenance hooks. |

## How It Works

### Opening and migrating the database

1. The app calls `openAndMigrate()` before normal data reads.
2. The bootstrap opens `orbit.db` and sets WAL, `foreign_keys=ON`, and `busy_timeout` before a transaction begins.
3. `runMigrations()` reads `PRAGMA user_version`, orders pending migrations, and runs each in its own `BEGIN`/`COMMIT` transaction.
4. A successful step commits its DDL and version bump together; a failing step rolls back and leaves the version at the prior committed value.
5. Migration 002 seeds `app_settings.id=1` with notifications off, per-type defaults on, private lock-screen posture, and 9am / 9pm–8am local timing defaults.
6. Migration 003 adds nullable `sun_contact_id` and `self_sun_colour`; `NULL` remains the valid self/default state, and a hard-purged chosen contact reverts to self through `ON DELETE SET NULL`.

### Running launch maintenance

1. After the migrated database is ready, the app registers maintenance hooks against the launch-sweep registry.
2. The trigger runs each hook once for the foreground launch, after database access is available.
3. A hook that writes obtains its own `inWriteTransaction()`; it must not nest that non-reentrant boundary inside another hook transaction.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `BUSY_TIMEOUT_MS` | `5000` | `src/db/database.ts` | Wait budget for a busy shared connection. |
| `TARGET_VERSION` | `3` | `src/db/database.ts` | Schema version after the phase-13 Orrery settings migration. |

## Decisions

- **ADR-008:** Initial Contact Schema as a Cross-Phase Data Contract — migration 001 establishes the durable first schema.
- **ADR-009:** Crash-Safe Forward-Only SQLite Migrations — every version step commits atomically.
- **ADR-010:** Single-Writer Interaction Recency Spine — the shared mutex serializes its write transactions.
- **ADR-012:** Opt-Out Android Backup for Third-Party PII — persistent contact data is excluded from Android Auto Backup.
- **ADR-013:** Runtime Two-Table Custom Fields with Whitelist-Constructed DDL — dynamic schema work and value writes use the shared transaction boundary.
- **ADR-015:** Lossless Field Changes with Quarantine and Launch-Time Retention Sweep — launch maintenance retires stale custom fields safely.
- **ADR-041:** Notification Settings, Privacy Channels, and Birthday Alerts — uses migration 002 for durable, backup-native local notification policy.
- **ADR-047:** App-Level Assignable Sun and Themed Self Identity — uses migration 003 for validated, app-level Orrery sun preferences.

## Gotchas

1. **Set `foreign_keys` before the transaction.** SQLite treats this pragma as a no-op inside a transaction, which would make cascade declarations ineffective.
2. **Do not use Expo transaction helpers for migration steps.** A throwing rollback can mask the original SQL error; the runner uses a hand-rolled rollback that preserves it.
3. **A failed bootstrap needs an explicit UI error state.** At phase close, an unhandled `openAndMigrate()` rejection could leave the launch shell loading indefinitely.
4. **The shared transaction is non-reentrant.** A helper called from inside `inWriteTransaction()` must use a non-mutexed core rather than acquiring the mutex again, or the promise chain deadlocks.
5. **Treat `app_settings` as a singleton.** The migration guarantees `id=1`; a missing row is corruption, not an empty notification state.
6. **Do not write a palette default into `self_sun_colour`.** NULL deliberately means unresolved; the Orrery render resolves it through the ordered theme palette.

## Related Systems

- **Contacts** — owns the contact data and recency writes stored in the initial schema.
- **Status engine** — reads the migrated contact and interaction data at query time.
- **Custom fields** — uses the shared transaction and launch-sweep registry for runtime DDL and cleanup.
- **Notifications** — reads the persisted policy during launch/foreground schedule reconciliation.
- **Orrery** — reads and writes the app-level sun settings added by migration 003.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-14 | 02 | Created the SQLite bootstrap, migration-1 contract, and shared write serialization. |
| 2026-08-14 | 03 | Added the shared transaction entry point and launch-sweep integration for runtime custom-field maintenance. |
| 2026-08-16 | 11 | Added migration 002 and the validated SQLite app-settings policy boundary. |
| 2026-08-17 | 13 | Added migration 003 and nullable app-level Orrery sun settings. |
