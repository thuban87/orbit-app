# Workpaper 01-data — Platform constraints: Expo + expo-sqlite

**Prepared:** 2026-08-11
**Scope:** Verify the platform assumptions underneath `HANDOFF.md` §3 (data layer) and §14 (custom fields).
**Method:** Current official docs (`docs.expo.dev`, `sqlite.org`, `developer.android.com`), the npm registry, **and direct inspection of the published `expo-sqlite` npm artifact**. Where a claim was testable, it was verified by compiling the *exact vendored SQLite amalgamation shipped in the package* and running it. Empirical results are labelled **[MEASURED]**; doc claims are labelled **[DOC]**; artifact inspection is **[SOURCE]**.

> **On evidence strength.** Several claims below contradict what secondary sources (and older GitHub issues) say. Where that happens, the artifact inspection wins: `vendor/sqlite3/sqlite3.c` inside the tarball that `npm install` actually places on disk is the ground truth for what runs on the device.

---

## 0. Summary of findings that change or constrain a decision

| # | Finding | Effect on `HANDOFF.md` |
|---|---|---|
| **F1** | `PRAGMA foreign_keys` defaults to **OFF**, is **per-connection**, and is a **silent no-op inside a transaction**. `expo-sqlite` never sets it. | `ON DELETE CASCADE` **does nothing** unless explicitly enabled on every connection. §14.1's `contact_custom_values.contact_id` cascade is inert by default. |
| **F2** | `withExclusiveTransactionAsync` opens a **brand-new connection** and issues `BEGIN` before handing control to your callback. There is no hook to set a PRAGMA on that connection first. | Foreign keys are **unconditionally OFF** inside every exclusive transaction. Combined with F1, the §14.5 sweep cannot rely on cascade at all — which is fine, because §14.5 already says to do both statements explicitly. Enforces that decision; does not reverse it. |
| **F3** | Column names **cannot** be bound as SQL parameters. Naive double-quoting of a user-supplied label into `execAsync` **is not sufficient** — a crafted label drops the table. Demonstrated. | §14.9's "salvage `keyToLabel()` for deriving `col_name` from a user-entered label" is a live SQL-injection surface. `col_name` must be generated under a strict whitelist, never derived permissively from the label. **Owner decision — security posture.** |
| **F4** | The migration pattern in Expo's own docs is **not wrapped in a transaction** and writes `user_version` **outside** any transaction. | `HANDOFF.md` §3 says "expo-sqlite ships a helper for this." It does not ship a helper — it ships a **documented example**, and that example is not crash-safe. Correction needed to §3 wording, plus a project decision to wrap. |
| **F5** | `withTransactionAsync` uses plain `BEGIN` (DEFERRED) on the **shared** connection, and its `catch` block issues an unconditional `ROLLBACK` that itself throws `cannot rollback - no transaction is active`, **masking the original error**. | Do not use `withTransactionAsync` for §14 DDL. Use `withExclusiveTransactionAsync`, and never let the original error be swallowed. |
| **F6** | Both Android and iOS compile the **same vendored SQLite 3.50.3** amalgamation, with every symbol renamed `exsqlite3_*` so it cannot link against the OS library. | §14's dependence on `ADD/RENAME/DROP COLUMN` is **safe on every supported device**, independent of Android version. The historical "Android uses the OS SQLite" hazard is gone. Confirms §14; removes a risk. |
| **F7** | The Expo template ships `android:allowBackup="false"`. | Android Auto Backup would otherwise copy the database to the user's Google Drive — directly contradicting "contact data never leaves the device." This default is **load-bearing for the product promise** and must be preserved. Worth recording as a decision. |
| **F8** | `'localtime'` is compiled in and correct, including historical DST. But `date('now')` is UTC. | Confirms the `formatLocalDate()` convention and extends it: the same off-by-one exists **in SQL**, not just in JS. Any status query must use `date('now','localtime')`. |

---

## 1. Versions

### 1.1 Expo SDK

| Item | Value | Source |
|---|---|---|
| Current Expo SDK | **57** | [expo.dev/changelog/sdk-57](https://expo.dev/changelog/sdk-57) — "June 30, 2026" **[DOC]** |
| `expo` npm `latest` | **57.0.12** | `registry.npmjs.org/expo` dist-tags **[SOURCE]** |
| React Native | **0.86** | changelog: "SDK 57 upgrades React Native from 0.85 to 0.86." **[DOC]** |
| React | 19.2 (unchanged from SDK 56) | Expo changelog **[DOC]** |

`expo` dist-tags at time of writing: `sdk-52: 52.0.49`, `sdk-53: 53.0.27`, `sdk-54: 54.0.36`, `sdk-55: 55.0.28`, `sdk-56: 56.0.19`, `latest/next: 57.0.12`, `canary: 58.0.0-canary-20260806`.

### 1.2 expo-sqlite

| Item | Value | Source |
|---|---|---|
| `expo-sqlite` npm `latest` | **57.0.1** (published 2026-07-15) | `registry.npmjs.org/expo-sqlite` **[SOURCE]** |
| Bundled SQLite | **3.50.3** | `vendor/sqlite3/sqlite3.h:149` → `#define SQLITE_VERSION "3.50.3"` **[SOURCE]** |
| Source ID | `2025-07-17 13:25:10 3ce993b8657d6d9deda380a93cdd6404a8c8ba1b185b2bc423703e41ae5f2543` | `SELECT sqlite_source_id()` on the compiled amalgamation **[MEASURED]** |
| Bundled SQLCipher variant | 3.49.1 / SQLCipher 4.7.0 (opt-in only) | `vendor/sqlcipher/sqlite3.h:149`; CHANGELOG 16.0.0 **[SOURCE]** |

`expo-sqlite` version numbers were realigned to the SDK number at SDK 55; before that they ran independently (`sdk-50: 13.3.0`, `sdk-51: 14.0.3`). The SQLite bump to 3.50.3 landed in **expo-sqlite 16.0.0 — 2025-08-13** ("Updated SQLite to 3.50.3", [PR #38200](https://github.com/expo/expo/pull/38200)) and is still 3.50.3 in 57.0.1 **[SOURCE]**.

Verbatim, from the CHANGELOG shipped in the package:

```
## 57.0.1 — 2026-07-15
_This version does not introduce any user-facing changes._

## 57.0.0 — 2026-06-25
_This version does not introduce any user-facing changes._
```

---

## 2. The API — legacy is gone, not deprecated

**The `openDatabase` / transaction-callback API does not exist in expo-sqlite 57.** It is not deprecated; it has been deleted. Verified by exhaustive grep of the published tarball's `src/` — zero occurrences of `openDatabase` (the only matches are `openDatabaseAsync` / `openDatabaseSync`) **[SOURCE]**.

Removal timeline, from the package CHANGELOG **[SOURCE]**:

| Release | Entry |
|---|---|
| **14.0.0** | "Moved the previous default export as `expo-sqlite/legacy` and promoted `expo-sqlite/next` as the default." ([#28278](https://github.com/expo/expo/pull/28278)) — SDK 51 |
| **15.0.0 — 2024-10-22** | "**Removed deprecated legacy expo-sqlite.**" ([#31766](https://github.com/expo/expo/pull/31766)) — SDK 52 |
| **15.0.0 — 2024-10-22** | "Removed `next` export." ([#32184](https://github.com/expo/expo/pull/32184)) |

So the API has been stable for five SDKs (52→57). There is nothing pending. **The current API is the only API.**

### 2.1 The current surface

From `src/index.ts` **[SOURCE]**:

```ts
export * from './SQLiteDatabase';
export * from './SQLiteSession';
export * from './SQLiteStatement';
export * from './SQLiteTaggedQuery';
export * from './hooks';
```

Top-level functions (`src/SQLiteDatabase.ts`): `openDatabaseAsync`, `openDatabaseSync`, `deserializeDatabaseAsync/Sync`, `deleteDatabaseAsync/Sync`, `backupDatabaseAsync/Sync`, `addDatabaseChangeListener`, `defaultDatabaseDirectory`, `bundledExtensions`.

`SQLiteDatabase` methods (async forms; sync twins exist for all): `execAsync`, `runAsync`, `getFirstAsync`, `getAllAsync`, `getEachAsync`, `prepareAsync`, `withTransactionAsync`, `withExclusiveTransactionAsync`, `closeAsync`, `serializeAsync`, `createSessionAsync`, `loadExtensionAsync`, `isInTransactionAsync`.

Hooks (`src/hooks.tsx`): `SQLiteProvider`, `useSQLiteContext`.

### 2.2 `execAsync` — the escaping warning is in the source

Verbatim doc comment on `execAsync` **[SOURCE]** (`src/SQLiteDatabase.ts:51-57`):

```ts
  /**
   * Execute all SQL queries in the supplied string.
   * > Note: The queries are not escaped for you! Be careful when constructing your queries.
   *
   * @param source A string containing all the SQL queries.
   */
  public execAsync(source: string): Promise<void> {
```

Two properties matter for §14: it takes **no parameters** (no binding), and it executes **all statements** in the string. Both feed finding **F3** (§9 below).

`runAsync` / `getFirstAsync` / `getAllAsync` take `...params: any[]` and do bind. Use them for everything except DDL.

---

## 3. Migrations

### 3.1 There is no `user_version` helper — there is a documented example

`HANDOFF.md` §3 states: *"`expo-sqlite` ships a helper for this."* **This is not accurate and should be corrected.** There is no exported migration function, no version-map runner, no `migrate()`. What exists is:

- `SQLiteProvider`'s `onInit?: (db: SQLiteDatabase) => Promise<void>` prop — a generic escape hatch, documented as *"A custom initialization handler to run before rendering the children. You can use this to run database migrations or other setup tasks."* **[SOURCE]** (`src/hooks.tsx`)
- A worked example named `migrateDbIfNeeded` in the docs — **your code, not library code**.

`PRAGMA user_version` itself is plain SQLite and works fine. The pattern is right; the "ships a helper" wording is wrong.

### 3.2 The documented pattern, verbatim

From [docs.expo.dev/versions/latest/sdk/sqlite/](https://docs.expo.dev/versions/latest/sdk/sqlite/) **[DOC]**:

```typescript
async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 1;
  let { user_version: currentDbVersion } = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }
  if (currentDbVersion === 0) {
    await db.execAsync(`
PRAGMA journal_mode = 'wal';
CREATE TABLE todos (id INTEGER PRIMARY KEY NOT NULL, value TEXT NOT NULL, intValue INTEGER);
`);
    await db.runAsync('INSERT INTO todos (value, intValue) VALUES (?, ?)', 'hello', 1);
    await db.runAsync('INSERT INTO todos (value, intValue) VALUES (?, ?)', 'world', 2);
    currentDbVersion = 1;
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
```

Wired up as `<SQLiteProvider databaseName="test.db" onInit={migrateDbIfNeeded}>`.

### 3.3 Is it forward-only? Yes — by omission

The pattern is forward-only in the sense that matters: there is **no down-migration concept anywhere** in expo-sqlite, and the early-return `if (currentDbVersion >= DATABASE_VERSION) return;` means a database from a *newer* app version is silently accepted and used as-is. That is a real hazard (Android allows downgrade via sideload/`adb install -d`, and Play's staged rollbacks). The documented example does not guard it. Recommend throwing on `currentDbVersion > DATABASE_VERSION` rather than returning.

The chained `if (currentDbVersion === 0) { … currentDbVersion = 1 }` shape is what makes v1→v6 jumps work, matching `CLAUDE.md`'s "any user may jump from v1 to v6 in one update." Each step must be a separate `if`, and each must set `currentDbVersion` so the next one runs. Do not use `else if`.

### 3.4 What happens if a migration throws mid-way — **the documented pattern leaves the DB partially migrated**

This is the important gap. In the example above:

1. Each `execAsync` / `runAsync` runs in **autocommit mode** — SQLite wraps each statement in its own implicit transaction.
2. If step 3 of a 5-step migration throws, steps 1–2 are **already committed**.
3. `PRAGMA user_version` is written **last and outside any transaction**, so it is *not* updated.
4. Next launch: `user_version` still says 0, so the migration **re-runs from the top** — against a database that already has half of it applied. `CREATE TABLE` fails with "table already exists", and the app is now permanently wedged with no remote repair path.

Given `CLAUDE.md` — *"There is no remote access to a user's database… Anything a migration gets wrong is permanent for that user"* — the documented pattern is **not sufficient for this project as written**.

### 3.5 Guidance on wrapping migrations in transactions

**There is no documented Expo guidance on this.** The docs neither recommend nor discourage wrapping; the example simply does not. **[Could not verify — no such guidance exists to cite.]**

What *is* verifiable is that wrapping works, because SQLite DDL is transactional — see §4. The correct shape for this project (a project decision, not a library one):

```ts
// Each version step: DDL + DML + the user_version write, in ONE transaction.
await db.withExclusiveTransactionAsync(async (txn) => {
  await txn.execAsync(`CREATE TABLE …`);
  await txn.runAsync(`INSERT …`, …);
  await txn.execAsync(`PRAGMA user_version = 2`);
});
```

Two caveats on that shape, both verified:

- `PRAGMA journal_mode = 'wal'` **cannot** go inside a transaction (it is a no-op / error there). Set it on the connection before any migration runs. The docs' example puts it inside `execAsync` in the v0 branch, which happens to work only because that branch is in autocommit.
- `PRAGMA foreign_keys` also cannot be changed inside a transaction (§5.1). Set it before.

---

## 4. ALTER TABLE support at runtime — §14 is safe

### 4.1 Version requirements

| Form | Requires | Source |
|---|---|---|
| `ADD COLUMN` | all versions | [sqlite.org/lang_altertable.html](https://sqlite.org/lang_altertable.html) **[DOC]** |
| `RENAME COLUMN` | **3.25.0** (2018-09-15) | [releaselog/3_25_0.html](https://sqlite.org/releaselog/3_25_0.html) — "Add support for renaming columns within a table using ALTER TABLE _table_ RENAME COLUMN _oldname_ TO _newname_." **[DOC]** |
| `DROP COLUMN` | **3.35.0** (2021-03-12) | [releaselog/3_35_0.html](https://sqlite.org/releaselog/3_35_0.html) — "Added support for [ALTER TABLE DROP COLUMN]." **[DOC]** |

Bundled version is **3.50.3**, which clears 3.35.0 by fifteen minor releases.

### 4.2 Does expo-sqlite bundle its own SQLite? **Yes — and this is the critical answer**

This was the highest-risk question in the assignment, because an OS-provided SQLite would vary by Android version and could break `DROP COLUMN` on older devices. It does not apply. Evidence, in order of strength:

**(a) The amalgamation ships inside the npm tarball [SOURCE].** `package/vendor/sqlite3/sqlite3.c` is 9,306,729 bytes; its header comment reads:

```
** This file is an amalgamation of many separate C source files from SQLite
** version 3.50.3.
```

**(b) Android compiles it [SOURCE].** `android/build.gradle:21`:

```groovy
def SQLITE3_SRC_DIR = new File("${projectDir}/../vendor/sqlite3")
```

passed to CMake at line 65 as `-DSQLITE3_SRC_DIR=…`, and `android/CMakeLists.txt` adds it to the library target:

```cmake
  add_library(
    ${PACKAGE_NAME}
    SHARED
    ${SOURCES}
    "${SQLITE3_SRC_DIR}/sqlite3.c"
  )
```

**(c) iOS compiles the identical file [SOURCE].** `ios/ExpoSQLite.podspec` copies `vendor/sqlite3/sqlite3.c` into `ios/` at pod-install time (`vendor_sqlite_src!`) and compiles it via `s.source_files = "**/*.{c,h,m,swift}"`. **Both platforms therefore run byte-identical SQLite 3.50.3.**

**(d) Every symbol is renamed so it *cannot* link against the OS library [MEASURED].** Compiling the vendored amalgamation and listing its symbols gives `exsqlite3_open`, `exsqlite3_exec`, `exsqlite3_libversion` — not `sqlite3_*`. The native bindings call them explicitly (`android/src/main/cpp/NativeDatabaseBinding.cpp:52`: `return ::exsqlite3_changes(db);`). This prefix exists precisely to prevent collision with Android's system `libsqlite.so`. It is structurally impossible for expo-sqlite 57 to fall through to the OS SQLite.

**(e) The historical hazard is closed.** [expo/expo#23970](https://github.com/expo/expo/issues/23970) — "expo-sqlite has inconsistent SQLite versions across iOS and Android," describing exactly the "Android uses the version bundled with Android" problem — is **closed**, resolved by [PR #23993](https://github.com/expo/expo/pull/23993) **[DOC]**. Treat any secondary source still describing Android as using the OS SQLite as stale.

**Consequence:** the minimum Android API level is **irrelevant to SQLite feature availability**. Reported for completeness only: `expo-modules-core` 57.0.10 falls back to `minSdkVersion 24` (Android 7.0), `compileSdkVersion 36`, `targetSdkVersion 36` (`android/ExpoModulesCorePlugin.gradle:65-69`, and `expo-module-gradle-plugin/…/ProjectConfiguration.kt:72-77`) **[SOURCE]**. These are *fallbacks* read from the root project's `ext`; the effective app value comes from the generated `android/build.gradle`. **[Partially verified — I confirmed the library-level fallback of 24 but could not locate an official Expo doc page stating the app-template default; `expo-build-properties` documents the override knobs without publishing defaults.]**

### 4.3 Verified at runtime [MEASURED]

Compiled `vendor/sqlite3/sqlite3.c` with Expo's own Android build flags and ran:

```
[OK ] ALTER TABLE vals ADD COLUMN pets TEXT
[OK ] ALTER TABLE vals RENAME COLUMN pets TO animals
[OK ] ALTER TABLE vals DROP COLUMN animals
```

All three §14 operations work. Confirmed.

### 4.4 `DROP COLUMN` failure conditions — §14.11 confirmed

Docs list the conditions **[DOC]**: *"The DROP COLUMN command only works if the column is not referenced by any other parts of the schema and is not a PRIMARY KEY and does not have a UNIQUE constraint."* Specifically it fails if the column is a PRIMARY KEY or part of one; has a UNIQUE constraint; **is indexed**; is named in a partial index's WHERE clause; is named in an unrelated CHECK constraint; is used in a foreign key constraint; is used in a generated column's expression; or appears in a trigger or view.

Reproduced **[MEASURED]**:

```
[OK ] ALTER TABLE vals ADD COLUMN pets TEXT
[OK ] CREATE INDEX ix ON vals(pets)
[ERR] ALTER TABLE vals DROP COLUMN pets -> error in index ix after drop column: no such column: pets
[OK ] DROP INDEX ix
[OK ] ALTER TABLE vals DROP COLUMN pets
```

This is exactly the `CLAUDE.md` invariant *"Never add an index or a UNIQUE constraint to a column in `contact_custom_values`… If an index ever becomes necessary, drop it before dropping the column."* **Verified true on the shipping build.** Note the failure is a *runtime error at drop time*, not at index-creation time — so an accidentally-added index is a latent bug that only detonates during quarantine expiry, at launch, in a transaction. Cheap mitigation: assert `contact_custom_values` has no indexes as part of the launch sweep.

Also relevant to §14.1, `ADD COLUMN` restrictions **[DOC]**: a newly added column cannot have PRIMARY KEY or UNIQUE, cannot default to `CURRENT_TIME`/`CURRENT_DATE`/`CURRENT_TIMESTAMP` or a parenthesized expression, and cannot be `GENERATED ALWAYS … STORED`. None of these bind — §14.2 declares every column plain `TEXT` with no constraints. The design is already inside the safe envelope.

---

## 5. Transaction semantics

### 5.1 DDL + DML in one transaction — **atomic. §14.5 is sound.** [MEASURED]

`sqlite.org/features.html` does **not** list "Transactional DDL" as a named feature — it only states *"Transactions are atomic, consistent, isolated, and durable (ACID) even after system crashes and power failures."* Rather than rely on that inference, the §14.5 sequence was executed directly against the vendored 3.50.3:

```
[OK ] BEGIN
[OK ] DELETE FROM defs WHERE id=1
[OK ] ALTER TABLE vals DROP COLUMN pets
[OK ] ROLLBACK
  after rollback -- did the column come back?
    defs_rows = 1              <- the DELETE was undone
    pets_col_present = 1       <- the DROP COLUMN was undone

[OK ] BEGIN
[OK ] DELETE FROM defs WHERE id=1
[OK ] ALTER TABLE vals DROP COLUMN pets
[OK ] COMMIT
    pets_col_present = 0       <- both applied together
```

**`ALTER TABLE … DROP COLUMN` fully participates in the transaction and rolls back cleanly.** `HANDOFF.md` §14.5's *"Both succeed or neither does — no orphaned columns, no orphaned definitions"* is **verified correct**. Same applies to §14.6's `field_history` snapshot-in-the-same-transaction requirement.

### 5.2 `ON DELETE CASCADE` does not drop columns — §14.5 confirmed [MEASURED]

Explicitly tested, since §14.5 asserts it:

```
  [OK ] DELETE FROM contacts WHERE id=1
    ccv_rows_left = 0             <- rows cascaded
    pets_col_still_there = 1      <- the COLUMN survived
```

Confirmed: cascade deletes rows, never columns. Both statements must appear explicitly, as §14.5 says.

### 5.3 `PRAGMA foreign_keys` — OFF by default, per-connection, no-op in a transaction

**[DOC]** [sqlite.org/foreignkeys.html](https://sqlite.org/foreignkeys.html): *"Foreign key constraints are disabled by default (for backwards compatibility), so must be enabled separately for each database connection."* And: *"It is not possible to enable or disable foreign key constraints in the middle of a multi-statement transaction (when SQLite is not in autocommit mode). Attempting to do so does not return an error; it simply has no effect."*

**[SOURCE]** Exhaustive grep of the published package — `src/`, `android/src/`, `ios/`, `android/build.gradle`, `ios/ExpoSQLite.podspec`, `android/CMakeLists.txt` — finds **zero** occurrences of `foreign_key`. `SQLITE_DEFAULT_FOREIGN_KEYS` is **not** in the build flags. expo-sqlite never enables it for you.

**[MEASURED]** On a fresh connection: `PRAGMA foreign_keys = 0`. And the silent no-op:

```
  [OK ] PRAGMA foreign_keys = ON
    foreign_keys = 1
  [OK ] BEGIN
  [OK ] PRAGMA foreign_keys = OFF      <- returns OK
    foreign_keys = 1                   <- but had no effect
  [OK ] COMMIT
```

**This is finding F1.** Any `ON DELETE CASCADE` in the schema is decorative until `PRAGMA foreign_keys = ON` runs on that connection, before any transaction opens. Put it in `SQLiteProvider.onInit`, first line, before migrations.

### 5.4 `withTransactionAsync` vs `withExclusiveTransactionAsync`

**[DOC]** on `withTransactionAsync`: *"Due to the nature of async/await, any query that runs while the transaction is active will be included in the transaction. This includes query statements that are outside of the scope function passed to `withTransactionAsync()` and may be surprising behavior."*

**[DOC]** on `withExclusiveTransactionAsync`: *"Only queries that run within the scope function passed to `withExclusiveTransactionAsync()` will run within the actual SQL transaction."*

**[SOURCE]** The implementations (`src/SQLiteDatabase.ts:140-195`):

```ts
  public async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    try {
      await this.execAsync('BEGIN');
      await task();
      await this.execAsync('COMMIT');
    } catch (e) {
      await this.execAsync('ROLLBACK');
      throw e;
    }
  }
```

```ts
  public async withExclusiveTransactionAsync(
    task: (txn: Transaction) => Promise<void>
  ): Promise<void> {
    if (Platform.OS === 'web') {
      throw new Error('withExclusiveTransactionAsync is not supported on web');
    }
    const transaction = await Transaction.createAsync(this);
    let error;
    try {
      await transaction.execAsync('BEGIN');
      await task(transaction);
      await transaction.execAsync('COMMIT');
    } catch (e) {
      await transaction.execAsync('ROLLBACK');
      error = e;
    } finally {
      await transaction.closeAsync();
    }
    if (error) {
      throw error;
    }
  }
```

And `Transaction` (`src/SQLiteDatabase.ts:787-799`):

```ts
class Transaction extends SQLiteDatabase {
  public static async createAsync(db: SQLiteDatabase): Promise<Transaction> {
    const options = { ...db.options, useNewConnection: true };
    …
  }
}
```

Three consequences, all decision-relevant:

1. **`withExclusiveTransactionAsync` opens a new connection** (`useNewConnection: true`). PRAGMA state does not inherit. **[MEASURED]** — a second connection to the same file reports `foreign_keys = 0` even after the first enabled it. And because `BEGIN` is issued by the library *before* your callback runs, **there is no point at which you can set `PRAGMA foreign_keys = ON` on that connection.** This is finding **F2**. Practical rule: never depend on FK enforcement inside an exclusive transaction; write the cascade explicitly, which §14.5 already mandates.

2. **Both use plain `BEGIN` (DEFERRED).** **[DOC]** [sqlite.org/lang_transaction.html](https://sqlite.org/lang_transaction.html): *"The default transaction behavior is DEFERRED. DEFERRED means that the transaction does not actually start until the database is first accessed."* A deferred transaction that starts by reading and later writes can fail with `SQLITE_BUSY` on upgrade rather than waiting. For the §14.5 sweep (read defs, then write), consider issuing `BEGIN IMMEDIATE` yourself instead of using the wrapper, or accept the retry.

3. **The `catch` block masks the original error.** **[MEASURED]** — `ROLLBACK` with no active transaction raises `cannot rollback - no transaction is active`. In `withTransactionAsync`, if `BEGIN` itself fails (e.g. already in a transaction), the `catch` runs `ROLLBACK`, which throws a *second* error from inside the catch block, and the original `e` is never rethrown. This is finding **F5**. Wrap your own try/catch and log the real cause.

### 5.5 Nested transactions — not supported

**[DOC]**: *"Transactions created using BEGIN...COMMIT do not nest. For nested transactions, use the SAVEPOINT and RELEASE commands."* and *"An attempt to invoke the BEGIN command within a transaction will fail with an error, regardless of whether the transaction was started by SAVEPOINT or a prior BEGIN."*

**[MEASURED]**:
```
  [OK ] BEGIN
  [ERR] BEGIN -> cannot start a transaction within a transaction
```

expo-sqlite provides no nesting help and does not use SAVEPOINT internally. A DAO that opens a transaction and calls another DAO that also opens one **will throw**. Since `CLAUDE.md` mandates all queries go through DAOs in `src/db/`, this is a realistic footgun: adopt a convention where transaction-opening functions are named distinctly (e.g. `…Tx`) and take a `txn` parameter rather than opening their own.

### 5.6 Cross-connection DDL under WAL [MEASURED]

Since `withExclusiveTransactionAsync` uses a second connection, this was tested directly on a WAL file database:

- Connection B can `ALTER TABLE … DROP COLUMN` while connection A is merely open. Connection A then sees the new schema **without reopening** — SQLite recompiles prepared statements on schema change. No stale-schema hazard.
- B's DDL succeeds even while A holds an open **read** transaction.
- B's DDL fails with `database is locked` while A holds an open **write** transaction — and, per §5.4(3), the subsequent `ROLLBACK` then errors too, masking the `database is locked` cause.

For a solo-user app the write contention is unlikely, but the launch-time sweep (§14.5) runs concurrently with dashboard reads, so it is not zero. Make the sweep tolerate `SQLITE_BUSY` and retry.

---

## 6. Date and time storage

### 6.1 What SQLite recommends

**[DOC]** [sqlite.org/datatype3.html](https://sqlite.org/datatype3.html) §2.2, verbatim:

> "SQLite does not have a storage class set aside for storing dates and/or times. Instead, the built-in Date And Time Functions of SQLite are capable of storing dates and times as TEXT, REAL, or INTEGER values:
>
> - **TEXT** as ISO8601 strings ("YYYY-MM-DD HH:MM:SS.SSS").
> - **REAL** as Julian day numbers, the number of days since noon in Greenwich on November 24, 4714 B.C. according to the proleptic Gregorian calendar.
> - **INTEGER** as Unix Time, the number of seconds since 1970-01-01 00:00:00 UTC."

SQLite expresses **no preference**. All three are first-class and interconvertible. REAL/julian is the least useful here (floating-point, awkward to read in a debugger, no advantage).

### 6.2 Functions available

**[DOC]** [sqlite.org/lang_datefunc.html](https://sqlite.org/lang_datefunc.html): `date()`, `time()`, `datetime()`, `julianday()`, `unixepoch()`, `strftime()`, `timediff()`. All present in 3.50.3 and verified working **[MEASURED]**.

### 6.3 The `'localtime'` modifier

**[DOC]**, verbatim:

> "The 'localtime' modifier assumes the time-value to its left is in Universal Coordinated Time (UTC) and adjusts that time value so that it is in localtime."
>
> "The 'utc' modifier is the opposite of 'localtime'. 'utc' assumes that the time-value to its left is in the local timezone and adjusts that time-value to be in UTC."
>
> "If 'localtime' follows a time that is not UTC, then the behavior is undefined. If the time to the left is not in localtime, then the result of 'utc' is undefined."
>
> "The computation of local time depends heavily on the whim of politicians and is thus difficult to get correct for all locales. In this implementation, the standard C library function localtime_r() is used to assist in the calculation of local time."

### 6.4 Is `'localtime'` reliable on Android via expo-sqlite? **Yes.**

**[SOURCE]** `SQLITE_OMIT_LOCALTIME` is **not** among Expo's build flags on either platform (`android/build.gradle:26-41`, `ios/ExpoSQLite.podspec`). The full Expo Android flag set is:

```
-DSQLITE_ENABLE_BYTECODE_VTAB=1 -DSQLITE_TEMP_STORE=2
-DSQLITE_ENABLE_SESSION=1 -DSQLITE_ENABLE_PREUPDATE_HOOK=1
-DSQLITE_ENABLE_MATH_FUNCTIONS=1
-DSQLITE_ENABLE_FTS4=1 -DSQLITE_ENABLE_FTS3_PARENTHESIS=1 -DSQLITE_ENABLE_FTS5=1
```

So `localtime` is compiled in. **[SOURCE]** The implementation (`osLocaltime`, amalgamation line ~25269) uses `localtime_r()` when `HAVE_LOCALTIME_R` is set and otherwise falls back to a mutex-guarded `localtime()` — **both paths are correct**, differing only in thread-safety strategy. Android's bionic provides `localtime_r` and reads the system tzdata, so the app process picks up the device's timezone.

**[MEASURED]** with `TZ=America/New_York`, including historical DST:

```
  SELECT datetime('2026-01-15 12:00','localtime')  ->  2026-01-15 07:00:00   (EST, UTC-5)
  SELECT datetime('2026-07-15 12:00','localtime')  ->  2026-07-15 08:00:00   (EDT, UTC-4)
```

Correct on both sides of the DST boundary — it is consulting the tz database, not applying a fixed offset.

**Caveat I could not fully close:** these measurements were taken on the Linux host using glibc, not on an Android device using bionic. The *code path* is identical and bionic's `localtime_r` is tzdata-backed, so I have high confidence, but this is **not device-verified**. **[Not verified on-device — recommend a one-line probe on the Pixel 6 Pro before relying on it in status calculation:** `SELECT date('now'), date('now','localtime')` at an evening hour.**]**

### 6.5 The off-by-one — it exists in SQL too

`CLAUDE.md` warns about `toISOString().split('T')[0]` producing a UTC off-by-one in evening hours. **The identical bug exists in SQL**, and is easier to write by accident because `date('now')` looks like it means "today."

**[MEASURED]**, at the instant 2026-08-11 23:30 local New York (= 2026-08-12 03:30 UTC):

```
  datetime('2026-08-12 03:30','localtime')  ->  2026-08-11 23:30:00   (the user's clock)
  date('2026-08-12 03:30')                  ->  2026-08-12   <- WRONG: tomorrow
  date('2026-08-12 03:30','localtime')      ->  2026-08-11   <- correct
```

**`date('now')` is UTC.** Every status/decay query that compares against "today" must use `date('now','localtime')` (or `strftime('%Y-%m-%d','now','localtime')`). Recommend a lint rule or code-review checklist item banning bare `date('now')` / `datetime('now')` without a `'localtime'` modifier, mirroring the existing `formatLocalDate()` convention.

### 6.6 Recommended storage for this app

Not a decision I can make — it is a schema decision — but the constraints are:

- **Timestamps** (`last_contact`, `created_at`, `field_history.timestamp`): store as **TEXT ISO-8601 UTC**. Sorts correctly as text (which §14.2's `sortExpr()` already relies on: `case 'date': return field.col_name; // ISO strings sort correctly as text`), is human-readable in a debugger on a device you cannot reach, and converts to local for display with a single `'localtime'`.
- **Custom `date` fields** are already forced to TEXT by §14.2, and §14.2's `sortExpr` comment is correct — ISO-8601 `YYYY-MM-DD` is lexicographically ordered. A calendar date the user typed ("her birthday is 4 March") is a *local wall-clock date with no instant attached* and must **not** be UTC-normalised at all — round-tripping it through UTC is precisely how the evening off-by-one corrupts data. Store the literal `YYYY-MM-DD`.
- **INTEGER unix epoch** is defensible for timestamps and slightly cheaper, but loses debug readability and forces a conversion on every display. Given "tens of contacts," the performance argument is nil.

**[MEASURED]** confirming §14.2's premise that TEXT storage breaks numeric sort:

```
  ORDER BY v                 ->  10,100,9
  ORDER BY CAST(v AS REAL)   ->  9,10,100
```

The `sortExpr()` helper is necessary and correct.

---

## 7. Other schema-relevant capabilities

| Capability | Status in bundled 3.50.3 | Evidence |
|---|---|---|
| **STRICT tables** | Available (added 3.37.0, 2021-11-27) | `CREATE TABLE s(a INT, b TEXT) STRICT` → OK **[MEASURED]**; [sqlite.org/stricttables.html](https://sqlite.org/stricttables.html) **[DOC]** |
| **Generated columns** | Available | `CREATE TABLE g(a INT, b INT GENERATED ALWAYS AS (a*2) VIRTUAL)` → OK **[MEASURED]** |
| **`PRAGMA foreign_keys`** | **OFF** by default; per-connection; no-op inside a transaction | §5.3 |
| **WAL mode** | Supported; **not** enabled by default by expo-sqlite | §7.2 |
| **FTS4 / FTS5** | Compiled in by default | build flags **[SOURCE]** |
| **Math functions** | Compiled in (`SQLITE_ENABLE_MATH_FUNCTIONS=1`) | build flags **[SOURCE]** |
| **Session / preupdate hook** | Compiled in | build flags **[SOURCE]** |
| **`sqlite-vec` extension** | Pre-bundled, opt-in via `expo.sqlite.withSQLiteVecExtension` | CHANGELOG 16.0.0, [PR #38693](https://github.com/expo/expo/pull/38693) **[SOURCE]** |
| **SQLCipher (encryption at rest)** | Opt-in via `expo.sqlite.useSQLCipher` gradle/podfile property; uses SQLite 3.49.1 + SQLCipher 4.7.0 | `android/build.gradle:17,23`; podspec **[SOURCE]** |

### 7.1 STRICT tables — a note for §14.2, not a challenge to it

STRICT tables permit only `INT, INTEGER, REAL, TEXT, BLOB, ANY` and require every column to declare a type. **[DOC]** *"Everything else about a STRICT table works the same as it does in an ordinary non-strict table."*

`contact_custom_values` is all-TEXT with no constraints, so it would be legal as STRICT. But **STRICT would change behaviour**: today a `number`-typed custom field holding `"about 60k"` is stored happily in the TEXT column, which is exactly what §14.4 requires (*"Values that don't [parse] are flagged, not destroyed"*). STRICT on a TEXT column would still accept it (TEXT accepts strings), so there is no actual conflict — but STRICT buys nothing here either, since §14.3 already puts enforcement in the UI. **Recommendation: do not use STRICT on `contact_custom_values`.** It could reasonably be considered for fixed tables like `contacts` and `custom_field_defs`. That is a schema decision for the owner, not something to adopt silently.

Generated columns are worth an explicit **avoid** on `contact_custom_values`: a generated column referencing a custom column would make `DROP COLUMN` fail (§4.4), same class of hazard as an index. Add it to the §14.11 invariant list.

### 7.2 WAL is not on by default

**[SOURCE]** Grep of `src/`, the Kotlin module, and the Swift module finds **no** `journal_mode` / WAL setting. expo-sqlite leaves SQLite's default (`delete` journal mode). The Expo docs recommend turning it on — **[DOC]** *"Enable WAL journal mode when you create a new database to improve performance in general."* — and the migration example does it in the v0 branch.

Two operational notes: WAL creates sibling `-wal` and `-shm` files next to the database (relevant to any JSON export/backup work under §3 `[OPEN]`), and `PRAGMA journal_mode = 'wal'` is persistent in the database file, so it only needs setting once — but must be set **outside** a transaction.

### 7.3 Database file location, and the backup question

**[SOURCE]** `android/src/main/java/expo/modules/sqlite/SQLiteModule.kt:35-36`:

```kotlin
    Constant("defaultDatabaseDirectory") {
      context.filesDir.canonicalPath + File.separator + "SQLite"
```

So the file lives at `/data/data/<package>/files/SQLite/<name>.db` — Android app-specific **internal** storage. **[DOC]** [developer.android.com/training/data-storage/app-specific](https://developer.android.com/training/data-storage/app-specific): *"The system prevents other apps from accessing these locations"*; *"Other apps cannot access files stored within internal storage"*; on Android 10+ these locations are encrypted; and *"When the user uninstalls your app, the files saved in app-specific storage are removed."* Files persist across app **updates** — removal occurs only on uninstall (and on the user's explicit "Clear storage").

This satisfies §3's sandbox requirement. Two things follow:

- **Uninstall is unrecoverable data loss with no backstop.** This sharpens the §3 `[OPEN]` on backup/export from "nice to have" to "the only thing standing between a user and total loss." Worth raising when that item is decided.
- **`android:allowBackup="false"` is load-bearing.** **[SOURCE]** `expo-template-bare-minimum@57.0.14`, `android/app/src/main/AndroidManifest.xml:22`, ships `android:allowBackup="false"`. Had it been `true` (the Android platform default), Android Auto Backup would copy `filesDir` — including the contacts database — to the user's Google Drive, flatly contradicting *"Contact data never leaves the device."* Expo's default is the right one. **Recommend recording this as a decision so nobody "fixes" it later**, and verifying it in the generated manifest after every prebuild.

**[DOC]** One iOS-side note for the later port: *"On Apple TV, the underlying database file is in the caches directory and not the application documents directory, per Apple platform guidelines."* — tvOS only, not iOS. Not relevant now.

---

## 8. Web platform gap

`withExclusiveTransactionAsync` **throws** on web: `throw new Error('withExclusiveTransactionAsync is not supported on web')` **[SOURCE]**. Since §14's DDL work should use the exclusive form (§5.4), custom-field mutation cannot work on web at all. Irrelevant to Android-first, but it means "run it in the browser to test" is not available for that subsystem. Noted so it is not rediscovered.

---

## 9. F3 — the `col_name` injection surface (owner decision)

This was not in the assignment brief but falls directly out of §2.2 and §14.9, and it is a security-posture item, which `CLAUDE.md` places in the owner's bucket.

`HANDOFF.md` §14.9 says: *"Salvage only `keyToLabel()` (~9 lines) for deriving `col_name` from a user-entered label."* Every §14 DDL statement must interpolate that `col_name` into a SQL string, because:

**[MEASURED]** Identifiers cannot be parameter-bound:
```
  prepare('ALTER TABLE ccv ADD COLUMN ?') -> rc=1 near "?": syntax error
```

And **[MEASURED]** naive double-quoting is **not** a sufficient defence, because `execAsync` runs every statement in the string. With a field label of `a" TEXT; DROP TABLE ccv; --`:

```
SQL sent to execAsync():
  ALTER TABLE ccv ADD COLUMN "a" TEXT; DROP TABLE ccv; --" TEXT

rc=0  (no error)
ccv table still exists? NO -- DROPPED, all contact data destroyed
```

Threat model is admittedly narrow — a solo local-first app where the only person typing labels is the user, so the realistic risk is a self-inflicted footgun (a label containing a quote or semicolon) rather than an attacker. But §14.10 point 7 adds a photo field and §3 anticipates a JSON **importer**, and imported field definitions are not user-typed. Also `HANDOFF.md` §1 architects for public release.

**Recommendation (for the owner to accept or reject):** generate `col_name` by *whitelist construction* — lowercase, `[a-z0-9_]` only, must start with a letter, non-empty, length-capped, checked against a SQLite keyword list, uniqueness-checked against `pragma_table_info` — rather than by escaping the label. The label stays free-text in `custom_field_defs.label`; only the derived `col_name` ever reaches SQL. Reject or mangle anything that does not match, and assert the pattern immediately before every DDL interpolation.

---

## 10. Explicit list of what I could NOT verify

1. **Any Expo guidance on wrapping migrations in transactions.** None exists. The docs' example is not wrapped and I found no doc page, ADR, or changelog entry addressing it either way. §3.5's recommendation is my inference from verified SQLite behaviour, not a cited Expo recommendation.
2. **The app-template default `minSdkVersion` for SDK 57 from an official docs page.** I verified the library-level fallback of **24** in `expo-modules-core@57.0.10` source, but `expo-build-properties` documents the override knobs without publishing defaults, and `expo-template-bare-minimum@57.0.14`'s `android/build.gradle` delegates to the `expo-root-project` gradle plugin. **This is moot for the assignment's purpose** — expo-sqlite bundles its own SQLite, so the OS version cannot affect `DROP COLUMN`.
3. **`'localtime'` on an actual Android device.** All timezone measurements were on this Linux host against the identical vendored amalgamation, using glibc rather than bionic. The code path is the same and I have high confidence, but it is not device-verified. A one-line on-device probe is cheap and recommended before status calculation depends on it.
4. **Whether SDK 57 changed anything in expo-sqlite.** The 57.0.0 and 57.0.1 changelog entries both read *"This version does not introduce any user-facing changes,"* and the SDK 57 changelog page does not mention expo-sqlite. I am confident nothing changed, but I am inferring from absence.
5. **The exact expo-sqlite release in which Android switched from the OS SQLite to the vendored amalgamation.** The CHANGELOG does not state it cleanly; the closest entries are 14.0.0's *"[Android] Removed the package included SQLite source and download in build time"* ([#25186](https://github.com/expo/expo/pull/25186)) and the closure of [#23970](https://github.com/expo/expo/issues/23970) via [PR #23993](https://github.com/expo/expo/pull/23993). **The current state is not in doubt** — I read the shipping build config and the renamed symbols directly — only the historical transition point is unclear.
6. **`sqlite.org` version-attribution for `RENAME COLUMN` / `DROP COLUMN` from the ALTER TABLE page itself.** That page documents the features but omits version numbers; I sourced the versions from the 3.25.0 and 3.35.0 release logs instead, which is equally authoritative.
7. **Behaviour under SQLCipher.** All measurements used `vendor/sqlite3` (3.50.3), the default. The opt-in SQLCipher path vendors a *different, older* SQLite (3.49.1). It still clears 3.35.0 comfortably, so §14 is safe either way, but I did not compile or test it. If encryption-at-rest is ever adopted, re-run these probes.

---

## Appendix — reproduction

The empirical results were produced by extracting the published tarball and compiling `vendor/sqlite3/sqlite3.c` with Expo's own Android flag set. All symbols are prefixed `exsqlite3_` in the vendored source.

```bash
npm pack expo-sqlite@57.0.1 && tar xzf expo-sqlite-57.0.1.tgz
gcc -O1 -c -I package/vendor/sqlite3 \
  -DSQLITE_ENABLE_BYTECODE_VTAB=1 -DSQLITE_TEMP_STORE=2 \
  -DSQLITE_ENABLE_SESSION=1 -DSQLITE_ENABLE_PREUPDATE_HOOK=1 \
  -DSQLITE_ENABLE_MATH_FUNCTIONS=1 \
  -DSQLITE_ENABLE_FTS4=1 -DSQLITE_ENABLE_FTS3_PARENTHESIS=1 -DSQLITE_ENABLE_FTS5=1 \
  package/vendor/sqlite3/sqlite3.c -o sqlite3.o
# then link any probe against sqlite3.o, calling exsqlite3_open / exsqlite3_exec
TZ="America/New_York" ./probe
```

### Sources

- [Expo SDK 57 changelog](https://expo.dev/changelog/sdk-57)
- [Expo SQLite docs (latest)](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Expo build-properties docs](https://docs.expo.dev/versions/latest/sdk/build-properties/)
- [expo-sqlite on npm](https://www.npmjs.com/package/expo-sqlite) — and the 57.0.1 tarball itself
- [SQLite ALTER TABLE](https://sqlite.org/lang_altertable.html) · [3.25.0 release log](https://sqlite.org/releaselog/3_25_0.html) · [3.35.0 release log](https://sqlite.org/releaselog/3_35_0.html)
- [SQLite datatypes](https://sqlite.org/datatype3.html) · [date/time functions](https://sqlite.org/lang_datefunc.html) · [transactions](https://sqlite.org/lang_transaction.html) · [foreign keys](https://sqlite.org/foreignkeys.html) · [STRICT tables](https://sqlite.org/stricttables.html) · [features](https://sqlite.org/features.html)
- [Android app-specific storage](https://developer.android.com/training/data-storage/app-specific)
- [expo/expo#23970](https://github.com/expo/expo/issues/23970) (closed) · [PR #23993](https://github.com/expo/expo/pull/23993) · [PR #38200](https://github.com/expo/expo/pull/38200) · [PR #31766](https://github.com/expo/expo/pull/31766)
