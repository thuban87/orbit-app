# SQLite Migration Pipeline

## Overview

Orbit evolves its on-device SQLite schema with ordered TypeScript migrations rather than SQL files or a remote database. Use this process when changing durable SQLite structure: it keeps one version step atomic, testable with node-side SQLite, and safe to retry after a failure.

## Architecture (Phases 02, 11, 16, 17, 18.1, 24.2)

The bootstrap opens `orbit.db`, sets connection PRAGMAs before opening a transaction, then calls the migration runner. The runner reads `PRAGMA user_version`, sorts pending steps, and commits each step's DDL and version bump together.

### Migration runner

**File:** `src/db/migrations/runner.ts`

`runMigrations()` takes a `SqlExecutor`, an ordered-or-unordered migration list, the target version, and deterministic dependencies. It sorts pending steps itself, but a migration must still use one integer version and no version may be reused.

```typescript
await exec.execAsync("BEGIN");
try {
  await migration.apply(exec, deps);
  await exec.execAsync(`PRAGMA user_version = ${next}`);
  await exec.execAsync("COMMIT");
} catch (error) {
  await exec.execAsync("ROLLBACK").catch(() => {});
  throw error;
}
```

### Resolution order

1. **`src/db/database.ts`** — opens the database and sets WAL, foreign keys, and busy timeout.
2. **`src/db/migrations/runner.ts`** — discovers and applies pending numbered steps.
3. **`src/db/migrations/001-initial.ts`** — defines the phase-2 initial schema and seeds.
4. **`src/db/migrations/002-app-settings.ts`** — additive singleton-settings example: DDL and seed remain in the same version step.
5. **`src/db/migrations/006-normalize-custom-field-values.ts`** — representation-conversion example: validates, copies, proves, then retires a legacy table in one transaction.
6. **`src/db/migrations/007-tombstones.ts`** — additive backup-support example: creates durable deletion evidence and adds singleton defaults.
7. **`src/db/migrations/008-restore-photo-journal.ts`** — additive recovery-table example for committed restore work.
8. **`src/db/migrations/009-contact-method-normalization.ts`** — parent-table rebuild example: preserves/re-points every foreign-key child, proves child rows, and cuts a scalar representation over to normalized children.
9. **`src/db/migrations/010-contact-method-label.ts`** — additive nullable metadata example following an immutable shipped rebuild.
10. **`PRAGMA user_version`** — records the last fully committed step.
11. **`src/db/migrations/017-knowledge-egress-datamove.ts`** — data-move example: copy every source row, re-read and prove its mapped destination, then remove the source inside the runner-owned transaction.
12. **`src/db/migrations/018-custom-field-scope-history.ts`** — additive columns/table example that leaves a prior normalized current-value invariant intact.

## File Locations

### Code

| File | Purpose |
|---|---|
| `src/db/database.ts` | Connection bootstrap and migration registration. |
| `src/db/migrations/runner.ts` | Forward-only atomic migration runner. |
| `src/db/migrations/001-initial.ts` | Initial schema migration example. |
| `src/db/migrations/001-initial.test.ts` | Node-side schema, seed, and cascade verification. |
| `src/db/migrations/002-app-settings.ts` | Additive, defaulted singleton-table migration example. |
| `src/db/migrations/006-normalize-custom-field-values.ts` | Atomic dynamic-column to normalized-pair conversion. |
| `src/db/migrations/006-normalize-custom-field-values.test.ts` | v5-to-v6 preservation, rollback, and orphan-column migration proof. |
| `src/db/migrations/007-tombstones.ts` | Tombstone, revision, reserved-identity, and backup-settings migration. |
| `src/db/migrations/008-restore-photo-journal.ts` | Durable restore-photo journal migration. |
| `src/db/migrations/009-contact-method-normalization.ts` | FK-safe contacts rebuild and normalized-method cutover. |
| `src/db/migrations/009-contact-method-normalization.test.ts` | v8-to-v9 method, child-preservation, and rollback proof. |
| `src/db/migrations/010-contact-method-label.ts` | Forward-only nullable method-label addition. |
| `src/db/migrations/017-knowledge-egress-datamove.ts` | Verified copy-then-remove fuel-to-Memory data move. |
| `src/db/migrations/018-custom-field-scope-history.ts` | Additive custom-field metadata and retained-value history. |
| `src/db/migrations/full-chain.test.ts` | Runs the shared registered migration chain to the imported target version. |
| `src/db/app-settings-dao.test.ts` | Migration-002 defaults and validated settings-write coverage. |
| `src/db/__testkit__/node-sqlite.ts` | In-memory SQLite adapter for migration tests. |

## How to Add a SQLite Migration

1. **Choose the next unused integer version** and create `src/db/migrations/<NNN>-<slug>.ts`. Export one `Migration` object with that version and an `apply(exec, deps)` function.

2. **Write only parameterized values** inside the migration. Put DDL in explicit statement constants and run it through the provided executor:

   ```typescript
   import type { Migration } from "@/db/types";

   export const migrationNNN: Migration = {
     version: NNN,
     async apply(exec, deps) {
       await exec.execAsync("CREATE TABLE example (id INTEGER PRIMARY KEY)");
       await exec.runAsync("INSERT INTO example (id) VALUES (?)", [1]);
     },
   };
   ```

3. **Register the migration** in the exported `MIGRATIONS` list in `src/db/database.ts`, and advance `TARGET_VERSION` to the same integer. The runner performs the transaction and `user_version` bump; do not add a second transaction or manually update `user_version` in the migration.

4. **Add an in-memory test** beside the migration. Open the fixture from `src/db/__testkit__/node-sqlite.ts`, run the real migration runner, and assert the schema/data result plus retry safety for a throwing step where relevant. For a representation conversion or data move, map every source row to a newly inserted destination, re-read each destination to prove the important values, then remove sources only after every proof passes. Test source-byte preservation, complete destination coverage, and an unchanged source database after a classified failure.

5. **For a parent-table rebuild, derive and re-point every foreign-key child before dropping the old parent.** `PRAGMA defer_foreign_keys` delays constraint checking but does not suppress `ON DELETE` actions. Assert the child set, per-child row counts, retained references such as `app_settings.sun_contact_id`, and `foreign_key_check`; use one atomic migration transaction.

6. **Run the checks**:

   ```bash
   npx vitest run src/db/migrations/001-initial.test.ts
   npx vitest run src/db/migrations/runner.test.ts
   npx tsc --noEmit
   npx biome check src/db
   ```

### What You Don't Need to Change

- Do not write a `.sql` migration file; Orbit migrations are TypeScript under `src/db/migrations/`.
- Do not use `withTransactionAsync` or `withExclusiveTransactionAsync` for a migration step.
- Do not set `foreign_keys=ON` inside the migration; `openAndMigrate()` sets it before the runner starts.
- Do not add a dual-read or dual-write compatibility mode after a one-way representation conversion; the migration owns the cutover.

## Pitfalls

1. **Bumping `user_version` outside the migration transaction.** A failure can leave partial DDL while the old version retries against it. Let `runMigrations()` own the bump.

2. **Turning on foreign keys too late.** SQLite ignores that pragma inside a transaction, so foreign-key cascades become decorative.

3. **Adding an un-backfillable column later.** Migration 001 deliberately includes merge metadata and core fields from day one because unreachable devices cannot receive a truthful historical backfill.

4. **Treating every malformed legacy shape alike.** Migration 006 rolls back unchanged when a loss-bearing inconsistency prevents preservation, but records a non-loss-bearing orphan dynamic column in bounded `field_history` and proceeds. The latter is an audit trace, not recovery or backup.

5. **Leaving the full-chain assertion on a literal version.** Import `TARGET_VERSION` and the shared `MIGRATIONS` registry so the test follows newly registered steps such as 007 and 008.

6. **Dropping a parent before its children point to the replacement.** Deferred checking does not stop SQLite's immediate cascade actions. Rebuild and verify every child first; `foreign_key_check` alone cannot prove rows were not cascaded away.

7. **Treating equal row counts as a data-move proof.** Duplicate sources can mask a dropped row. Retain a source-to-destination mapping and re-read every destination before deleting any source.

## Smoke Test

```bash
npx vitest run src/db/migrations/runner.test.ts src/db/migrations/full-chain.test.ts src/db/migrations/006-normalize-custom-field-values.test.ts src/db/migrations/017-knowledge-egress-datamove.test.ts src/db/migrations/018-custom-field-scope-history.test.ts
```

Expected: the runner and full-chain suites reach the registered target, while representation conversion, verified data moves, and additive schema history checks pass.

```bash
npx tsc --noEmit && npx biome check src/db
```

Expected: TypeScript and database formatting checks complete without errors.
