# Phase 2: Data Foundation & Status Engine - Research

**Researched:** 2026-08-14
**Domain:** On-device SQLite (expo-sqlite / SDK 57) — irreversible migration-1 schema, single-writer recency DAO, query-time status engine, launch-sweep skeleton
**Confidence:** HIGH (platform facts first-hand verified in dossier `01-data` §F15 + `04-log` §F1-F9 and re-confirmed against official expo docs this session; schema constraints traced to `[DECIDED]` dossier entries)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
This is a pure-infrastructure phase. `docs/dossier/01-data.md` records **no `[OPEN]` items**, so there are no owner grey areas. Implementation choices are Claude's discretion **within** the recorded decisions in HANDOFF §3/§14, CLAUDE.md's data-layer rules, dossier `01-data` + `INDEX.md`, and the ROADMAP cross-phase constraints. Those are `[DECIDED]` — do NOT reverse them; if a genuine conflict forces one, STOP and escalate to the owner.

**Load-bearing constraints (not choices — enforce them):**
- **Migrations are forward-only, ship as app code via `PRAGMA user_version`, run in strict order, each transaction-wrapped, and are IRREVERSIBLE in production** (no remote DB access — a migration bug is permanent for that user). Never assume a starting state; a user may jump v1→v6. `foreign_keys=ON` + WAL + `busy_timeout` set **before any transaction opens**.
- **Single-writer `last_contact` DAO (DATA-04):** the ONLY writer of `contacts.last_contact`, recomputed as **MAX over the contact's current interaction rows** on every insert/edit/delete, in a transaction, behind a JS mutex. Every touchpoint route writes through it (headless writers share the mutex). For **"Rarely responds" contacts the MAX is over CONNECTED rows only** ([log→data] — scopes, doesn't reverse, the rule).
- **Status is derived-never-stored (DATA-05):** query-time elapsed ÷ interval; `stable`/`wobble`/`decay` are 80%/100% thresholds; `rogue` is a 4th threshold + a non-time path; resolves day-granular at local midnight; SQL uses `date('now','localtime')`, TS uses `formatLocalDate()` — never `date('now')` / `toISOString().split('T')[0]` (UTC off-by-one).
- **Un-backfillable columns exist from migration 1** (DATA-02/03 list + interaction `recorded_at`/`source`; `custom_field_defs` display-order + `share_with_ai`). Adding them later is impossible against un-reachable devices.
- **`modified_at` + distinct `uid` on every mergeable table** exist for backup's newest-edit-wins Merge (Phase 16); `uid` joins as un-backfillable in migration 1 ([restore→data], [backup→data]).
- **The launch sweep is a SWEEP at foreground launch, never a timer/trigger.** Runs once per **real foreground launch** — NOT on module import or a headless widget/notification tap ([capture→data]).
- **Custom value columns are TEXT forever; never indexed/UNIQUE** (HANDOFF §14.2/§14.11).

### Claude's Discretion (genuinely open, tunable)
- The DATA-07 benchmark "acceptable" threshold and the exact `rogue` constant (a multiple of the interval) are top-of-file tunable constants (CLAUDE.md convention).
- Migration-runner structure, DAO/module layout under `src/db/`, mutex implementation.

### Deferred Ideas (OUT OF SCOPE)
- Custom-fields LOGIC — 7 parsers, `sortExpr()`, quarantine expiry, `field_history` retention sweep, the field editor UI → **Phase 3** (only the TABLES are created here).
- Contact CRUD/forms, archive/restore/purge, `contact_links` UI → **Phase 4**.
- The sweep RESPONSIBILITIES (quarantine expiry, archived-purge, schedule reconcile, digest re-register, backup rotation) → their owning phases (3, 4, 11, 15, 16); Phase 2 builds only the entry point + hooks.
- gravity/intensity/rogue rendering, the "Rarely responds"/rogue UI → **Phase 6**.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | `PRAGMA user_version` runner: forward-only, strict order, each step transaction-wrapped; `foreign_keys=ON` + WAL + `busy_timeout` before any transaction | Crash-safe runner pattern (§Architecture Pattern 1); pitfalls P1 (FK inside txn), P2 (user_version last-write), P3 (wrapper error-masking) |
| DATA-02 | Migration-1 `contacts` with full un-backfillable column set | Full DDL (§Code Example 1); column provenance table |
| DATA-03 | Migration-1 `categories` (seeded), self/profile row, `contact_links`, `interactions`, `events`; uid+modified_at on mergeable tables | Full DDL (§Code Example 1); seed statements |
| DATA-04 | Exactly one DAO writes `last_contact` = MAX over current rows, in a transaction, behind a JS mutex shared with headless writers | Single-writer DAO + promise-chain mutex (§Architecture Pattern 2, §Code Example 2); pitfall P4 (transaction capture) |
| DATA-05 | Query-time status: elapsed ÷ interval, 80%/100% buckets, local midnight, `date('now','localtime')` | Query-time status expression (§Architecture Pattern 3, §Code Example 3); reuse `src/types.ts calculateStatus()` |
| DATA-06 | Launch-sweep entry point once per real foreground launch, hooks for later phases | AppState-gated sweep runner + hook registry (§Architecture Pattern 4, §Code Example 4); pitfall P5 (module-scope side effects) |
| DATA-07 | On-device benchmark: newest-per-contact query + status scan acceptably fast | Benchmark harness over the proven pipeline (§Validation Architecture); newest-per-contact query options (§Code Example 3) |
</phase_requirements>

## Summary

This is the single most consequential phase for data correctness in the project: the migration-1 schema is **irreversible in production** — there is no remote DB access, so any structural mistake is permanent on devices you cannot reach. Everything downstream (custom fields, CRUD, log, dashboard, orrery, notifications, widget, digest, backup) reads or writes tables defined here, and several columns (`created_at`, `ring_seq`, `uid`, `modified_at`, interaction `recorded_at`/`source`, defs `display_order`/`share_with_ai`) **cannot be backfilled truthfully** and must be present from day one.

The platform is well-characterised. `expo-sqlite@57.0.1` (already a Phase-1 dep) vendors its own **SQLite 3.50.3** on both Android and iOS, exposes the async API (`openDatabaseAsync`, `execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync`, `withTransactionAsync`, `withExclusiveTransactionAsync`, `SQLiteProvider`/`useSQLiteContext`). Three verified platform hazards dominate the design: (1) `PRAGMA foreign_keys` is OFF by default and a **silent no-op inside a transaction**; (2) the documented `migrateDbIfNeeded` example is **not crash-safe** (writes `user_version` last, in autocommit, so a mid-migration throw wedges the device permanently); (3) both `withTransactionAsync` and `withExclusiveTransactionAsync` **mask the original error** on a throwing rollback, and `withTransactionAsync` uses a DEFERRED `BEGIN` on the *shared* connection so unrelated async queries — including headless widget/notification writes — get captured into the transaction and rolled back with it.

**Primary recommendation:** Hand-roll a `user_version` migration runner that sets `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout` **before** any transaction, then wraps **each** version step in an explicit `BEGIN … ; PRAGMA user_version = N; COMMIT` with a try/rollback that **re-throws the original error** (do NOT use expo-sqlite's transaction wrappers for migrations or for the single-writer DAO). Route every `last_contact` write through one DAO function guarded by a module-level promise-chain mutex shared across foreground and headless entry points. Compute status/progress at query time in SQL from `date('now','localtime')`, reusing the thresholds already encoded in `src/types.ts`. Gate the launch sweep on a real RN `AppState` foreground transition, never module scope. Benchmark on the physical Pixel via the proven `droid`/`scp`/`gradlew`/`adb` pipeline.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema definition + migrations | Database / Storage (`src/db/`) | App entry (runs runner before first render) | Ships as app code via `user_version`; no server exists |
| Recency spine (`last_contact` write) | Database / Storage (DAO in `src/db/`) | Headless contexts (widget/notification share the DAO+mutex) | Single writer, transactional, MAX-recompute — invariant lives at the data layer |
| Status / progress derivation | Database / Storage (query-time SQL) + pure logic (`src/types.ts`) | UI (reads the derived value) | Derived-never-stored; same number drives dashboard sort and orrery angle |
| Launch sweep orchestration | App entry / lifecycle (`AppState`) | Services (`src/services/` hosts hook implementations later) | Must fire on a real foreground launch, not module import — a lifecycle concern |
| On-device benchmark | Build/verification tier (Pixel via pipeline) | — | Perf claims are physical-device-only (CLAUDE.md) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-sqlite` | `~57.0.1` (already installed) | On-device SQLite; async API + `SQLiteProvider`/`useSQLiteContext`; vendors SQLite 3.50.3 | HANDOFF §3 `[DECIDED]`; the only supported managed-Expo SQLite path; legacy `openDatabase` was **removed** in 15.0.0 / SDK 52 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:sqlite` (built-in) | Node 22.22.2 bundles **SQLite 3.51.2** | Node-side test harness for SQL semantics (DDL executes, MAX-recompute, newest-per-contact, status expression) | **Recommended** for Wave-0 tests — zero new dependency, synchronous, close SQLite version. `--experimental-sqlite` flag / `ExperimentalWarning` (stable enough for test-time) |
| `vitest` | `^4.1.10` (already a devDep) | Test runner for pure logic + node-side SQL harness | Already configured (`src/types.test.ts` etc.) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:sqlite` for tests | `better-sqlite3@13.0.3` | Popular, synchronous, but a **new native devDependency** (must pass §Package Legitimacy Audit + build against Node ABI). `node:sqlite` is built-in and needs nothing. Choose `better-sqlite3` only if the experimental-flag warning is unacceptable in CI. |
| Hand-rolled promise-chain mutex | `async-mutex` (npm) | A ~15-line promise-chain mutex covers the single-writer need with **zero new deps** and no read-path dependency (CLAUDE.md). `async-mutex` adds a package for no material gain. Recommend hand-rolling. |
| Manual `BEGIN/COMMIT` for migrations | `db.withTransactionAsync` / `withExclusiveTransactionAsync` | The expo wrappers **mask the original error** on a throwing rollback (F15/F8) and (for the non-exclusive variant) capture unrelated queries on the shared connection. For irreversible migrations you need the real error — hand-roll (see Pitfall P3). |

**Installation:** No new runtime packages required. `expo-sqlite` is already installed (Phase 1). Optional test dep only if `node:sqlite` is rejected: `npm install --save-dev better-sqlite3` (verify first — see audit).

**Version verification (this session):**
```
expo-sqlite: ~57.0.1  (package.json; dossier F15 confirmed 57.0.1, SQLite 3.50.3 vendored)
node:sqlite: SQLite 3.51.2  (node --experimental-sqlite, Node 22.22.2 — verified live)
better-sqlite3: 13.0.3  (npm view — verified live; NOT yet installed)
vitest: ^4.1.10  (package.json)
```

## Package Legitimacy Audit

> No new **runtime** packages are installed this phase. `expo-sqlite` is a pre-existing Phase-1 dependency and an official Expo module. The only *optional* addition is a test devDependency, and only if `node:sqlite` is rejected.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `expo-sqlite` | npm | mature (Expo core) | very high | github.com/expo/expo | [OK] | Approved — already installed, official Expo module |
| `node:sqlite` | Node core (not npm) | Node 22+ | n/a | nodejs/node | [OK] | Approved — built-in, no install |
| `better-sqlite3` | npm | 8+ yrs | ~5M/wk | github.com/WiseLibs/better-sqlite3 | [OK] | Optional test dep only; **if chosen, planner must run `gsd-tools query package-legitimacy check --ecosystem npm better-sqlite3` + `npm view better-sqlite3 scripts.postinstall` before install** (native module with a build step) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                         App launch (index.ts → App.tsx effect)
                                       │
                                       ▼
                        ┌──────────────────────────────┐
   headless entry       │  openDatabaseAsync(...)       │
   (widget/notif tap,   │  PRAGMA journal_mode = WAL    │  ← set BEFORE any txn
    Phases 11/12)       │  PRAGMA foreign_keys = ON     │     (WAL persistent;
        │               │  PRAGMA busy_timeout = N      │      FK per-connection,
        │               └───────────────┬──────────────┘      no-op inside a txn)
        │                               ▼
        │               ┌──────────────────────────────┐
        │               │  migration runner (user_version)          │
        │               │  read user_version → for each pending N:   │
        │               │   BEGIN; <DDL for N>; PRAGMA user_version=N;│  ← per-step
        │               │   COMMIT   (catch → ROLLBACK; re-throw)     │     atomic
        │               └───────────────┬──────────────┘
        │                               ▼
        │            ┌───────────────────────────────────────────────┐
        │            │  SQLite file  /data/data/com.bwales.orbit/      │
        │            │    files/SQLite/orbit.db  (WAL, FK on)          │
        │            │  contacts · categories · profile · contact_links│
        │            │  interactions · events · custom_field_defs ·    │
        │            │  contact_custom_values · field_history          │
        │            └───────┬───────────────────────────┬────────────┘
        │                    │ read (derived)            │ write (recency)
        ▼                    ▼                           ▼
  ┌───────────────┐   ┌──────────────────┐     ┌──────────────────────────┐
  │ JS MUTEX      │──▶│ single-writer DAO │────▶│ INSERT/EDIT/DELETE        │
  │ (module-level │   │  recordTouchpoint │     │ interaction  +            │
  │  promise      │   │  editTouchpoint   │     │ recompute last_contact =  │
  │  chain, one   │   │  deleteTouchpoint │     │ MAX(occurred_at) over     │
  │  per runtime, │   └──────────────────┘     │ CURRENT rows (connected   │
  │  shared by    │                            │ only if rarely_responds)  │
  │  all writers) │                            └──────────────────────────┘
  └───────────────┘
                     ┌──────────────────────────────────────────┐
   read path         │ QUERY-TIME status/progress (never stored) │
   (dashboard,       │  progress = (julianday(date('now',        │
    orrery, sort) ◀──│    'localtime')) - julianday(date(         │
                     │    last_contact))) / interval_days         │
                     │  buckets: <0.8 stable · <1.0 wobble ·      │
                     │  >=1.0 decay · >=rogueK OR rarely_responds │
                     │  → rogue                                   │
                     └──────────────────────────────────────────┘

   AppState background→active  ─▶  launch sweep runner (once per real
                                    foreground launch; NOT module scope)
                                    → runs registered hooks (empty in P2)
```

### Recommended Project Structure
```
src/db/
├── database.ts        # openDatabaseAsync + PRAGMA bootstrap (WAL/FK/busy_timeout), single db handle accessor
├── migrations/
│   ├── runner.ts      # user_version runner: read version, per-step BEGIN/COMMIT, re-throw on error
│   └── 001-initial.ts # migration 1 DDL (all tables + seeds) as a plain SQL string / step fn
├── mutex.ts           # module-level promise-chain mutex (shared foreground + headless)
├── recency-dao.ts     # THE single writer of contacts.last_contact (recordTouchpoint/edit/delete)
├── status.ts          # query-time status SQL fragments + thresholds re-exported from src/types.ts
└── queries.ts         # read helpers (newest-interaction-per-contact, status scan)
src/services/
└── launch-sweep.ts    # AppState-gated sweep runner + hook registry (empty hooks in P2)
```

### Pattern 1: Crash-safe `user_version` migration runner (DATA-01)
**What:** Bootstrap PRAGMAs outside any transaction, then run each pending version step inside its own explicit transaction that commits the DDL **and** the `user_version` bump together, re-throwing the real error on failure.
**When to use:** Every app launch, before first render, before any read/write.
**Why not the documented example:** The official `migrateDbIfNeeded` writes `PRAGMA user_version = N` *after* the DDL in autocommit — a throw mid-migration leaves the DB half-built with the version unchanged, so the next launch re-runs from the top and wedges permanently on `table already exists` (dossier F16.2). See §Code Example 1.

### Pattern 2: Single-writer recency DAO behind a shared JS mutex (DATA-04)
**What:** One module exports the *only* functions that write `contacts.last_contact`. Each acquires a module-level promise-chain mutex, opens a transaction, performs the interaction insert/edit/delete, then recomputes `last_contact = MAX(occurred_at)` over the contact's current rows (connected-only for "Rarely responds"), and commits.
**When to use:** Every touchpoint route — foreground CRUD (Phase 4), widget tap (Phase 12), notification action (Phase 11). All import the same module, so they share the same mutex instance in the one JS runtime.
**Why the mutex:** Headless widget/notification writes share the app's JS runtime, process and expo-sqlite connection. Without serialization, a headless write can land inside a foreground transaction and be rolled back with it (transaction capture — F5/04-log). See §Code Example 2.

### Pattern 3: Query-time status/progress (DATA-05)
**What:** `stable/wobble/decay/rogue` and the continuous progress value are computed in the SELECT from `date('now','localtime')` and `interval_days`; nothing is stored. The three buckets are a view over one continuous quantity `elapsed ÷ interval`; `rogue` is a fourth threshold (`>= rogueK × interval`) **or** the "Rarely responds" non-time path.
**When to use:** Dashboard sort, orrery angle, any "how overdue" read. `WHERE last_contact IS NOT NULL` excludes never-contacted ([data→dashboard]).
**Reuse:** `src/types.ts calculateStatus()` + `FREQUENCY_DAYS` are already ported and tested; the SQL thresholds (0.8 / 1.0 / rogueK) must be a **single shared constant set** with the TS side to prevent drift. Do NOT persist `OrbitContact.status`/`daysSinceContact` as columns (labelled legacy-compat). See §Code Example 3.

### Pattern 4: AppState-gated launch sweep with a hook registry (DATA-06)
**What:** A sweep runner exposed as `runLaunchSweep()` plus `registerSweepHook(fn)`. Called once from the App component on cold start and on RN `AppState` `background → active`. Later phases register their responsibilities; Phase 2 ships the runner + an empty registry.
**Why not module scope:** `expo-task-manager` loads the JS bundle (and its module side-effects) on every headless widget/notification tap. A sweep at module top-level would run inside the 30-second headless budget on every tap. Trigger it only from a real foreground `AppState` transition. See §Code Example 4.

### Anti-Patterns to Avoid
- **Using `withTransactionAsync`/`withExclusiveTransactionAsync` for migrations or the DAO** — they discard the original error on a throwing rollback (F15/F8). Hand-roll `BEGIN/COMMIT` with explicit re-throw.
- **Setting `PRAGMA foreign_keys = ON` inside a transaction** — silent no-op; every `ON DELETE CASCADE` becomes decorative (F15). Set it in bootstrap, before any `BEGIN`.
- **Storing `status`, `daysSince`, `daysUntilDue`, `progress`, `gravity`, or `intensity`** — all derived-never-stored; a stored value rots silently (no trigger fires on the passage of time).
- **Indexing or UNIQUE-constraining any `contact_custom_values` column** — breaks Phase-3 `DROP COLUMN` quarantine expiry (HANDOFF §14.11). Indexing `interactions(contact_id, occurred_at DESC)` is correct and required — the ban is scoped to `contact_custom_values` only.
- **`date('now')` in SQL / `toISOString().split('T')[0]` in TS** — UTC off-by-one; use `date('now','localtime')` and `formatLocalDate()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite access | A native module or raw JSI binding | `expo-sqlite` async API | Vendored 3.50.3, managed-Expo supported, config plugin already wired (Phase 1) |
| Status math | New progress/threshold logic | `src/types.ts calculateStatus()` + `FREQUENCY_DAYS` (ported, tested) | Already the "same number" the orrery needs; re-deriving invites drift |
| Local date formatting | New date formatter | `src/utils/dates.ts formatLocalDate()` | Fixes a UTC off-by-one already fixed once in the plugin |
| Status-order sort | New enum ordering | Port `OrbitIndex.ts statusOrder` (`decay 0, wobble 1, stable 2, snoozed 3`) | Reusable shape; extend with `rogue` |
| UUID for `uid` | A custom RNG | `expo-crypto` `randomUUID()` (already available in SDK 57) or `crypto.randomUUID()` polyfill | App-generated UUID keyed for backup merge ([backup→data]); do not hand-roll entropy |

**Key insight:** Almost everything expensive in this domain (the pure status logic, the date fix, the sort order) already ships in `src/`. The net-new work is *SQLite plumbing done correctly*: the migration runner, the DAO, and the sweep — where the value is entirely in getting the three verified platform hazards right, not in writing novel logic.

## Runtime State Inventory

> Greenfield phase — this migration **creates** the datastore; it does not rename or migrate existing runtime state. `src/db/` currently holds only `.gitkeep`; the SQLite file does not exist on device until this phase ships. There is no prior schema, no stored keys, no OS-registered state, and no build artifacts to reconcile. Section otherwise N/A.

**Nothing found in any category:** confirmed — `src/db/` is empty (verified `find src -type f`), no `.db` file is created before Phase 2, and the Obsidian *data* importer is CUT (app starts clean).

## Common Pitfalls

### Pitfall P1: `foreign_keys` toggled inside a transaction (silent no-op)
**What goes wrong:** `PRAGMA foreign_keys = ON` issued after a `BEGIN` does nothing; every `ON DELETE CASCADE` in the schema is decorative.
**Why it happens:** SQLite refuses the change mid-transaction and returns silently; `withExclusiveTransactionAsync` opens a fresh connection and issues `BEGIN` with FK unconditionally OFF (F15).
**How to avoid:** Set `foreign_keys = ON` in the bootstrap, **before** the runner opens any transaction, on the same connection used for reads/writes. Re-assert it per connection if you open more than one.
**Warning signs:** deleting a contact leaves orphaned `interactions`/`contact_links`; a Phase-4 purge test finds child rows surviving.

### Pitfall P2: `user_version` written last (device wedges permanently)
**What goes wrong:** A throw partway through migration DDL commits the earlier statements (DDL autocommits per statement) but leaves `user_version` unchanged; the next launch re-runs from step 0 and dies on `table X already exists` forever. Unrecoverable — no remote access.
**Why it happens:** The documented `migrateDbIfNeeded` runs the DDL and the `PRAGMA user_version = N` write in autocommit, version last (F16.2).
**How to avoid:** Wrap each version step in `BEGIN; <DDL>; PRAGMA user_version = N; COMMIT` so DDL and version bump commit atomically (owner-decided per-step atomicity, cluster G).
**Warning signs:** a deliberately-throwing migration test leaves `user_version` > 0 with a half-built schema; on-device relaunch loops.

### Pitfall P3: expo transaction wrappers mask the original error
**What goes wrong:** When a statement throws, `withTransactionAsync`/`withExclusiveTransactionAsync` issue an unconditional `ROLLBACK` inside their `catch`; that rollback itself throws `cannot rollback - no transaction is active`, discarding the real error. On an irreversible migration you lose all diagnostic signal.
**Why it happens:** Verified in `expo-sqlite@57.0.1` `SQLiteDatabase.ts:187-190` (F8 extends F15).
**How to avoid:** Hand-roll `await db.execAsync('BEGIN'); try { … ; await db.execAsync('COMMIT') } catch (e) { await db.execAsync('ROLLBACK').catch(()=>{}); throw e }` for both the migration runner and the DAO.
**Warning signs:** migration failures surface as `no transaction is active` instead of the true SQL error.

### Pitfall P4: transaction capture of headless writes (DAO)
**What goes wrong:** `withTransactionAsync` uses a DEFERRED `BEGIN` on the *shared* connection, so an unrelated async query — including a headless widget/notification write landing at the same moment — is merged into the foreground transaction and rolled back with it.
**Why it happens:** Headless contexts share the app's ReactHost, process and expo-sqlite connection (F5/04-log). It is **not** lock contention; it is transaction capture.
**How to avoid:** Serialize all `last_contact` writes through one module-level promise-chain mutex so only one DAO transaction runs at a time; keep the DAO's own transaction hand-rolled (P3).
**Warning signs:** a widget "mark contacted" silently no-ops when the app is foregrounded; intermittent lost interaction rows.

### Pitfall P5: launch sweep runs on every headless tap
**What goes wrong:** A sweep placed at module scope (or triggered by module import) fires on every widget/notification headless tap, inside the 30-second budget, doing quarantine/purge work no headless path wants.
**Why it happens:** `expo-task-manager` loads the JS bundle and its side effects on headless invocation (04-log deferred-planning note).
**How to avoid:** Trigger the sweep only from a real RN `AppState` `background → active` transition (and cold-start foreground), never at module top-level.
**Warning signs:** sweep hooks execute during a share-capture cold start before the picker can query ([capture→data]).

### Pitfall P6: `localtime` verified on glibc, not yet on Android/bionic
**What goes wrong:** `date('now','localtime')` behaviour is confirmed on this Linux host (glibc) and Node's bundled SQLite, but the dossier flags an on-device probe on Android/bionic as still owed.
**How to avoid:** Include a one-line on-device assertion in the DATA-07 benchmark run (log `SELECT date('now','localtime')` on the Pixel and compare to wall clock) before trusting status timing.
**Warning signs:** status buckets flip a day early/late only on device.

## Code Examples

### Code Example 1: Crash-safe bootstrap + migration runner (DATA-01)
```ts
// Source: synthesised from official expo docs (docs.expo.dev/versions/latest/sdk/sqlite)
// + dossier 01-data F15/F16.2 crash-safety correction. NOT the documented example.
import * as SQLite from 'expo-sqlite';

const BUSY_TIMEOUT_MS = 5000; // tunable, top-of-file
const TARGET_VERSION = 1;

export async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('orbit.db');
  // 1. PRAGMAs BEFORE any transaction. WAL is persistent; FK is per-connection
  //    and a no-op inside a txn; busy_timeout guards concurrent headless access.
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  await db.execAsync(`PRAGMA foreign_keys = ON;`);
  await db.execAsync(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`);

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  // 2. Forward-only, strict order, each step atomic (DDL + version bump together).
  while (version < TARGET_VERSION) {
    const next = version + 1;
    await db.execAsync('BEGIN');
    try {
      await applyMigration(db, next);            // e.g. migration 1 DDL + seeds
      await db.execAsync(`PRAGMA user_version = ${next};`); // int literal, not bound
      await db.execAsync('COMMIT');
    } catch (e) {
      await db.execAsync('ROLLBACK').catch(() => {}); // preserve the ORIGINAL error
      throw e;                                        // device sits cleanly at `version`
    }
    version = next;
  }
  return db;
}
```

### Code Example 1b: Migration 1 DDL (DATA-02 / DATA-03 + custom-fields carve-in)
```sql
-- Every mergeable table carries a distinct app-generated `uid` (UUID, != PK) and
-- `modified_at` for Phase-16 newest-edit-wins merge. `created_at`/`ring_seq`/`uid`
-- are un-backfillable and MUST exist from migration 1.

CREATE TABLE categories (
  id            INTEGER PRIMARY KEY,
  uid           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  modified_at   TEXT NOT NULL
);

CREATE TABLE profile (                 -- the single "me" record; NOT in contacts
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  uid         TEXT NOT NULL UNIQUE,
  name        TEXT,
  photo       TEXT,                    -- relative filename under document dir
  created_at  TEXT NOT NULL,
  modified_at TEXT NOT NULL
);

CREATE TABLE contacts (
  id             INTEGER PRIMARY KEY,          -- surrogate; identity is never the name
  uid            TEXT NOT NULL UNIQUE,         -- app-generated UUID, merge key
  name           TEXT NOT NULL,                -- NO UNIQUE (duplicates warn, not block)
  category_id    INTEGER REFERENCES categories(id),
  interval_days  INTEGER NOT NULL,             -- frequency as integer days
  social_battery TEXT,                         -- 'Charger' | 'Neutral' | 'Drain'
  birthday       TEXT,                         -- 'MM-DD' or 'YYYY-MM-DD' (optional year)
  phone          TEXT,
  email          TEXT,
  photo          TEXT,                         -- relative filename, nullable
  last_contact   TEXT,                         -- local datetime; NULL = never-contacted;
                                               -- WRITTEN ONLY BY THE SINGLE-WRITER DAO
  favourite_rank INTEGER,                      -- nullable, ordered favourites
  ring_seq       INTEGER,                      -- nullable global radius override
  archived_at    TEXT,                         -- nullable; archived excluded everywhere
  snooze_until   TEXT,                         -- nullable; suppression only, clock runs
  rarely_responds INTEGER NOT NULL DEFAULT 0,  -- 0/1; scopes recency to connected rows
  reminders_off   INTEGER NOT NULL DEFAULT 0,  -- 0/1; mute decay scheduling ([notify→data])
  created_at     TEXT NOT NULL,                -- un-backfillable ring tiebreaker
  modified_at    TEXT NOT NULL
);

CREATE TABLE contact_links (           -- many links per contact ([crud→data])
  id            INTEGER PRIMARY KEY,
  uid           TEXT NOT NULL UNIQUE,
  contact_id    INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  label         TEXT,
  display_order INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  modified_at   TEXT NOT NULL
);

CREATE TABLE interactions (            -- full touchpoint shape ([log→data])
  id          INTEGER PRIMARY KEY,
  uid         TEXT NOT NULL UNIQUE,
  contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  occurred_at TEXT NOT NULL,           -- local wall-clock, editable; status reads this
  recorded_at TEXT NOT NULL,           -- immutable; un-backfillable
  channel     TEXT NOT NULL DEFAULT 'unspecified', -- call|text|in-person|email|other|unspecified
  direction   TEXT,                    -- outbound|inbound|mutual|null
  connected   INTEGER NOT NULL DEFAULT 1, -- 0/1; drives Rarely-responds recency filter
  quality     TEXT,                    -- good|fine|hard|null
  note        TEXT,
  source      TEXT NOT NULL,           -- manual|widget|notification|ai; un-backfillable
  modified_at TEXT NOT NULL
);
CREATE INDEX idx_interactions_recency ON interactions (contact_id, occurred_at DESC);

CREATE TABLE events (                  -- snooze/unsnooze/archive/restore; NEVER unioned
  id          INTEGER PRIMARY KEY,     -- into the recency path
  uid         TEXT NOT NULL UNIQUE,
  contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,           -- snooze|unsnooze|archive|restore
  occurred_at TEXT NOT NULL,
  detail      TEXT,                    -- e.g. snooze duration
  recorded_at TEXT NOT NULL,
  modified_at TEXT NOT NULL
);

-- Custom-fields TABLES ship in migration 1 (HANDOFF §15 #3 / §14.10); the LOGIC is Phase 3.
CREATE TABLE custom_field_defs (
  id             INTEGER PRIMARY KEY,
  uid            TEXT NOT NULL UNIQUE,
  col_name       TEXT NOT NULL UNIQUE, -- whitelist-CONSTRUCTED slug (Phase 3), never escaped
  label          TEXT NOT NULL,
  type           TEXT NOT NULL,        -- 7 field types; drives the widget only
  options        TEXT,                 -- JSON, nullable (dropdown options)
  show_on_new    INTEGER NOT NULL DEFAULT 0,
  always_show    INTEGER NOT NULL DEFAULT 0, -- global "show even when empty"
  display_order  INTEGER NOT NULL,     -- reorder ([crud→fields]); un-backfillable
  quarantined_at TEXT,                 -- nullable; sweep-expired in Phase 3
  share_with_ai  INTEGER NOT NULL DEFAULT 0, -- ([ai→fields]); un-backfillable
  created_at     TEXT NOT NULL,
  modified_at    TEXT NOT NULL
);

CREATE TABLE contact_custom_values (   -- one COLUMN per field (added Phase 3, TEXT forever);
  contact_id  INTEGER PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE, -- starts with none
  uid         TEXT NOT NULL UNIQUE,    -- mergeable table → needs uid + modified_at
  modified_at TEXT NOT NULL
);  -- NEVER add an index or UNIQUE to a value column (breaks DROP COLUMN, Phase 3)

CREATE TABLE field_history (           -- §14.6 snapshot; EXCLUDED from export → no uid needed
  id             INTEGER PRIMARY KEY,
  contact_id     INTEGER NOT NULL,     -- rows purged with the contact ([data→fields])
  field_col_name TEXT NOT NULL,
  old_value      TEXT,
  operation      TEXT NOT NULL,        -- 'type_change' | 'quarantine_drop'
  created_at     TEXT NOT NULL
);

-- Seeds (in the SAME migration-1 transaction):
--   categories: Family, Friends, Work, Community (display_order 0..3)
--   profile: single row id=1
```

### Code Example 2: Single-writer recency DAO + mutex (DATA-04)
```ts
// Source: dossier 04-log deferred-planning ("JS-level mutex around the single-writer DAO")
// + 01-data cluster B (last_contact = maintained MAX; single writer).

// mutex.ts — one instance per JS runtime, imported by foreground AND headless entry points
let chain: Promise<unknown> = Promise.resolve();
export function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);        // run regardless of prior outcome
  chain = run.catch(() => {});           // never let a rejection break the chain
  return run;
}

// recency-dao.ts — THE ONLY writer of contacts.last_contact
import { withMutex } from './mutex';

async function recomputeLastContact(db, contactId: number, now: string) {
  // MAX over the contact's CURRENT rows; connected-only for "Rarely responds".
  await db.runAsync(
    `UPDATE contacts
       SET last_contact = (
             SELECT MAX(occurred_at) FROM interactions
              WHERE contact_id = ?1
                AND (rarely = 0 OR connected = 1)
           ),
           modified_at = ?2
     WHERE id = ?1`,
    // pass rarely via a CTE/join or read the flag first; shown inline for clarity
  );
}

export function recordTouchpoint(db, input) {           // insert path
  return withMutex(async () => {
    await db.execAsync('BEGIN');
    try {
      await db.runAsync(
        `INSERT INTO interactions
           (uid, contact_id, occurred_at, recorded_at, channel, direction,
            connected, quality, note, source, modified_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [...]);
      await recomputeLastContact(db, input.contactId, input.now);
      await db.execAsync('COMMIT');
    } catch (e) { await db.execAsync('ROLLBACK').catch(()=>{}); throw e; }
  });
}
// editTouchpoint / deleteTouchpoint follow the same shape and BOTH recompute MAX —
// last-write-wins on the touched row is WRONG (correcting a non-newest row must not
// move recency). Multi-row create (contact + interaction) is one transaction here too.
```

### Code Example 3: Query-time status + newest-per-contact (DATA-05 / DATA-07)
```ts
// Source: 01-data cluster C (continuous progress, buckets at 80%/100%, local midnight)
// + 04-log (rogue = 4th threshold; newest tiebreak occurred_at DESC, id DESC).
// Keep thresholds in ONE place shared with src/types.ts (0.8 / 1.0 / ROGUE_K).

export const STABLE_MAX = 0.8, WOBBLE_MAX = 1.0, ROGUE_K = 3; // top-of-file tunables

// Day-granular at local midnight: truncate both sides with date(...,'localtime').
export const PROGRESS_SQL = `
  CAST(julianday(date('now','localtime'))
     - julianday(date(last_contact, 'localtime')) AS REAL) / interval_days`;

export const STATUS_SQL = `
  CASE
    WHEN rarely_responds = 1 AND (${PROGRESS_SQL}) >= 1.0 THEN 'rogue'
    WHEN (${PROGRESS_SQL}) >= ${ROGUE_K}                  THEN 'rogue'
    WHEN (${PROGRESS_SQL}) >= ${WOBBLE_MAX}               THEN 'decay'
    WHEN (${PROGRESS_SQL}) >= ${STABLE_MAX}               THEN 'wobble'
    ELSE 'stable'
  END`;

// Dashboard scan: exclude never-contacted, archived; status-sort. WHERE last_contact
// IS NOT NULL is the never-contacted predicate ([data→dashboard]).
export const STATUS_SCAN = `
  SELECT id, name, ${PROGRESS_SQL} AS progress, ${STATUS_SQL} AS status
    FROM contacts
   WHERE last_contact IS NOT NULL AND archived_at IS NULL
   ORDER BY progress DESC`;

// Newest interaction per contact (channel for AI, timeline head). SQLite 3.50.3
// supports window functions; the (contact_id, occurred_at DESC) index makes the
// correlated form a per-contact seek. Prefer the window form for the all-contacts scan:
export const NEWEST_PER_CONTACT = `
  SELECT contact_id, occurred_at, channel FROM (
    SELECT contact_id, occurred_at, channel,
           ROW_NUMBER() OVER (PARTITION BY contact_id
                              ORDER BY occurred_at DESC, id DESC) AS rn
      FROM interactions
  ) WHERE rn = 1`;
// Single-contact head (indexed, cheapest): SELECT ... WHERE contact_id=? ORDER BY
//   occurred_at DESC, id DESC LIMIT 1;
```

### Code Example 4: AppState-gated launch sweep + hooks (DATA-06)
```ts
// Source: 04-log deferred-planning (sweep gated on real foreground launch, not module scope).
import { AppState } from 'react-native';

type SweepHook = () => Promise<void>;
const hooks: SweepHook[] = [];                 // empty in Phase 2; later phases register
export function registerSweepHook(fn: SweepHook) { hooks.push(fn); }

let running = false;
export async function runLaunchSweep() {
  if (running) return;                          // idempotent within a launch
  running = true;
  try { for (const h of hooks) await h(); }     // quarantine expiry, purge, reconcile, rotation...
  finally { running = false; }
}

// Register from the App component effect (NOT module top-level). Fires on cold start
// and on every real background→active transition; a headless tap never hits this.
export function installSweepTrigger() {
  runLaunchSweep();                             // cold-start foreground
  return AppState.addEventListener('change', (s) => {
    if (s === 'active') runLaunchSweep();
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `SQLite.openDatabase(...)` callback API | `openDatabaseAsync` / `SQLiteProvider` async API | expo-sqlite 15.0.0 / SDK 52 (removed, not deprecated) | Training data referencing `openDatabase`/`transaction(tx=>...)` is stale — use the async API only (F15) |
| "Android uses the OS SQLite" hazard | expo-sqlite vendors its own `sqlite3.c` (symbols renamed `exsqlite3_*`) on both platforms, 3.50.3 | current | `DROP COLUMN`/3.35+ features safe everywhere; minSdk irrelevant (F15) |
| HANDOFF §3: "expo-sqlite ships a `user_version` helper" | It ships a **non-crash-safe docs example**, not a helper | corrected in dossier F16.2 | Must hand-roll per-step transactional versioning |

**Deprecated/outdated:**
- Legacy `openDatabase` / `db.transaction()` — removed; do not use.
- The documented `migrateDbIfNeeded` pattern as-is — not crash-safe for irreversible production; adapt per Pattern 1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | **[RESOLVED 2026-08-14 — SUPERSEDED. Owner decided the fuel table SHIPS IN MIGRATION 1, created empty, with FUEL-01's columns. See Q1 (RESOLVED) and 02-CONTEXT.md.]** ~~The fuel table is NOT in migration 1~~ — this assumption is no longer operative; the plans create the empty `fuel` table in migration 1. | Open Questions Q1 | Resolved by owner decision — no residual risk |
| A2 | `contact_custom_values` carries its own `uid` + `modified_at` (mergeable-table rule) despite being 1:1 with contacts | Code Example 1b | Minor: an extra column pair if the owner intends to key merge on the parent contact's uid instead |
| A3 | `field_history` needs no `uid`/`modified_at` (excluded from export per `[backup]`, purged with the contact) | Code Example 1b | Minor: if a future decision exports history, it would need un-backfillable merge columns |
| A4 | `rogueK` (`ROGUE_K`) default = 3× the interval; exact value is an owner/Phase-6/9 tunable | Code Example 3 | Cosmetic only — a single top-of-file constant, no schema impact |
| A5 | `uid` generated via `expo-crypto randomUUID()` (SDK 57) | Don't Hand-Roll | If unavailable, use another UUID source — no schema impact (still a TEXT uid) |
| A6 | Node-side tests use `node:sqlite` (SQLite 3.51.2) as a semantics harness; on-device (3.50.3) is authoritative for migration/DAO/localtime | Validation Architecture | Version skew is 3.51.2 vs 3.50.3 — negligible for Phase-2 DDL/query semantics; localtime still needs the on-device probe (P6) |

**If this table is non-empty:** A1 was the only migration-freeze blocker and is now **RESOLVED** — the owner chose fuel IN migration 1 (2026-08-14); the plans implement it.

## Open Questions (RESOLVED)

1. **[RESOLVED 2026-08-14 — owner chose MIGRATION 1.]** Does the fuel table ship in migration 1, or in Phase 7? *(was highest priority — irreversible; now settled: the empty `fuel` table ships in migration 1 with FUEL-01's columns.)*
   - What we know: `[fuel→ai]` says "Fuel rows carry `kind`/`created_at`/`source`/`url` **from migration 1**"; FUEL-01 (Phase 7) says "**Migration creates** the fuel table (uid, `contact_id` NOT NULL, kind, label, text, url, created_at, source, modified_at)"; the task's additional-context lists fuel columns under migration-1 DDL.
   - What's unclear: CONTEXT.md's authoritative in-scope table list (DATA-03 + the custom-fields carve-in) does **not** include a fuel table. So the two sources conflict on *which migration* creates it.
   - Recommendation: **Confirm with the planner/owner before freezing migration 1.** Adding a new *table* later is a routine migration (unlike un-backfillable columns), so deferring to Phase 7 is safe; but if the owner wants it in migration 1, the ready DDL is:
     ```sql
     CREATE TABLE fuel (
       id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
       contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
       kind TEXT NOT NULL,            -- recent|topic|fact|gift|off_limits
       label TEXT, text TEXT, url TEXT,
       created_at TEXT NOT NULL, source TEXT NOT NULL, -- manual|share|ai
       modified_at TEXT NOT NULL
     );
     ```

2. **`interval_days` as a hard column vs. deriving from a stored enum** — resolved by dossier ([DECIDED] integer interval), no action; noted so the planner does not re-open it.

3. **On-device `localtime` correctness on Android/bionic** — owed per dossier deferred-planning; fold the one-line probe into the DATA-07 benchmark run (P6). Not a blocker for planning, but the benchmark task must include it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-sqlite` | all of Phase 2 | ✓ | ~57.0.1 (SQLite 3.50.3) | — |
| Node + `node:sqlite` | Wave-0 node-side SQL tests | ✓ | Node 22.22.2 / SQLite 3.51.2 | `better-sqlite3@13.0.3` (new devDep, verify first) |
| `vitest` | test runner | ✓ | ^4.1.10 | — |
| `droid` build host (Tailscale) | DATA-07 APK build | ✓ | JDK 17 + Android SDK | — (STATE.md: RESOLVED) |
| `scp`/tar-over-ssh transport | ship code to droid, APK back | ✓ | (no rsync on droid) | — |
| `~/.local/bin/adb` (SDK 37.0.0) | install + logcat on Pixel | ✓ | 37.0.0 | never `apt install adb` |
| Physical Pixel 6 Pro | DATA-07 benchmark (perf claims device-only) | ✓ | serial `1A071FDEE002BU`, pkg `com.bwales.orbit` | emulator invalid for perf |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** node-side SQLite testing — `node:sqlite` (built-in, recommended) or `better-sqlite3` (new devDep).

## Validation Architecture

> `workflow.nyquist_validation` is enabled (config.json). Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest `^4.1.10` (already configured; `*.test.ts` co-located) |
| Config file | none dedicated — vitest via `npx vitest` / package script (Wave 0: confirm a `test` script exists) |
| Quick run command | `npx vitest run src/db` |
| Full suite command | `npx vitest run` |
| On-device (DATA-07) | build via `droid` pipeline → `adb -s 1A071FDEE002BU install` → read timings via logcat/Metro |

**Two-tier strategy (SQLite is a native module — the async expo API does not run under Node):**
- **Tier A — pure logic + SQL semantics, node-side (vitest + `node:sqlite`):** migration DDL executes cleanly and is idempotent per `user_version`; a deliberately-throwing step leaves `user_version` unchanged with no half-built schema (P2); MAX-recompute walks recency correctly (newest-row edit moves it back, older-row insert does not); connected-only MAX for `rarely_responds`; `WHERE last_contact IS NULL` = never-contacted; status buckets at 0.8/1.0/rogueK; newest-per-contact tiebreak `occurred_at DESC, id DESC`. Export SQL as **string constants / pure builders** so they are testable without the expo wrapper.
- **Tier B — integration + platform, on-device only:** FK cascade actually deletes children (proves `foreign_keys=ON` took, P1); the DAO+mutex serializes a simulated concurrent write; `date('now','localtime')` matches Pixel wall clock (P6); DATA-07 benchmark.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | runner applies v1 once; throwing step keeps `user_version`; PRAGMAs set pre-txn | unit (node:sqlite) | `npx vitest run src/db/migrations/runner.test.ts` | ❌ Wave 0 |
| DATA-02/03 | all tables + seeds created; FK cascade deletes children | unit + on-device | `npx vitest run src/db/migrations/001-initial.test.ts` (+ device FK check) | ❌ Wave 0 |
| DATA-04 | single-writer recompute = MAX (edit/insert/delete cases); connected-only for rarely_responds; mutex serializes | unit | `npx vitest run src/db/recency-dao.test.ts` | ❌ Wave 0 |
| DATA-05 | status/progress expression buckets correctly; never-stored; NULL last_contact excluded | unit | `npx vitest run src/db/status.test.ts` | ❌ Wave 0 |
| DATA-06 | sweep runs once per foreground; not on module import; hooks fire in order | unit | `npx vitest run src/services/launch-sweep.test.ts` | ❌ Wave 0 |
| DATA-07 | newest-per-contact + status scan under target on Pixel; localtime correct | manual/on-device | build+install+logcat (pipeline) | ❌ Wave 0 (device) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/db` (quick, node-side)
- **Per wave merge:** `npx vitest run` (full node-side suite)
- **Phase gate:** full node-side suite green + one on-device run (FK cascade + localtime probe + DATA-07 benchmark) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/db/migrations/runner.test.ts` — DATA-01 (crash-safety, PRAGMA order)
- [ ] `src/db/migrations/001-initial.test.ts` — DATA-02/03 (DDL + seeds)
- [ ] `src/db/recency-dao.test.ts` — DATA-04 (MAX-recompute + mutex)
- [ ] `src/db/status.test.ts` — DATA-05 (buckets, never-contacted, tiebreak)
- [ ] `src/services/launch-sweep.test.ts` — DATA-06 (foreground gating, hook order)
- [ ] Shared test helper: open an in-memory `node:sqlite` DB and apply migration 1 (fixture)
- [ ] Confirm/add a `test` script in `package.json` (currently only vitest devDep is present)
- [ ] On-device benchmark script (seed N×M rows, time queries, log `date('now','localtime')`)

## Security Domain

> `security_enforcement` enabled, ASVS level 1.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts, no auth (local-first, single user) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single on-device user; OS sandbox is the boundary |
| V5 Input Validation | **yes** | **Parameterized queries (`?` bind) for every user value.** Custom-field `col_name` (Phase 3) must be whitelist-**constructed**, never escaped ([data→fields] F17: a label `a" TEXT; DROP TABLE ccv; --` executed and dropped the table). In Phase 2 only the empty `contact_custom_values` table is created — no dynamic identifier yet — but the DAO must set the parameterized-query precedent. `PRAGMA user_version = N` uses an **integer code constant** (not bindable, but never user input). |
| V6 Cryptography | no (this phase) | No crypto in Phase 2; backup encryption is Phase 16 (`expo-crypto` AES-GCM). `uid` UUIDs are identifiers, not secrets |

### Known Threat Patterns for {SQLite / expo-sqlite, local-first}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via string-interpolated values | Tampering | Bind every value with `?`; the only interpolated token is the integer `user_version` and (Phase 3) whitelist-constructed `col_name` |
| Third-party PII at rest (phone/email/notes about others) leaving the sandbox | Information disclosure | `android:allowBackup="false"` at the manifest/config layer (dossier cluster G, load-bearing — verify it is set in app config and never "fixed" back to the template default); DB lives in the private sandbox, encrypted on Android 10+; **no network egress on any read path** (local-first) |
| Decorative `ON DELETE CASCADE` leaking orphan rows | Tampering / integrity | `PRAGMA foreign_keys = ON` in bootstrap before any txn (P1); do NOT rely on cascade inside `withExclusiveTransactionAsync` (FK off there) |
| Irreversible migration corruption on unreachable devices | Denial of service (data loss) | Per-step transactional `user_version` (P2); never edit a shipped migration; forward-only |

## Sources

### Primary (HIGH confidence)
- `docs/dossier/01-data.md` — Cluster A–G decisions + §F15 (expo-sqlite 57.0.1 / SQLite 3.50.3, FK-off-by-default, transaction error-masking, localtime), §F16.2 (user_version not crash-safe). First-hand plugin-source verification.
- `docs/dossier/04-log.md` — interaction/events column set, single-writer MAX-recompute, "Rarely responds" connected-only, `rogue`, mutex + sweep deferred-planning, §F5/F8 (transaction capture, wrapper error-masking).
- `docs/dossier/INDEX.md` — cross-domain constraint log ([backup→data] uid+modified_at; [ai→fields] share_with_ai; [crud→fields] display_order; [data→dashboard] WHERE last_contact IS NOT NULL).
- `HANDOFF.md` §3 (data layer / user_version / forward-only-irreversible), §14 (custom-fields tables), §15 #3 (First moves).
- `CLAUDE.md` — data-layer rules + custom-fields invariants.
- `docs.expo.dev/versions/latest/sdk/sqlite` — current SDK 57 API (WebFetch this session): `SQLiteProvider`/`useSQLiteContext`, `migrateDbIfNeeded`+`user_version` example, `openDatabaseAsync`, `execAsync`/`runAsync`/`getAllAsync`/`getFirstAsync`/`getEachAsync`, `withTransactionAsync`/`withExclusiveTransactionAsync`, PRAGMA WAL/foreign_keys.
- Existing `src/types.ts` (`calculateStatus`, `FREQUENCY_DAYS`, `OrbitStatus`) and `src/utils/dates.ts` (`formatLocalDate`) — read this session.

### Secondary (MEDIUM confidence)
- Live tool checks this session: `node:sqlite` bundles SQLite 3.51.2, window functions + localtime OK (Node 22.22.2); `better-sqlite3` 13.0.3 on npm; `expo-sqlite ~57.0.1` in package.json.
- `~/projects/Orbit/src/services/OrbitIndex.ts` (`statusOrder` sort) and `ContactManager.ts` (operation shapes) — read in place, vault→SQL rewrite.

### Tertiary (LOW confidence)
- None. All load-bearing claims trace to a dossier `[DECIDED]` entry, official docs, or a live tool check.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — expo-sqlite already installed + version-confirmed; API re-verified against official docs.
- Schema (DDL): HIGH — every column traces to a `[DECIDED]` dossier entry; one flagged ambiguity (fuel table, A1/Q1) requires owner confirmation before freeze.
- Platform hazards / pitfalls: HIGH — first-hand-verified in dossier F5/F8/F15/F16.2, consistent with official docs.
- Status/DAO/sweep patterns: HIGH — synthesised from decided constraints; concrete code provided.
- On-device `localtime` behaviour: MEDIUM — verified on glibc + Node's SQLite, on-device Android/bionic probe still owed (P6, folded into DATA-07).

**Research date:** 2026-08-14
**Valid until:** ~2026-09-13 (30 days — expo-sqlite/SDK 57 is stable; re-verify if the project bumps Expo SDK). The migration-1 schema, once shipped, is permanent regardless of this window.
