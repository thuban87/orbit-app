# Phase 2: Data Foundation & Status Engine - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 13 new files (8 source + 5 test) + 1 modified (App.tsx) + 1 modified (package.json)
**Analogs found:** 9 / 15 (6 have NO in-codebase analog — this is greenfield SQLite plumbing)

> **Headline finding — the strongest claimed analog does NOT transfer.** The task brief names
> `~/projects/quest-board-app` as "also RN/Expo on expo-sqlite ... find its migration runner
> (`user_version` pattern)." **That runner does not exist.** quest-board is a **Supabase/Postgres**
> app; its only use of `expo-sqlite` is `require("expo-sqlite/localStorage/install")` — a
> `localStorage` polyfill for Supabase auth token storage (`apps/mobile/src/lib/storage-polyfill.ts`
> lines 1-9). Its migrations live in `supabase/migrations/` (server-side SQL, a backend Orbit has
> **rejected**). There is **no `openDatabaseAsync`, no `PRAGMA user_version`, no `migrateDbIfNeeded`
> anywhere in quest-board** (verified: `grep -rl user_version` and `openDatabaseAsync` both empty).
> Its `reference/src/utils/columnMigration.ts` "migration" is Obsidian-vault frontmatter rewriting,
> not schema versioning. **Do NOT copy a migration runner from quest-board — there is none, and the
> RESEARCH-mandated hand-rolled crash-safe runner (§Code Example 1) is authoritative.** quest-board
> contributes exactly one transferable micro-pattern: the `AppState.addEventListener("change")`
> lifecycle shape for DATA-06 (see Shared Patterns). Everything else about it is a non-analog, and
> its monorepo layout (`apps/mobile/src/...`) does not transfer to Orbit's flat `src/`.

The real reusable material lives in **`src/` (this repo, Phase 1)** and the **Orbit plugin
(`~/projects/Orbit`)**. The net-new work is SQLite plumbing done correctly; the pure logic, date fix,
and sort order already ship.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/database.ts` | config/bootstrap | request-response (connection) | RESEARCH §Code Ex 1 (no code analog) | none (research-only) |
| `src/db/migrations/runner.ts` | migration | batch (ordered steps) | RESEARCH §Code Ex 1 (no code analog) | none (research-only) |
| `src/db/migrations/001-initial.ts` | migration | batch (DDL) | RESEARCH §Code Ex 1b DDL | none (research-only) |
| `src/db/mutex.ts` | utility | event-driven (serialization) | RESEARCH §Code Ex 2 (no code analog) | none (research-only) |
| `src/db/recency-dao.ts` | DAO/service | CRUD (transactional write) | `~/Orbit/.../ContactManager.ts` (op shape only) | partial (vault→SQL rewrite) |
| `src/db/status.ts` | service (pure SQL builders) | transform (derive) | `src/types.ts` `calculateStatus`; `~/Orbit/.../OrbitIndex.ts` `statusOrder` | role-match (reuse thresholds + sort) |
| `src/db/queries.ts` | DAO (read helpers) | CRUD (read) | `~/Orbit/.../OrbitIndex.ts` `getContactsByStatus` | partial |
| `src/services/launch-sweep.ts` | service/lifecycle | event-driven (registry) | quest-board `useIdleTimer.ts` (AppState shape); `src/services/AiService.ts` (dormant-module doc convention) | partial |
| `src/db/migrations/runner.test.ts` | test | — | `src/utils/dates.test.ts`, `src/types.test.ts` | exact (harness) |
| `src/db/migrations/001-initial.test.ts` | test | — | same | exact |
| `src/db/recency-dao.test.ts` | test | — | same | exact |
| `src/db/status.test.ts` | test | — | same | exact |
| `src/services/launch-sweep.test.ts` | test | — | `src/services/AiService.test.ts` (global-stub pattern) | exact |
| `App.tsx` (modify) | app entry | lifecycle | current `App.tsx` (add migrate + sweep install) | exact (in-repo) |
| `package.json` (modify) | config | — | current `scripts` block | exact (in-repo) |

## Pattern Assignments

### `src/db/database.ts` (bootstrap) + `src/db/migrations/runner.ts` (migration, batch)

**No code analog exists in either codebase.** quest-board has no SQLite DB layer (see headline). Use
RESEARCH §Code Example 1 (02-RESEARCH.md lines 261-297) verbatim as the pattern. Load-bearing points
the planner must preserve (all traced to `[DECIDED]` dossier + pitfalls P1-P3):

- PRAGMAs (`journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout`) set **before any transaction** —
  FK is a silent no-op inside a txn (P1). RESEARCH lines 274-276.
- Per-step `BEGIN; <DDL>; PRAGMA user_version = N; COMMIT` with `ROLLBACK().catch(()=>{}); throw e` —
  DDL + version bump commit atomically; re-throw the **original** error (P2, P3). RESEARCH lines 282-294.
- **Do NOT use** `withTransactionAsync`/`withExclusiveTransactionAsync` — they mask the original
  error on a throwing rollback (Anti-Patterns, RESEARCH line 198).
- `BUSY_TIMEOUT_MS` and `TARGET_VERSION` are top-of-file tunable constants (CLAUDE.md convention).

**Convention to mirror from this repo:** module doc-comment header stating the phase requirement and
whether the module is live or dormant (see `src/services/AiService.ts` lines 1-16 and
`src/stores/theme-store.ts` lines 1-13 — both open with a `/** ... (REQ-ID) */` block explaining
intent and what was deliberately dropped).

### `src/db/migrations/001-initial.ts` (migration, DDL batch)

**Analog:** RESEARCH §Code Example 1b (02-RESEARCH.md lines 299-419) is the authoritative DDL — every
column traces to a `[DECIDED]` dossier entry. Ship the SQL as a plain string / step fn.

**CONTEXT overrides RESEARCH on the fuel table.** RESEARCH's Open Question Q1 / Assumption A1 (lines
558, 569-582) leaves fuel deferred to Phase 7. **CONTEXT.md lines 42-47 resolve this: the `fuel` table
IS created in migration 1, EMPTY**, with FUEL-01's columns (`uid`, `contact_id` NOT NULL, `kind`,
`label`, `text`, `url`, `created_at`, `source`, `modified_at`). Use the ready DDL in RESEARCH lines
574-582. This is an owner decision (2026-08-14) — do not re-open it.

**Custom-fields carve-in (CONTEXT lines 35-39):** `custom_field_defs` (with `display_order` +
`share_with_ai`), `contact_custom_values`, `field_history` ship here too. Invariants (CLAUDE.md
"Custom fields"): every `contact_custom_values` column is TEXT forever; **never** index or UNIQUE a
value column (breaks Phase-3 `DROP COLUMN`). Note `idx_interactions_recency ON interactions
(contact_id, occurred_at DESC)` (RESEARCH line 371) IS correct and required — the index ban is scoped
to `contact_custom_values` only.

**Un-backfillable column checklist** (CONTEXT lines 18-20, 78-82): every mergeable table carries a
distinct `uid` + `modified_at`; `created_at`, `ring_seq`, interaction `recorded_at`/`source`, defs
`display_order`/`share_with_ai` must all exist from day one. Seeds (categories Family/Friends/Work/
Community display_order 0-3; profile row id=1) run **in the same migration-1 transaction**.

**Date convention:** timestamps written by app code use `formatLocalDate()` from `src/utils/dates.ts`
(lines 17-22) — never `toISOString().split('T')[0]`.

### `src/db/mutex.ts` (utility, serialization) + `src/db/recency-dao.ts` (DAO, transactional CRUD)

**Mutex — no code analog.** Use RESEARCH §Code Example 2 promise-chain mutex (02-RESEARCH.md lines
426-432) verbatim: one module-level `chain`, `withMutex()` runs regardless of prior outcome and never
lets a rejection break the chain. Zero new deps (do not add `async-mutex`).

**DAO operation shapes — partial analog in the Orbit plugin.** `~/projects/Orbit/src/services/
ContactManager.ts` shows the CRUD operation *shapes* to port (vault→SQL rewrite per HANDOFF §4):
`createContact` / `updateFrontmatter` / `appendToInteractionLog` (documented lines 8-10 of that file)
map to the DAO's insert/edit/delete + recompute. The vault mechanics (`app.vault.create`,
`processFrontMatter`, ContactManager.ts lines 119-145) are abandoned — only the operation boundaries
transfer.

The load-bearing DAO structure is RESEARCH §Code Example 2 (lines 434-468). Preserve:
- `recency-dao.ts` is the **ONLY** writer of `contacts.last_contact` (DATA-04, CONTEXT lines 24-26).
- Recompute `last_contact = MAX(occurred_at)` over the contact's **current** rows after every
  insert/edit/delete — last-write-wins on the touched row is WRONG (RESEARCH lines 466-468).
- **Connected-only** MAX for `rarely_responds` contacts: `AND (rarely = 0 OR connected = 1)`
  (RESEARCH lines 442-446; CONTEXT [log→data] scoping).
- Hand-rolled `BEGIN/try/COMMIT/catch ROLLBACK+rethrow` inside `withMutex()` (P3, P4).
- Every value bound with `?` — parameterized (Security V5, RESEARCH line 655).

### `src/db/status.ts` (transform) — REUSE, do not re-derive

**Primary analog: `src/types.ts` (this repo).** The thresholds are already encoded and tested:
- `FREQUENCY_DAYS` (types.ts lines 17-25) and `calculateStatus()` (lines 98-123) encode the
  **80% / 100% buckets** (`daysSince < threshold * 0.8` → stable; `< threshold` → wobble; else decay).
  RESEARCH mandates the SQL thresholds (`0.8 / 1.0 / ROGUE_K`) be a **single shared constant set**
  with the TS side to prevent drift (RESEARCH line 191, 475-477).
- **Do NOT persist** `OrbitContact.status` / `daysSinceContact` (types.ts lines 63-67) as columns —
  they are labelled legacy-compat; Phase 2 is derived-never-stored (CONTEXT lines 100-103).

**Secondary analog: `~/projects/Orbit/src/services/OrbitIndex.ts` `statusOrder` sort** (line 323):
```ts
const statusOrder = { decay: 0, wobble: 1, stable: 2, snoozed: 3 };
return this.getContacts().sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
```
Reusable shape — **extend with `rogue`** for Phase 2. Note the plugin's `OrbitStatus` (types.ts line
30) is `stable|wobble|decay|snoozed` and has **no `rogue`**; the query-time engine adds it as a 4th
threshold (`>= ROGUE_K × interval`) plus the `rarely_responds` non-time path.

**SQL body — RESEARCH §Code Example 3** (02-RESEARCH.md lines 477-513). Preserve `date('now',
'localtime')` on both sides of the julian-day diff (day-granular at local midnight, P6); export SQL as
**string constants** so they are testable node-side without the expo wrapper (Validation §Tier A).

### `src/db/queries.ts` (read DAO)

Analog: `~/projects/Orbit/src/services/OrbitIndex.ts getContactsByStatus()` (line 322-327, the sort
shape above). Pattern body from RESEARCH §Code Example 3: `STATUS_SCAN` uses `WHERE last_contact IS
NOT NULL AND archived_at IS NULL` (never-contacted + archived exclusion, [data→dashboard], RESEARCH
lines 495-499); `NEWEST_PER_CONTACT` uses the `ROW_NUMBER() OVER (PARTITION BY contact_id ORDER BY
occurred_at DESC, id DESC)` window form (lines 504-512).

### `src/services/launch-sweep.ts` (lifecycle service)

**AppState shape — partial analog: quest-board `apps/mobile/src/hooks/useIdleTimer.ts` lines 60-83**
(the one thing that transfers from quest-board):
```ts
const handleAppState = (nextState: AppStateStatus) => {
  if (nextState !== "active") { /* background */ } else { /* foreground */ }
};
const subscription = AppState.addEventListener("change", handleAppState);
return () => { subscription.remove(); };
```
Mirror the `addEventListener("change") → check "active" → return remover` lifecycle. **Body from
RESEARCH §Code Example 4** (02-RESEARCH.md lines 515-539): `hooks: SweepHook[]` registry (empty in P2),
idempotent `running` guard, `installSweepTrigger()` called from the App component effect — **never
module top-level** (P5, headless taps must not trigger it; CONTEXT line 84-86).

**Dormant-module doc convention: `src/services/AiService.ts` lines 1-16** — open with a `/** ... */`
block naming the requirement and stating the module is plumbing wired to nothing yet ("Dormant this
phase ... It must compile and typecheck; it is not invoked at runtime yet"). The empty hook registry
should carry the same explicit "empty in P2, later phases register" note.

### Test files (`*.test.ts`) — exact in-repo harness analog

**Analog: `src/utils/dates.test.ts` (lines 1-25) and `src/types.test.ts`.** Structure: `/** Unit
tests for X */` header, `import { describe, expect, it } from "vitest"`, `@/`-aliased import of the
unit under test, `describe`/`it` blocks. Config is already wired (`vitest.config.ts`: node env,
globals on, `include: ["src/**/*.test.ts"]`, `@` → `./src` alias, `passWithNoTests`).

**Node-side SQL harness (new):** Tier A tests open an in-memory `node:sqlite` DB and apply migration 1
as a fixture (RESEARCH Validation §Tier A, lines 616-617; Wave-0 gap line 641). `node:sqlite` is
built-in (SQLite 3.51.2, needs `--experimental-sqlite`) — zero new deps. Because the expo async API
does not run under Node, SQL must be exported as **string constants / pure builders** to be testable.

**`launch-sweep.test.ts` analog: `src/services/AiService.test.ts` lines 20-33** — the
`vi.stubGlobal` / `beforeEach`/`afterEach` `vi.unstubAllGlobals()` pattern for stubbing runtime
globals (there `fetch`; here `AppState`).

### `App.tsx` (modify) — exact in-repo analog (itself)

Current `App.tsx` (lines 12-21) is the thin shell wrapping `SafeAreaProvider > ThemeProvider >
HomeScreen`. Add: run `openAndMigrate()` before first render (a gating effect / loading state) and
call `installSweepTrigger()` from an effect (NOT module scope). Keep the existing doc-comment
convention (lines 6-11).

### `package.json` (modify)

Current `scripts` block has no `test` script (only `check:colors`). RESEARCH Wave-0 gap (line 642)
requires adding one, e.g. `"test": "vitest run"`. Preserve the existing script entries.

## Shared Patterns

### Module doc-comment header (applies to ALL new source files)
**Source:** `src/services/AiService.ts` lines 1-16; `src/stores/theme-store.ts` lines 1-13; every
`src/**/*.ts` in this repo. Open with a `/** ... (REQ-ID) */` block naming the requirement, stating
whether the module is live or dormant, and what was deliberately dropped. This is a firm repo
convention — not decorative.

### Hand-rolled transaction wrapper (applies to `runner.ts` + `recency-dao.ts`)
**Source:** RESEARCH §Code Example 1 lines 284-292 / §Code Example 2 lines 454-464 (no code analog).
```ts
await db.execAsync('BEGIN');
try { /* work */ ; await db.execAsync('COMMIT'); }
catch (e) { await db.execAsync('ROLLBACK').catch(() => {}); throw e; }
```
**Apply to:** the migration runner AND the recency DAO. Never the expo `withTransactionAsync`
wrappers (they mask the original error — P3).

### Local-date discipline (applies to any file writing a timestamp)
**Source:** `src/utils/dates.ts` `formatLocalDate()` (lines 17-22). SQL side: `date('now',
'localtime')`. **Never** `toISOString().split('T')[0]` (TS) or `date('now')` (SQL) — UTC off-by-one,
already fixed once in the plugin (CLAUDE.md convention; CONTEXT lines 76-77).

### Parameterized queries (applies to `recency-dao.ts` + `queries.ts`)
**Source:** Security V5 (RESEARCH line 655). Bind every user value with `?`. The only interpolated
token permitted is the integer `PRAGMA user_version = N` (a code constant, never user input). Sets the
precedent for Phase-3 whitelist-**constructed** `col_name` (never escaped).

### AppState foreground gating (applies to `launch-sweep.ts` + `App.tsx`)
**Source:** quest-board `useIdleTimer.ts` lines 73-83 (lifecycle shape) + RESEARCH §Code Example 4.
Trigger only on a real `background → active` transition and cold-start foreground; return the
subscription remover for cleanup. Never at module scope.

### Tunable constants at top-of-file (applies to `database.ts`, `status.ts`)
**Source:** CLAUDE.md convention. `BUSY_TIMEOUT_MS`, `TARGET_VERSION`, `STABLE_MAX`, `WOBBLE_MAX`,
`ROGUE_K` are single-number edits at the top of their file.

## No Analog Found

Files whose core pattern has NO precedent in either codebase — planner uses RESEARCH sections (all
concrete code provided there), not a code analog:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/db/database.ts` | bootstrap | connection | No SQLite DB layer exists anywhere. quest-board uses expo-sqlite only as a localStorage polyfill (`storage-polyfill.ts` lines 1-9). Use RESEARCH §Code Ex 1. |
| `src/db/migrations/runner.ts` | migration | batch | **No `user_version` runner exists in quest-board** (grep confirmed empty). quest-board's migrations are Supabase/Postgres (a rejected backend). Hand-roll per RESEARCH §Code Ex 1; the docs `migrateDbIfNeeded` example is NOT crash-safe. |
| `src/db/migrations/001-initial.ts` | migration | DDL | Greenfield schema; DDL is RESEARCH §Code Ex 1b (+ CONTEXT fuel override). |
| `src/db/mutex.ts` | utility | serialization | No concurrency primitive exists. RESEARCH §Code Ex 2. |
| `src/db/queries.ts` (SQL bodies) | DAO | read | Only the sort *shape* (Orbit `statusOrder`) transfers; the SQL is net-new (RESEARCH §Code Ex 3). |

## Metadata

**Analog search scope:** `src/` (this repo, all dirs), `~/projects/quest-board-app` (apps/mobile/src,
reference/, supabase/migrations, storage-polyfill), `~/projects/Orbit/src/services` (OrbitIndex.ts,
ContactManager.ts).
**Files scanned:** ~18 (types.ts, dates.ts, logger.ts, theme-store.ts, AiService.ts+test, ai-types.ts,
App.tsx, vitest.config.ts, dates.test.ts; quest-board storage-polyfill, columnMigration, useIdleTimer,
migration greps; Orbit OrbitIndex, ContactManager).
**Key correction vs. task brief:** quest-board is NOT an expo-sqlite migration-runner analog — it has
no such runner and uses a rejected server backend. The hand-rolled crash-safe runner in RESEARCH is
authoritative and must not be replaced by any quest-board pattern.
**Pattern extraction date:** 2026-08-14
