# Persistence Core

**Last updated:** 2026-08-26
**Updated by phase:** 19-system-contact-import
**Owners:** `src/db/database.ts`, `src/db/migrations/runner.ts`, `src/db/migrations/001-initial.ts`, `src/db/mutex.ts`, `src/db/transaction.ts`, `src/services/launch-sweep.ts`

## Purpose

The persistence core opens Orbit's on-device SQLite database and advances its schema safely. It provides the forward-only migration contract and serialized write primitive that the data systems use; it has no backend or remote-repair path.

## Architecture

### Data Model

The schema version is SQLite's `PRAGMA user_version`. Migrations 001–005 establish the initial application, settings, Orrery, AI, and digest-policy schema; migration 006 replaces dynamic custom-field columns with normalized current-value rows. Each relational data model is documented by its owning system doc.

**Tables:**
- `categories` — seeded, user-editable single-select contact groups.
- `profile` — the single self/profile record.
- `contacts` — the primary person record and maintained recency summary.
- `interactions` — dated contact touchpoints.
- `contact_links`, `events`, `custom_field_defs`, `field_history`, `fuel` — durable supporting data introduced in the first schema.
- `custom_field_values` — migration-006 normalized uid-bearing custom-field current state, unique per contact-and-definition pair.
- `app_settings` — a singleton SQLite row for non-secret preferences, a monotonic exportable-data revision, and device-local backup health/configuration. It never contains an API key or passphrase.
- `tombstones` — indefinitely retained type-and-UID deletion evidence for portable reconciliation.
- `restore_photo_journal` — committed restore-photo finalization and cleanup work.
- `contact_methods` — ordered UID-bearing phone/email rows with canonical/actionability data, optional label, and durable display order.
- external-link and method-provenance rows — UID-bearing local source evidence that never replaces Orbit identity.
- `contacts.tracking_enabled` and nullable `contacts.interval_days` — an independent Bound/Unbound lifecycle; NULL cadence means never assigned, not Unbound.
- `import_sessions` and `import_session_rows` — local-only durable contact-import snapshots, row transitions, advisory candidates, and retryable photo-staging references; they are not portable backup data.

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
| Migration | `src/db/migrations/004-ai-settings.ts` | Adds default-off non-secret AI configuration and acknowledgement columns. |
| Migration | `src/db/migrations/005-digest-settings.ts` | Adds the default-on `digest_enabled` notification-policy column. |
| Migration | `src/db/migrations/006-normalize-custom-field-values.ts` | Atomically validates and converts legacy custom values to normalized pairs. |
| Migration | `src/db/migrations/007-tombstones.ts` | Adds tombstones, data revisions, stable seed identities, and backup settings. |
| Migration | `src/db/migrations/008-restore-photo-journal.ts` | Adds durable committed restore-photo recovery evidence. |
| Migration | `src/db/migrations/009-contact-method-normalization.ts` | Rebuilds the contact graph and migrates scalar endpoints into normalized methods. |
| Migration | `src/db/migrations/010-contact-method-label.ts` | Adds nullable durable labels to normalized method rows. |
| Migration | `src/db/migrations/011-contact-lifecycle-schema.ts` | Rebuilds the contact graph without data changes to add lifecycle guards and lifecycle settings. |
| Migration | `src/db/migrations/012-import-sessions.ts` | Adds local-only durable import-session and import-row state. |
| Settings DAO | `src/db/app-settings-dao.ts` | Validates and persists the singleton's notification, Orrery, and non-secret AI preference updates. |
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
| `src/db/migrations/004-ai-settings.ts` | Adds non-secret AI configuration and acknowledgement columns with constant defaults. |
| `src/db/migrations/005-digest-settings.ts` | Adds `digest_enabled INTEGER NOT NULL DEFAULT 1` without a new table or per-contact state. |
| `src/db/migrations/006-normalize-custom-field-values.ts` | Validates, copies, proves, and retires the legacy dynamic custom-value table in one step. |
| `src/db/migrations/007-tombstones.ts` | Adds permanent deletion evidence and backup-specific SQLite support. |
| `src/db/migrations/008-restore-photo-journal.ts` | Adds journal rows for committed restore-photo recovery. |
| `src/db/migrations/009-contact-method-normalization.ts` | Performs the FK-safe contacts rebuild and scalar-to-method cutover. |
| `src/db/migrations/010-contact-method-label.ts` | Adds optional persisted method labels in a separate forward step. |
| `src/db/migrations/011-contact-lifecycle-schema.ts` | Adds `tracking_enabled`, nullable never-assigned cadence, one-way cadence guards, and lifecycle settings while preserving contact children. |
| `src/db/migrations/012-import-sessions.ts` | Adds durable selected-contact snapshots, row-state constraints, and import indexes. |
| `src/db/import-session-dao.ts` | Owns atomic session acceptance and transaction-composable import-row state transitions. |
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
7. Migration 004 adds the disabled `ai_provider`, ordinary provider/model/template settings, and per-provider acknowledgement flags. It has no credential column; keys belong only to SecureStore.
8. Migration 005 adds the default-on `digest_enabled` column so weekly-digest scheduling can preserve a durable user OFF choice across launch reconciliation.
9. Migration 006 validates every legacy definition/value correspondence, copies raw values into uid-bearing normalized pairs, proves the copied matrix, and only then retires the legacy table. A loss-bearing inconsistency rolls the whole step back unchanged; a non-loss-bearing orphan column is retained only as a bounded `field_history` snapshot before the step proceeds.
10. Migration 007 adds permanent tombstones and a monotonic `data_revision` so automatic backup detects every exportable change without timestamp ties. It also fixes profile and seeded-category UIDs across installations.
11. Migration 008 adds the restore-photo journal; its rows authorize recovery only after the associated database transaction commits.
12. Migration 009 rebuilds `contacts`, re-points every foreign-key child before retiring the old parent, proves child preservation, and moves scalar phone/email values into normalized method rows. It uses a supplied device region only for the one-time migration parse and records the canonicalization region on successful phone rows.
13. Migration 010 adds nullable durable method labels; it does not rewrite the committed v9 migration.
14. Migration 011 preserves all retained contact values and children while adding Bound/Unbound lifecycle state. Its checks require a positive integer cadence for Bound contacts, and its trigger prevents a previously assigned cadence from being cleared.
15. Migration 012 adds local-only import sessions after a picker selection has been accepted. Its rows retain the durable recovery state but do not become part of portable backup contents.

### Running launch maintenance

1. After the migrated database is ready, the app registers maintenance hooks against the launch-sweep registry.
2. The trigger runs each hook once for the foreground launch, after database access is available.
3. A hook that writes obtains its own `inWriteTransaction()`; it must not nest that non-reentrant boundary inside another hook transaction.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `BUSY_TIMEOUT_MS` | `5000` | `src/db/database.ts` | Wait budget for a busy shared connection. |
| `TARGET_VERSION` | `12` | `src/db/database.ts` | Schema version after the import-session migration. |

## Decisions

- **ADR-008:** Initial Contact Schema as a Cross-Phase Data Contract — migration 001 establishes the durable first schema.
- **ADR-009:** Crash-Safe Forward-Only SQLite Migrations — every version step commits atomically.
- **ADR-010:** Single-Writer Interaction Recency Spine — the shared mutex serializes its write transactions.
- **ADR-012:** Opt-Out Android Backup for Third-Party PII — persistent contact data is excluded from Android Auto Backup.
- **ADR-001:** Normalized Custom-Field Values — migration 006 atomically establishes normalized custom-field pairs.
- **ADR-013:** Runtime Two-Table Custom Fields with Whitelist-Constructed DDL — superseded by ADR-001.
- **ADR-015:** Lossless Field Changes with Quarantine and Launch-Time Retention Sweep — partially superseded; launch maintenance still retires stale fields safely.
- **ADR-028:** Per-Item Conversational Fuel with Fixed Kinds — uses the migration-001 schema contract for durable fuel rows.
- **ADR-041:** Notification Settings, Privacy Channels, and Birthday Alerts — uses migration 002 for durable, backup-native local notification policy.
- **ADR-047:** App-Level Assignable Sun and Themed Self Identity — uses migration 003 for validated, app-level Orrery sun preferences.
- **ADR-049:** BYO-Key AI Configuration and Credential Boundary — uses migration 004 for exportable non-secret AI settings and excludes keys from SQLite.
- **ADR-052:** Compose-Owned AI Draft Lifecycle and Acknowledged Egress — reads the typed application settings boundary while keeping a draft lifecycle in Compose.
- **ADR-055:** Dedicated Weekly Digest Scheduling and Persisted Notification Policy — uses migration 005 for the durable default-on digest toggle.
- **ADR-056:** Tombstone-Backed UID Reconciliation for Portable Restores — adds durable deletion evidence and revision tracking.
- **ADR-057:** Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots — uses consistent local read snapshots and migration-backed state.
- **ADR-058:** Optional Encrypted Backups and Previewed Local Restoration — relies on atomic restore state and durable photo recovery evidence.
- **ADR-059:** Normalized Contact Methods, Canonical Actionability, and Local Provenance — defines the v9/v10 normalized endpoint migrations.
- **ADR-062:** Bound/Unbound Lifecycle and One-Way Cadence Assignment — defines v11 lifecycle shape and its durable cadence invariant.
- **ADR-065:** Durable Resumable Contact-Import Sessions with Failure-Isolated Photos — defines migration 012's local-only recovery state.

## Gotchas

1. **Set `foreign_keys` before the transaction.** SQLite treats this pragma as a no-op inside a transaction, which would make cascade declarations ineffective.
2. **Do not use Expo transaction helpers for migration steps.** A throwing rollback can mask the original SQL error; the runner uses a hand-rolled rollback that preserves it.
3. **A failed bootstrap needs an explicit UI error state.** At phase close, an unhandled `openAndMigrate()` rejection could leave the launch shell loading indefinitely.
4. **The shared transaction is non-reentrant.** A helper called from inside `inWriteTransaction()` must use a non-mutexed core rather than acquiring the mutex again, or the promise chain deadlocks.
5. **Treat `app_settings` as a singleton.** The migration guarantees `id=1`; a missing row is corruption, not an empty notification state.
6. **Do not write a palette default into `self_sun_colour`.** NULL deliberately means unresolved; the Orrery render resolves it through the ordered theme palette.
7. **Never add a credential column to `app_settings`.** Migration 004 deliberately persists only non-secret AI configuration; provider keys remain in SecureStore.
8. **Do not infer the digest setting from OS request presence.** Migration 005's explicit `digest_enabled` column preserves a user OFF choice when launch reconciliation runs.
9. **Migration 006 is a one-way cutover.** Do not add a dynamic-table fallback or dual-write mode; a loss-bearing proof failure must leave the prior database unchanged.
10. **Treat `data_revision` as exportable-change evidence.** Backup health writes must not bump it, or every successful snapshot would immediately look stale.
11. **A read snapshot is intentionally read-only.** Use `inReadSnapshot()` for a coherent export; writes still require the non-reentrant transaction boundary.
12. **Journal photo work before finalization.** A restore-photo file is recoverable only when a matching committed journal row exists.
13. **Re-point foreign-key children before dropping a rebuilt parent.** `defer_foreign_keys` delays checking, not cascade actions; row-count preservation and a surviving `sun_contact_id` are load-bearing migration proofs.
14. **Do not treat NULL cadence as Unbound.** It means no cadence has ever been assigned; `tracking_enabled` alone controls lifecycle participation.
15. **Import sessions are not portable state.** A Replace-all restore clears them, and import recovery must never try to revive a source-provider grant.

## Related Systems

- **Contacts** — owns the contact data and recency writes stored in the initial schema.
- **Status engine** — reads the migrated contact and interaction data at query time.
- **Custom fields** — uses migration 006, the shared transaction, and the launch-sweep registry for normalized-row cleanup.
- **Notifications** — reads the persisted policy during launch/foreground schedule reconciliation.
- **Orrery** — reads and writes the app-level sun settings added by migration 003.
- **AI suggestions** — persists non-secret settings and acknowledgement state through migration 004 while keeping credentials outside SQLite.
- **Digest** — reads the migration-005 scheduling preference and registers a post-migration launch-sweep reconcile.
- **Backup & Restore** — uses migrations 007/008, revisions, snapshots, and launch recovery without a backend.
- **Contact Import** — uses migration 012, serial write cores, and foreground recovery hooks for accepted selected-contact work.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-14 | 02 | Created the SQLite bootstrap, migration-1 contract, and shared write serialization. |
| 2026-08-14 | 03 | Added the shared transaction entry point and launch-sweep integration for runtime custom-field maintenance. |
| 2026-08-16 | 11 | Added migration 002 and the validated SQLite app-settings policy boundary. |
| 2026-08-17 | 13 | Added migration 003 and nullable app-level Orrery sun settings. |
| 2026-08-18 | 14 | Added migration 004 and the non-secret AI settings boundary. |
| 2026-08-23 | 15 | Added migration 005 and the durable default-on weekly-digest setting. |
| 2026-08-24 | 16 | Added migration 006's atomic normalized custom-field value cutover. |
| 2026-08-24 | 17 | Added migrations 007/008 for tombstones, backup revisions, and committed photo-recovery work. |
| 2026-08-27 | 18.1 | Added migrations 009/010 for FK-safe normalized contact methods and durable labels. |
| 2026-08-27 | 18.2 | Added migration 011 for Bound/Unbound lifecycle, one-way cadence guards, and lifecycle settings. |
| 2026-08-26 | 19 | Added migration 012 for local-only durable contact-import sessions. |
