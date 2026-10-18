# SQLite Migration Pipeline

## Overview

Orbit evolves its on-device SQLite schema with ordered TypeScript migrations rather than SQL files or a remote database. Use this process when changing durable SQLite structure: it keeps one version step atomic, testable with node-side SQLite, and safe to retry after a failure.

## Architecture (Phases 02, 11, 16, 17, 18.1, 24.2, 31, 32, 38.10, 38.12)

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
13. **`src/db/migrations/profile-presentation.ts`** — exported-version example: one module owns both migration 024 and the `TARGET_VERSION` value imported by the registry.

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
| `src/db/migrations/033-knowledge-homes.ts` | Table rebuild plus a proven multi-destination data move, uid re-mint and table drop; exports `applyMigration033` returning a result struct. |
| `src/db/migrations/034-snooze-review-memory-resume.ts` | Three parts in one step: a CHECK-widening table rebuild (copy, count-and-match, DROP, RENAME, throw on mismatch), two additive nullable columns, and an owner-approved legacy repair writing a sentinel literal. |
| `src/db/legacy-fuel-mapping.ts` | Shared mapping module the migration's frozen literals are pinned against, also used by the backup converter. |
| `src/backup/v7-v8-migration-equivalence.test.ts` | Proves the migration and the backup converter produce the same rows by uid. |
| `src/db/migrations/018-custom-field-scope-history.ts` | Additive custom-field metadata and retained-value history. |
| `src/db/migrations/profile-presentation.ts` | Independent Profile presentation entities and exported schema-version constant. |
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

3. **Register the migration** in the exported `MIGRATIONS` list in `src/db/database.ts`, and advance `TARGET_VERSION` to the same integer. When one feature owns the new head, export its schema version beside the migration and import that constant as `TARGET_VERSION`, as Profile presentation does. The runner performs the transaction and `user_version` bump; do not add a second transaction or manually update `user_version` in the migration.

4. **Add an in-memory test** beside the migration. Open the fixture from `src/db/__testkit__/node-sqlite.ts`, run the real migration runner, and assert the schema/data result plus retry safety for a throwing step where relevant. For a representation conversion or data move, map every source row to a newly inserted destination, re-read each destination to prove the important values, then remove sources only after every proof passes. Test source-byte preservation, complete destination coverage, and an unchanged source database after a classified failure.

5. **For a parent-table rebuild, derive and re-point every foreign-key child before dropping the old parent.** `PRAGMA defer_foreign_keys` delays constraint checking but does not suppress `ON DELETE` actions. Assert the child set, per-child row counts, retained references such as `app_settings.sun_contact_id`, and `foreign_key_check`; use one atomic migration transaction.

6. **Protect every shipped migration from mechanical rewrites.** Add a new forward migration instead of editing an applied step, and exclude existing `src/db/migrations/*.ts` implementations from bulk formatter `--write` passes. A non-mutating formatter check is acceptable; if it reports an old migration, review the report but do not rewrite production history merely to satisfy current style.

7. **Run the checks**:

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

8. **Repeating a literal head version across the feature.** Derive head+1 from the live registry immediately before implementation and single-source the accepted version from the migration module.

9. **Shipping a value-remap migration without lockstepping every literal consumer.** When a migration re-maps stored *values* in place (e.g. migration 025's `good/fine/hard → Positive/Neutral/Negative` and channel remap), a reader still comparing the retired literal silently miscounts. Single-source the map in one module (e.g. `src/db/interaction-vocabulary.ts`), let the migration's CASE arms be frozen literals **test-pinned** equal to that map but never importing it at upgrade time, and ship the migration **plus every live literal comparer** (AI-context, digest, timeline renderer, and the backup serializer) in the **same commit**. Remember the separate writers a schema migration never touches — `restore-apply` writes the table without running the migration, so it must consume the same map on ingest.
10. **Formatting-only edits to shipped migrations are still edits.** Migrations 006, 009, and 017 have already carried production data transformations; never include them in a broad `biome --write`, cleanup sweep, or style-only commit. Preserve their exact reviewed source and make any new behavior a later numbered step.

11. **A data move must also fix the backup path.** A migration that moves rows between tables leaves older backup files in the old shape. Bump the backup format and add a forward converter that applies the same rules, then add an equivalence test that runs one fixture table through both the migration and the converter and compares rows by uid (38.10: migration 033 and `convertV7ToV8`). Changing one mapping rule later means changing both, the shared module and that test.

12. **Allocate re-minted uids once, before any copy.** When rows from several sources land in one table, uid collisions are possible; allocate every destination uid up front with a collision-complete deterministic scheme (`legacy-<table>-<uid>`, `-2`, `-3` …) and convert tombstones to the allocated uid, or a later copy can collide with an earlier one.

13. **Scope the post-migration foreign-key check to your tables.** `PRAGMA foreign_key_check` with no argument fails on any pre-existing violation anywhere and would brick launch for that user; check only the tables the migration wrote (`PRAGMA foreign_key_check(<table>)`).

14. **Fail on what you cannot map; never guess.** A legacy value no writer can produce (e.g. a BLOB in a text column) should throw a typed integrity error that rolls the step back, not be coerced. Skipped rows (e.g. contentless ones) are counted in the result struct so tests can pin them.

15. **Prove a one-way migration on real older data before release.** Seed the old schema through the old app's own DAOs (a throwaway hook in a `git archive` copy of the pre-migration commit in the scratchpad, never in the repo; RN `Modal` pickers are not drivable by adb), take an automatic backup, then upgrade and query the database with `run-as` on a debug build. Restore the old backup by Merge and by Replace to prove the converter (38.10 plan 19).

16. **A shipped migration writes literals, not runtime constants.** Migration 034 writes the indefinite-snooze sentinel `'9999-12-31'` itself; a test pins it equal to `INDEFINITE_SNOOZE_UNTIL`. Importing the constant would silently change what a shipped migration writes if the constant ever changed.

17. **Widening a CHECK means a table rebuild.** SQLite cannot alter a CHECK constraint. Copy every column into a `_new` table, count and match the copy, then DROP and RENAME, and throw on a mismatch so the runner rolls the step back. Recreate only what the old table had: 034's `reconcile_source_snapshot` had no triggers or extra indexes, only inline UNIQUE auto-indexes, which the CREATE rebuilds.

18. **Legacy repair needs the owner.** With no installed base, data repair is an owner decision (38.2 D-23, 38.12 D-30); 034's mute conversion ran because the owner approved it (38.12 D-134).

## Smoke Test

```bash
npx vitest run src/db/migrations/runner.test.ts src/db/migrations/full-chain.test.ts src/db/migrations/034-snooze-review-memory-resume.test.ts src/db/migrations/033-knowledge-homes.test.ts src/backup/v7-v8-migration-equivalence.test.ts src/db/migrations/006-normalize-custom-field-values.test.ts src/db/migrations/017-knowledge-egress-datamove.test.ts src/db/migrations/018-custom-field-scope-history.test.ts src/db/migrations/profile-presentation.test.ts
```

Expected: the runner and full-chain suites reach the registered target, while representation conversion, verified data moves, and additive schema history checks pass.

```bash
npx tsc --noEmit && npx biome check src/db
```

Expected: TypeScript and database formatting checks complete without errors.
