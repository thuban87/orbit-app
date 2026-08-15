# Phase 3: Custom Fields - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 14 new (11 data/service, 3 UI) + integration touch on `App.tsx`/launch wiring
**Analogs found:** 12 / 14 (2 UI files have partial/rewrite-only analogs)

All analogs were read in place on disk (not from a diff or summary). Line numbers below are verified
against the current files.

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/db/reserved-columns.ts` | data / config const | transform (pure) | `src/db/migrations/001-initial.ts` (the fixed-column source) | role-match (const set derived from schema) |
| `src/db/col-name.ts` | data / utility | transform (pure) | plugin `~/projects/Orbit/src/schemas/loader.ts:36` `keyToLabel` (salvage) | partial (inverse direction; ~9 lines) |
| `src/db/field-defs-dao.ts` | data / DAO | CRUD | `src/db/recency-dao.ts` | exact (DAO + `inWriteTransaction`) |
| `src/db/field-ddl.ts` | data / DAO | CRUD + DDL (transactional) | `src/db/recency-dao.ts` `inWriteTransaction` + `src/db/migrations/runner.ts` BEGIN/COMMIT/ROLLBACK | exact |
| `src/db/field-values-dao.ts` | data / DAO | CRUD (dynamic cols) | `src/db/recency-dao.ts` (UPSERT/read) + `src/db/queries.ts` (dynamic SELECT shape) | exact |
| `src/db/field-parsers.ts` | data / utility | transform (pure) | RESEARCH §Code Examples (§14.4 verbatim); no in-repo analog | role-match (pure fn map, `status.ts` const style) |
| `src/db/field-sort.ts` | data / utility | transform (pure) | `src/db/status.ts` / `src/db/queries.ts` (SQL-constant + interpolation-discipline style) | role-match |
| `src/db/field-type-change.ts` | service/data | request-response (read-only preflight) + CRUD (apply txn) | `src/db/recency-dao.ts` (txn) + `src/db/queries.ts` (read scan) | role-match |
| `src/services/field-sweep.ts` | service | event-driven (launch hook) | `src/services/launch-sweep.ts` (`registerSweepHook`) + `src/db/recency-dao.ts` (txn) | exact (this is the DATA-06 registry's intended consumer) |
| `src/db/*.test.ts` (8 files) | test | — | `src/db/recency-dao.test.ts`, `src/db/queries.test.ts` (node:sqlite via `__testkit__`) | exact |
| `src/components/FieldEditor.tsx` | component | request-response (form) | plugin `~/projects/Orbit/src/components/FormRenderer.tsx` (REWRITE, RN primitives) + `src/screens/HomeScreen.tsx` (theme-token style) | partial (dispatch/validation port; DOM dropped) |
| `src/components/field-widgets/*` | component | request-response | plugin `FormRenderer.tsx` `renderField` switch (rewrite) + `HomeScreen.tsx` (tokens) | partial |
| `src/screens/CustomFieldsScreen.tsx` | screen | request-response | `src/screens/HomeScreen.tsx` (only screen; `useTheme` pattern) | role-match (thin analog) |
| `src/stores/field-defs-store.ts` (optional) | store | event-driven | `src/stores/theme-store.ts` (Zustand `create`) | role-match |

---

## Pattern Assignments

### `src/db/field-ddl.ts` (data, transactional DDL) — FLD-02/03/05

**Analog:** `src/db/recency-dao.ts` (the `inWriteTransaction` helper + `withMutex`) and
`src/db/migrations/runner.ts` (the canonical BEGIN/COMMIT/ROLLBACK-preserving-original-error shape).

**Copy the txn helper verbatim** — `src/db/recency-dao.ts:198-213`:
```ts
function inWriteTransaction<T>(exec: SqlExecutor, body: () => Promise<T>): Promise<T> {
  return withMutex(async () => {
    await exec.execAsync("BEGIN");
    try {
      const value = await body();
      await exec.execAsync("COMMIT");
      return value;
    } catch (error) {
      await exec.execAsync("ROLLBACK").catch(() => {}); // best-effort; preserve original
      throw error;
    }
  });
}
```
The field DDL ops (createField / renameField / dropField) each wrap their body in this exact helper.
DO NOT use expo `withTransactionAsync` — `runner.ts:14-17` and `recency-dao.ts:27-31` both document
why (P3 masks the real error, P4 deferred BEGIN captures headless writes).

**Imports pattern** (from `recency-dao.ts:52-53`):
```ts
import { withMutex } from "@/db/mutex";
import type { SqlExecutor } from "@/db/types";
```

**Identifier interpolation rule** (the ONE place a non-`?` value enters SQL): only the
whitelist-constructed `col_name` is interpolated, double-quoted; every user value is `?`-bound.
Mirror `runner.ts:52-54`'s guard-then-interpolate discipline (there, the integer version; here, the
slug). Create op body (from RESEARCH Pattern 1, §14.1):
```ts
await exec.runAsync(`INSERT INTO custom_field_defs (uid, col_name, label, type, options, ...) VALUES (?,?,?,?,?, ...)`, [...]);
await exec.execAsync(`ALTER TABLE contact_custom_values ADD COLUMN "${col}" TEXT`); // col is [a-z_][a-z0-9_]*, reserved-checked
```

**Drop/quarantine-expiry order** (Pitfall 1): snapshot to `field_history` BEFORE `DROP COLUMN`,
`DELETE def` + `DROP COLUMN` both explicit in one txn (§14.5 — CASCADE deletes rows, never columns).

---

### `src/db/field-defs-dao.ts` (data, CRUD) — FLD-03 reorder / metadata

**Analog:** `src/db/recency-dao.ts` — same exported-async-fn-taking-`(exec, input)` shape, same
`inWriteTransaction`, same `changes !== 1 → throw` loud-failure guard (`recency-dao.ts:263-267`).
Metadata-only edits (label rename, reorder `display_order`, type/options UPDATE) are pure
`UPDATE custom_field_defs` — reuse the txn helper only for batch atomicity.

**Loud-failure guard to copy** (`recency-dao.ts:263-267`):
```ts
if (result.changes !== 1) {
  throw new Error(`renameField: no def matched id=${id} (changed ${result.changes})`);
}
```

---

### `src/db/field-values-dao.ts` (data, dynamic CRUD) — FLD-07

**Analog:** dynamic SELECT shape from RESEARCH §"Dynamic value read"; interpolation discipline from
`src/db/queries.ts:9-13` (only static fragments + whitelisted col_names interpolated; every runtime
value `?`-bound). UPSERT from Pitfall 3:
```ts
INSERT INTO contact_custom_values (contact_id, uid, modified_at, "<col>") VALUES (?,?,?,?)
  ON CONFLICT(contact_id) DO UPDATE SET "<col>"=excluded."<col>", modified_at=excluded.modified_at
```
Always bump `modified_at` (newest-wins merge dependency, per `recency-dao.ts` timestamp contract and
`database.ts:45-50` `localDateTime()`).

---

### `src/db/field-sort.ts` (data, pure) — FLD-06

**Analog:** `src/db/status.ts` / `src/db/queries.ts` — the "SQL string built from code-constants only,
runtime values `?`-bound" convention (`queries.ts:9-13`). `sortExpr` is the SOLE TEXT-leak point;
implement §14.2 verbatim (number→`CAST(col AS REAL)`, toggle→`CAST(col AS INTEGER)`, date/else→col).
Never build a second interpolation site — filters reuse this expression.

---

### `src/db/field-parsers.ts` (data, pure) — FLD-04

**Analog:** no in-repo functional analog; follow the const-map style of `src/db/status.ts` and the
7-parser code in RESEARCH §Code Examples (permissive, one per TARGET type, returns `{ok:false}` to
FLAG, never throws/clears). `FieldType` is the enum from `src/schemas/types.ts:20-27` (7 values).
Canonical storage forms: toggle `"1"`/`"0"`, date `YYYY-MM-DD` (so `sortExpr` CASTs sort correctly).

---

### `src/db/col-name.ts` (data, pure) — FLD-02

**Analog:** salvage ONLY `keyToLabel` from plugin `~/projects/Orbit/src/schemas/loader.ts:36-38`:
```ts
function keyToLabel(key: string): string {
  const words = key.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
```
This phase needs the INVERSE (`slugify(label) → col_name`), plus `makeColName(label, existing)` that
uniquifies against `RESERVED_COLUMN_NAMES` + existing col_names (RESEARCH Pattern 3). Do NOT port the
rest of `loader.ts` (Obsidian markdown, all dead). `col_name` is a STABLE internal slug (CONTEXT
sub-decision) — rename edits `label` only.

---

### `src/db/reserved-columns.ts` (data, const) — FLD-02

**Analog / source of truth:** `src/db/migrations/001-initial.ts:61-153`. The reserved set must be
⊇ the actual columns of `contacts` (`001-initial.ts:61-82`) and `contact_custom_values`
(`001-initial.ts:148-153`: `contact_id, uid, modified_at` + sqlite rowid aliases). A co-located
node:sqlite test asserts `RESERVED_COLUMN_NAMES ⊇ PRAGMA table_info(...)` so the whitelist can't drift
from the schema. Leaf module: Phase 4 imports the const, never the reverse.

---

### `src/services/field-sweep.ts` (service, launch hook) — FLD-05

**Analog:** `src/services/launch-sweep.ts` — this is the exact consumer the empty registry
(`launch-sweep.ts:41-47`) was built for. Register via `registerSweepHook(fn)`; hooks must be
idempotent (the runner may re-run — `launch-sweep.ts:71-90`).

**Hook body** combines the sweep registry with the DDL txn pattern (RESEARCH Pattern 2): each stale def
gets its OWN `withMutex` txn (one failed drop can't wedge the rest), snapshot-before-drop, then a
separate `field_history` prune. Window is a top-of-file constant:
```ts
export const QUARANTINE_WINDOW_DAYS = 30; // FIXED (owner 2026-08-14) — not user-configurable
```
Date math uses SQL `date('now','localtime','-30 days')` (never `toISOString`) per `database.ts:41-50`
and `dates.ts`. Register from an effect AFTER migration resolves, never at module top-level
(`launch-sweep.ts:12-18`, P5).

---

### `src/db/*.test.ts` (tests) — all FLDs

**Analog:** `src/db/recency-dao.test.ts` and `src/db/queries.test.ts`. Harness from
`src/db/__testkit__/node-sqlite.ts`: `openTestDb()` + `nodeSqliteExecutor(db)`. Run the real
`migration001` `CREATE_STATEMENTS` (`001-initial.ts:182-194`) to build the schema, then exercise the
DDL. `--experimental-sqlite` is a warning only. Command: `npx vitest run src/db/<file>.test.ts`.
For the sweep test, inject the clock (30-day window on an injected `now`).

---

### `src/components/FieldEditor.tsx` + `field-widgets/*` (UI) — REWRITE

**Analog (rewrite, do not port):** plugin `~/projects/Orbit/src/components/FormRenderer.tsx`. Keep the
`switch (field.type)` dispatch (`renderField`, `FormRenderer.tsx:90-247`) and `buildInitialState`
(`:31-48`) / validation shape. DROP all React-DOM primitives (`<input>/<select>/<textarea>`,
`className`, `FormEvent`, the `obsidian` `App` import) — replace with RN `TextInput`, `Switch`,
`Modal`+`FlatList` dropdown, `Pressable`. The `photo` widget lands minimal/disabled (CONTEXT: defer
picker to Phase 5). `share_with_ai` toggle deferred to Phase 14 (CONTEXT sub-decision).

**Theme-token style to copy** (`src/screens/HomeScreen.tsx:14-34`): every colour via
`useTheme().colors.*`, styles via `StyleSheet.create`, no hardcoded colours. Available tokens
(`theme-types.ts:30-37`): `background, surface, surfaceElevated, accent, textPrimary, textSecondary,
border, borderStrong`. NOTE: there is no dedicated `error` token — the tap-to-fix error state must be
composed from existing tokens (e.g. `accent`/`borderStrong`) or the owner adds a token at the `--to 3`
gate; flag this for the planner.

---

### `src/screens/CustomFieldsScreen.tsx` (screen) — FLD editor host

**Analog:** `src/screens/HomeScreen.tsx` (the only existing screen) for the `useTheme` + `StyleSheet`
+ `testID`/`accessibilityLabel` shape (for `uiautomator dump` verification at the gate). List defs
(reorder), dynamic Delete/Quarantine action, launch the FieldEditor.

### `src/stores/field-defs-store.ts` (optional store)

**Analog:** `src/stores/theme-store.ts:25-49` — Zustand `create<T>()`. Only add if editor + consuming
screens need shared reactive def state; otherwise read defs on focus. If persisted, this is derived
DB state (NOT the source of truth) — prefer reading the DB.

---

## Shared Patterns

### Hand-rolled transaction (withMutex + BEGIN/COMMIT/ROLLBACK)
**Source:** `src/db/recency-dao.ts:198-213` (helper), `src/db/migrations/runner.ts:56-67` (canonical).
**Apply to:** `field-ddl.ts`, `field-defs-dao.ts`, `field-values-dao.ts`, `field-type-change.ts` apply,
`field-sweep.ts`. NEVER expo `withTransactionAsync`.

### SqlExecutor abstraction
**Source:** `src/db/types.ts` (interface), `src/db/database.ts:57-85` (expo adapter),
`src/db/__testkit__/node-sqlite.ts:30-55` (node adapter).
**Apply to:** every data-layer module — take `exec: SqlExecutor` as first arg, never import expo-sqlite
directly (keeps modules node-testable).

### Injection discipline — only whitelisted identifiers interpolated
**Source:** `src/db/queries.ts:9-13`, `src/db/recency-dao.ts:32-33`.
**Apply to:** `field-ddl.ts`, `field-values-dao.ts`, `field-sort.ts`, `field-type-change.ts`. Every
runtime VALUE is `?`-bound; the ONLY interpolated token is a `col_name` that passed the slugifier +
reserved guard, double-quoted.

### Local wall-clock timestamps
**Source:** `src/db/database.ts:41-50` (`localDateTime()`), `src/utils/dates.ts` (`formatLocalDate()`).
**Apply to:** all `modified_at`/`created_at`/`quarantined_at` writes and the 30-day sweep window. Never
`toISOString()`; use `localDateTime()` in JS and `date('now','localtime', ...)` in SQL.

### Launch-sweep hook registration
**Source:** `src/services/launch-sweep.ts:41-47` (`registerSweepHook`).
**Apply to:** `field-sweep.ts` only. Idempotent; registered from an effect after migration, never at
module top-level.

### Theme tokens + testable UI shell
**Source:** `src/screens/HomeScreen.tsx:14-49`.
**Apply to:** `FieldEditor.tsx`, `field-widgets/*`, `CustomFieldsScreen.tsx`. `useTheme().colors.*`,
`StyleSheet.create`, `testID` for `uiautomator` verification. No hardcoded colours.

---

## No Analog Found (planner uses RESEARCH patterns instead)

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/db/field-parsers.ts` | utility | transform | No existing per-type parser; follow RESEARCH §14.4 code (const-map style borrowed from `status.ts`) |
| `src/components/field-widgets/*` (RN 7 widgets) | component | request-response | No RN form widget exists in this repo; the plugin's `renderField` is DOM and must be fully rewritten — dispatch structure ports, primitives do not. No RN-component test harness exists (verified at `--to 3` gate) |

---

## Metadata

**Analog search scope:** `src/db/`, `src/services/`, `src/screens/`, `src/stores/`, `src/theme/`,
`src/schemas/`, `~/projects/Orbit/src/components/`, `~/projects/Orbit/src/schemas/`
**Files scanned:** 14 read in full (mutex, database, launch-sweep, runner, 001-initial, recency-dao,
queries, schemas/types, node-sqlite testkit, HomeScreen, theme-store, theme/index, theme-types,
plugin FormRenderer + loader excerpts)
**All CONTEXT `[DECIDED]` resolutions honored:** type change = defs.type UPDATE only (no value rewrite);
col_name = stable slug; photo widget + share_with_ai deferred; quarantine = 30d fixed constant. No
recorded decision reversed.
**Pattern extraction date:** 2026-08-14
</content>
</invoke>
