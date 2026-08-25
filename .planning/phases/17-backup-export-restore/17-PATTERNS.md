# Phase 17: Backup, Export & Restore - Pattern Map

**Mapped:** 2026-08-25  
**Files classified:** 35 proposed create/modify targets  
**Analogs found:** 31 / 35

Phase 16 is present in source: `custom_field_values` is a durable UID-bearing row with nullable `value` and `UNIQUE(contact_id, field_def_id)`; this is not a dynamic-column export problem. The graph query documented in `CLAUDE.md` is not configured (`npm run graph:ask` has no script), so all mappings below are verified directly against source.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/db/migrations/007-tombstones.ts` | migration | transform | `src/db/migrations/006-normalize-custom-field-values.ts` | exact |
| `src/db/database.ts` | config | request-response | `src/db/database.ts` | exact |
| `src/db/tombstones-dao.ts` | model/DAO | CRUD | `src/db/field-values-dao.ts` | role-match |
| `src/db/{purge,field-ddl,fuel,contact-links,recency}-dao.ts` | DAO modifications | CRUD | same files' non-mutexed-core patterns | exact |
| `src/db/app-settings-dao.ts` | DAO modification | CRUD | `src/db/app-settings-dao.ts` | exact |
| `src/backup/types.ts` | model | transform | `src/db/types.ts` | role-match |
| `src/backup/backup-schema.ts` | model/validator | transform | `src/db/migrations/006-normalize-custom-field-values.ts` | partial |
| `src/backup/export-manifest.ts` | service | CRUD/transform | `src/db/app-settings-dao.ts` | role-match |
| `src/backup/reconciliation.ts` | utility | transform | `src/screens/settings-ai-logic.ts` | role-match |
| `src/backup/auto-backup-policy.ts` | utility | event-driven/transform | `src/services/launch-sweep.ts` | role-match |
| `src/backup/restore-apply.ts` | service | CRUD/transform | `src/db/recency-dao.ts` plus `src/db/transaction.ts` | exact composition |
| `src/services/backup/encryption.ts` | service | file-I/O/transform | `src/services/ai-key-store.ts` | partial |
| `src/services/backup/passphrase-store.ts` | service | request-response | `src/services/ai-key-store.ts` | exact |
| `src/services/backup/saf-storage.ts` | service | file-I/O | `src/services/photos/photo-storage.ts` | partial |
| `src/services/backup/backup-service.ts` | service | CRUD/file-I/O | `src/services/photos/photo-pipeline.ts` | role-match |
| `src/services/backup-sweep.ts` | service | event-driven | `src/services/field-sweep.ts` | exact |
| `App.tsx` | config/bootstrap modification | event-driven | `App.tsx` sweep registration | exact |
| `src/navigation/types.ts` | route config | request-response | `src/navigation/types.ts` | exact |
| `src/navigation/RootNavigator.tsx` | route config | request-response | `src/navigation/RootNavigator.tsx` | exact |
| `src/screens/BackupScreen.tsx` | component/screen | request-response | `src/screens/ArchivedContactsScreen.tsx` | role-match |
| `src/screens/BackupSettingsScreen.tsx` | component/screen | request-response | `src/screens/SettingsScreen.tsx` | exact |
| `src/screens/RestorePreviewScreen.tsx` | component/screen | request-response | `src/screens/ArchivedContactsScreen.tsx` | role-match |
| `src/screens/RestoreResultScreen.tsx` | component/screen | request-response | `src/screens/ArchivedContactsScreen.tsx` | role-match |
| `src/screens/backup-settings-logic.ts` | utility | transform | `src/screens/settings-ai-logic.ts` | exact |
| `src/screens/backup-health-logic.ts` | utility | transform | `src/screens/settings-ai-logic.ts` | role-match |
| `src/screens/HomeScreen.tsx` | component modification | request-response | `src/screens/HomeScreen.tsx` | exact |
| `package.json` | config | request-response | `package.json` | exact |
| `src/db/migrations/007-tombstones.test.ts` | test | transform | `src/db/migrations/006-normalize-custom-field-values.test.ts` | exact |
| `src/backup/{backup-schema,reconciliation,restore-apply,auto-backup-policy}.test.ts` | test | transform | `src/services/ai-key-store.test.ts` | role-match |
| `src/services/backup/{encryption,passphrase-store,saf-storage,backup-service}.test.ts` | test | file-I/O/transform | `src/services/ai-key-store.test.ts` | role-match |
| `src/screens/{backup-settings,backup-health}-logic.test.ts` | test | transform | `src/screens/settings-ai-logic.test.ts` | exact |
| existing DAO tests for deletion writers | test modification | CRUD | matching `*.test.ts` | exact |

## Pattern Assignments

### Migration, tombstones, and every delete writer

**Apply to:** `007-tombstones.ts`, `database.ts`, `tombstones-dao.ts`, `purge-dao.ts`, `field-ddl.ts`, `fuel-dao.ts`, `contact-links-dao.ts`, and `recency-dao.ts`.

**Migration analog:** `src/db/migrations/006-normalize-custom-field-values.ts`.

```ts
// src/db/migrations/006-normalize-custom-field-values.ts:218-246
export const migration006: Migration = {
  version: 6,
  async apply(exec: SqlExecutor, deps: MigrationDeps): Promise<void> {
    // validate first, then DDL/data writes through injected executor
    await exec.execAsync(CREATE_CUSTOM_FIELD_VALUES);
    ...
    await proveCopy(exec, contacts, defs, legacyRows);
  },
};
```

Copy its injected `SqlExecutor`/`MigrationDeps` imports (lines 11-12), its forward-only exported migration object, and its fail-loudly validation posture. Put migration 007 in `database.ts`'s explicit ordered list and change `TARGET_VERSION`; the current integration is at `src/db/database.ts:24-42,113-126`.

**Transaction/core analog:** `src/db/transaction.ts:42-56` and `src/db/events-dao.ts:55-92`.

```ts
export function inWriteTransaction<T>(exec: SqlExecutor, body: () => Promise<T>) {
  return withMutex(async () => {
    await exec.execAsync("BEGIN");
    try { const value = await body(); await exec.execAsync("COMMIT"); return value; }
    catch (error) { await exec.execAsync("ROLLBACK").catch(() => {}); throw error; }
  });
}

export async function recordEventCore(exec: SqlExecutor, input: RecordEventInput) {
  // non-mutexed composition primitive: all SQL values are ?-bound
}
```

`tombstones-dao.ts` should expose a non-mutexed insert/query core that callers use inside their existing outer transaction; it must not open a nested transaction. Capture child UID/type rows before each delete, write tombstones, then delete. The direct audit found all live hard-delete paths: individual interactions (`recency-dao.ts:308-327`), fuel (`fuel-dao.ts:225-272`), links (`contact-links-dao.ts:136-145`), permanent field definitions/values (`field-ddl.ts:101-145`), and contact purge fan-out (`purge-dao.ts:169-212`). `field_history` remains excluded: its only delete is retention cleanup (`field-sweep.ts:121-132`).

For the fan-out, preserve the current explicit, auditable ordering rather than relying on cascades:

```ts
// src/db/purge-dao.ts:174-207
return inWriteTransaction(exec, async () => {
  // read/capture mergeable UIDs first; then tombstone and delete each child
  await exec.runAsync("DELETE FROM interactions WHERE contact_id = ?", [contactId]);
  await exec.runAsync("DELETE FROM events WHERE contact_id = ?", [contactId]);
  await exec.runAsync("DELETE FROM fuel WHERE contact_id = ?", [contactId]);
  await exec.runAsync("DELETE FROM custom_field_values WHERE contact_id = ?", [contactId]);
  await exec.runAsync("DELETE FROM contact_links WHERE contact_id = ?", [contactId]);
  await exec.runAsync("DELETE FROM field_history WHERE contact_id = ?", [contactId]);
  const deleted = await exec.runAsync("DELETE FROM contacts WHERE id = ?", [contactId]);
  if (deleted.changes !== 1) throw new Error(...);
});
```

Do not tombstone quarantine or `field_history`. Permanent field deletion must keep its snapshot-before-delete sequence (`field-ddl.ts:107-124`) while inserting tombstones for both the definition and values.

### Export, validation, reconciliation, and transactional restore

**Apply to:** `src/backup/types.ts`, `backup-schema.ts`, `export-manifest.ts`, `reconciliation.ts`, and `restore-apply.ts`.

There is no existing backup subsystem. Keep the pure wire model, structural validation, payload migrations, winner policy, and apply plan in `src/backup/`; reserve native file/crypto/SAF calls for `src/services/backup/`.

**Schema/invariant analog:** `src/db/migrations/006-normalize-custom-field-values.ts:41-51,183-215`.

```ts
CREATE TABLE custom_field_values (
  id INTEGER PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_def_id INTEGER NOT NULL REFERENCES custom_field_defs(id) ON DELETE CASCADE,
  value TEXT,
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  UNIQUE(contact_id, field_def_id)
);
```

Validation should reject the entire wire object before preview/apply: unique UID per entity type; known parent UIDs; one normalized value per `(contactUid, fieldDefUid)`; nullable `value` retained as an explicit row; valid photo byte records; no `field_history`, API keys, passphrases, or serialized local paths. Use explicit `Error`/typed error classes and fail early as migration 006's `fail()` does at lines 69-83.

**Pure-policy analog:** `src/screens/settings-ai-logic.ts:68-92,126-146`. Put deterministic, dependency-injected decision logic in small exported pure functions; test it without native modules. `reconciliation.ts` should receive participating local/incoming rows plus policy, return actions/totals, compare `modified_at`, and make deletion win equal-second ties in exactly one place.

**Apply analog:** `src/db/transaction.ts:12-23` and `src/db/recency-dao.ts:395-408`. `restore-apply.ts` must acquire one outer `inWriteTransaction`; inside it call only non-mutexed cores, resolve parent UIDs to local IDs, apply parents before children, then call `recomputeLastContactCore` rather than merging `contacts.last_contact`. The core is exported specifically for composition at `recency-dao.ts:142-173,395-408`. After commit, trigger the existing schedule rebuilds (`notification-schedule.ts:489-525`, `digest-schedule.ts:189-200`), never serialize OS schedule IDs.

For photos, recreate content through the existing chokepoint, never trust source paths:

```ts
// src/services/photos/photo-storage.ts:141-193
export async function persistMaster(srcUri: string, relative: string): Promise<string> {
  assertSafeRelative(relative);
  // copy new bytes to .tmp; move prior master to .bak; move tmp into place
  ...
  return relative;
}
```

### Settings, passphrase storage, encryption, and SAF

**Apply to:** `app-settings-dao.ts`, `passphrase-store.ts`, `encryption.ts`, `saf-storage.ts`, `backup-service.ts`, `auto-backup-policy.ts`.

**Settings DAO analog:** `src/db/app-settings-dao.ts:185-229,305-395`.

```ts
export function updateAppSettings(exec, patch, now): Promise<void> {
  // validate every supplied value before opening the transaction
  ...
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `UPDATE app_settings SET ${setClauses.join(", ")} WHERE id = 1`, finalParams,
    );
    if (result.changes !== 1) throw new Error(...);
  });
}
```

Add only export-safe backup configuration/health metadata to the single row (folder URI/name, cadence/retention, last verified automatic success/change marker, encryption-enabled flag). Validate positive integer days before persistence; do not put cached passphrase, KDF material, or API keys in SQLite. Keep the select mapping and `COLUMN_OF` allowlist aligned with new fields.

**SecureStore analog:** `src/services/ai-key-store.ts:35-105`.

```ts
export interface SecureKeyBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}
// native backend dynamically imports expo-secure-store only at call time
```

Create a narrow backup-passphrase repository with injected backend and one namespaced item. It may expose get/set/delete only; missing/read failure maps to unconfigured `null`; no bulk secret export exists. Test it with the Map fake pattern in `ai-key-store.test.ts:19-104`.

**File I/O analog:** `src/services/photos/photo-storage.ts:134-193` and `photo-pipeline.ts:76-104`. Put all SAF/local temporary-file operations behind one adapter and make the service generate/verify bytes before declaring success. A verified automatic snapshot is a distinct new filename, then success metadata is written, then retention pruning runs; manual share never touches health or rotation. No strong code analog exists for Expo SAF, document picker, sharing, AES-GCM, or PBKDF2: follow the approved Phase 17 research APIs and keep those imports isolated here.

### Foreground automatic backup registration

**Apply to:** `src/services/backup-sweep.ts` and `App.tsx`.

**Analog:** `src/services/field-sweep.ts:76-100` and `src/services/launch-sweep.ts:41-115`.

```ts
export function registerFieldSweep(getExec: () => SqlExecutor, now = localNow): void {
  registerSweepHook(async () => {
    const exec = getExec();
    const stamp = now();
    ...
  });
}
```

The backup hook takes `getExecutor` lazily and performs all due/change/rotation decisions in a reusable service. Register it exactly once before `installSweepTrigger(AppState)`, following the module-level guards and ready-gated ordering in `App.tsx:73-97,129-204`. It must not run on import or in the headless notification/widget paths.

### Navigation and screens

**Apply to:** `navigation/types.ts`, `RootNavigator.tsx`, `BackupScreen.tsx`, `BackupSettingsScreen.tsx`, `RestorePreviewScreen.tsx`, `RestoreResultScreen.tsx`, `backup-*-logic.ts`, and `HomeScreen.tsx`.

**Route analog:** `src/navigation/types.ts:20-27,83-103` and `src/navigation/RootNavigator.tsx:53-76`. Add serializable additive routes `Backup`, `BackupSettings`, `RestorePreview`, and `RestoreResult`; use a result summary parameter only after commit, not callbacks, files, or passphrases. Register screens with the existing `headerShown: false` stack.

**Screen/focus/error analog:** `src/screens/ArchivedContactsScreen.tsx:89-105,173-257` and `src/screens/SettingsScreen.tsx:289-296,348-370`. New screens use `useTheme()`, a `ScrollView` with `colors.background`, themed `surface`/`border` cards, explicit 44px `Pressable` controls, stable `testID`s/accessibility labels, focus reload with cancellation, `Logger.error`, and calm native `Alert` confirmations. Keep view-only decision code in node-tested `backup-*-logic.ts`, like `settings-ai-logic.ts:68-92`.

**Dashboard entry analog:** `src/screens/HomeScreen.tsx:483-541`. Add the temporary Backup entry beside the existing Orrery/Settings controls; do not introduce the deferred bottom navigation. The optional nudge must be derived from health/meaningful-data logic, dismissible until the health condition changes, and never a permanent dashboard card.

## Shared Patterns

### Database safety

**Sources:** `src/db/transaction.ts:12-56`; `src/db/types.ts:17-48`.

- Bind every SQL value with `?`; only closed, source-defined SQL identifiers may be interpolated.
- Validate all untrusted restore data before opening the outer write transaction.
- Never nest `inWriteTransaction`; use exported non-mutexed cores for restore and tombstone composition.

### Deletion and derived state

**Sources:** `src/db/purge-dao.ts:169-225`; `src/db/recency-dao.ts:142-173`.

- Tombstone inside the same transaction before every mergeable hard deletion; preserve `field_history` as an excluded transient audit trail.
- Do not merge `last_contact`; recompute it from current interactions after restore.
- Perform filesystem/notification side effects after commit, with isolated logging, never while the database transaction is open.

### Secrets and logging

**Sources:** `src/services/ai-key-store.ts:1-16,61-105`; `src/utils/logger.ts`.

- SecureStore cache is narrow and lazily native-loaded; it is never in `app_settings`, export models, route params, user-facing results, or logs.
- Translate crypto/SAF/parse details to the UI contract's calm messages and log the technical cause privately.

### Theme and navigation

**Sources:** `src/navigation/RootNavigator.tsx:24-30`; `src/screens/HomeScreen.tsx:478-541`.

- Use `useTheme().colors.*`, no colour literals; screens own their Back chrome because stack headers are disabled.
- Keep routes additive and params serializable.

## No Analog Found

| File / concern | Reason and planner direction |
|---|---|
| `src/services/backup/encryption.ts` AES-256-GCM/PBKDF2 envelope | No encrypted-file implementation exists. Use the Phase 17 research's native RNQC gate, versioned envelope, authenticated metadata, random salt/nonce, and device benchmark checkpoint. |
| `src/services/backup/saf-storage.ts` SAF directory/open-folder adapter | No SAF adapter exists. Isolate legacy Expo FileSystem SAF calls; model provider-loss as an error/state, not a successful backup. |
| `src/services/backup/backup-service.ts` manual share/picker bridge | No share-sheet or document-picker analogue exists. Keep platform UI boundary in this service and return typed results to screens. |
| backup wire-format forward migrations | No versioned app-file format exists. Implement strict, pure forward-migration/compatibility functions in `src/backup/backup-schema.ts`. |

## Metadata

**Analog search scope:** `App.tsx`, `src/db`, `src/services`, `src/navigation`, `src/screens`, `src/logic`, and package manifest.  
**Files scanned:** 70+ source/test files through direct file and SQL-writer search.  
**Pattern extraction date:** 2026-08-25.
