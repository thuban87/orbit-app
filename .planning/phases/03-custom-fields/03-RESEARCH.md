# Phase 3: Custom Fields - Research

**Researched:** 2026-08-14
**Domain:** Runtime transactional DDL on on-device SQLite (expo-sqlite 57 / SQLite 3.50.x), dynamic query layer, schema-driven RN form editor
**Confidence:** HIGH (design is `[DECIDED]`; DDL behavior empirically verified; one spec-conflict flagged for owner)

## Summary

This phase implements the HANDOFF §14 custom-fields subsystem on top of the three empty tables Phase 2 already created (`custom_field_defs`, `contact_custom_values`, `field_history` in `001-initial.ts`). Nothing here is a schema *migration* — custom fields are managed at **runtime** by the user via transactional DDL (`ALTER TABLE contact_custom_values ADD/RENAME/DROP COLUMN`), each op a hand-rolled `BEGIN/COMMIT/ROLLBACK` transaction wrapped in the shared `withMutex` so it serializes with the DATA-04 recency writers. **No new npm dependency is required** — the whole phase is built from expo-sqlite (already present), the `node:sqlite` testkit (already present), and existing helpers (`withMutex`, `registerSweepHook`, `formatLocalDate`, theme tokens).

The load-bearing SQLite facts were verified live against `node:sqlite` 3.51.2 (the exact harness `src/db/__testkit__/node-sqlite.ts` uses): `ALTER TABLE ADD/RENAME/DROP COLUMN` are all fully transactional (a rolled-back `ADD COLUMN` leaves the table unchanged; `DROP COLUMN` on an indexed column throws — confirming the §14.11 no-index invariant is a hard requirement, not a style choice). On-device expo-sqlite bundles SQLite 3.50.x; `RENAME COLUMN` needs 3.25+ (2018) and `DROP COLUMN` needs 3.35+ (2021), so both are comfortably supported on device and in tests.

**One genuine spec conflict must be resolved before planning FLD-04** (type change): §14.2 + CLAUDE.md say a type change is "one UPDATE on one row in `custom_field_defs` … no column touched, blast radius zero … must not touch `contact_custom_values` at all," while §14.4/§14.6/FLD-04 say clean values "convert automatically" and are "snapshotted to `field_history` in the same transaction." Those cannot both be literally true if conversion rewrites values. See **Open Questions #1** — this is an owner/planner decision, not a researcher call. The recommended reconciliation (values are never rewritten; parsing is read-time; the type-change txn snapshots the *flagged* values for audit/undo) honors every non-negotiable invariant, but it changes what FLD-04's snapshot captures, so it needs sign-off.

**Primary recommendation:** Build the data layer first as pure/`node:sqlite`-testable modules (slugifier + reserved-column guard, the three DDL ops, the 7 parsers, `sortExpr`, the type-change pre-flight, the quarantine/history sweep hook), prove every invariant with node-side tests, then layer a thin theme-tokened RN field editor on top. Add no dependencies; defer the `photo` field's native picker to reuse Phase 5's pipeline.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**The §14 design is `[DECIDED]` — enforce it, do not redesign.** The invariants an agent is most likely to break (CLAUDE.md "Custom fields — invariants", NON-NEGOTIABLE):
- **Two tables; the same field is a ROW in `custom_field_defs` and a COLUMN in `contact_custom_values`.** Say "custom field," never "custom column."
- **Every `contact_custom_values` column is declared TEXT, forever** (§14.2). Never declare INTEGER/REAL/BOOLEAN.
- **Field type lives in `custom_field_defs.type` and drives the UI widget only** — storage type (TEXT) and field type are different concepts. A type change touches `contact_custom_values` NOT at all.
- **Route every sort/filter through the single `sortExpr()` helper** (§14.2) — the ONLY place the TEXT decision is observable. `sortExpr`: number→`CAST(col AS REAL)`, date→col (ISO sorts as text), toggle→`CAST(col AS INTEGER)`, else→col. Never interpolate a custom column name into ORDER BY / comparison directly.
- **Never index or add UNIQUE to a `contact_custom_values` value column** (§14.11) — `DROP COLUMN` fails on indexed/UNIQUE/view/generated columns, and quarantine expiry requires DROP.
- **Type changes never destroy data** — 7 parsers, one per TARGET type (not 42 pairwise). Values that fail the target parser are flagged + rendered as an error state on the profile, never coerced/cleared. Write parsers PERMISSIVELY. NO "run the conversion?" confirmation (§14.4).
- **Every destructive op snapshots to `field_history` inside the SAME transaction** (§14.6).
- **Deleting a defs row does NOT drop a column** — `ON DELETE CASCADE` deletes rows, never columns. Both statements explicit in ONE transaction (§14.5).
- **`col_name` is whitelist-CONSTRUCTED, never escaped** — salvage `keyToLabel()`/`labelToKey` (~9 lines) from the plugin's `loader.ts`; the slugifier is the single producer and reserves the ENTIRE fixed-column name set.
- **Nothing watches a timestamp** — quarantine expiry + history retention run as a SWEEP at app launch (register a hook into Phase 2's `registerSweepHook`), never a timer/trigger.

**Owner decision (2026-08-14) — quarantine window:** the quarantine + `field_history` retention window is **30 days, FIXED** — a single top-of-file tunable constant, NOT user-configurable (no settings surface).

**Where fields appear (§14.7):** New contact form = per-field `show_on_new` (curated). Edit form = EVERY non-quarantined field, NO config. Profile = automatic whenever a field has a value + one global `always_show` flag per field. `[DECIDED-dropped]` per-profile view options; `[DECIDED-declined]` per-profile exceptions — do not build them.

### Claude's Discretion

Field-editor UI layout/visual polish (functionally specified by §14; owner reviews at the `--to 3` gate — no hardcoded colours, theme tokens). Module layout under `src/db/`/`src/components/`/`src/screens/`. The parser implementations (permissive, per §14.4).

### Deferred Ideas (OUT OF SCOPE)

- Contact CRUD/forms shell → Phase 4 (custom-field sections plug into it); `contact_links`, archive/restore.
- Photos pipeline → Phase 5 (a `photo` custom field reuses it).
- Per-profile field view options / per-profile exceptions to a global field → `[DECIDED-dropped/declined]`, never build.
- User-configurable quarantine window → v2 (owner chose fixed 30 days for v1).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FLD-01 | *(infra)* Tables created (done Phase 2); this phase wires def/values/history operations | Tables verified present in `001-initial.ts`; this phase adds runtime DDL + DAOs, no migration |
| FLD-02 | Create a custom field from settings; `INSERT def + ALTER ADD COLUMN` in one txn; `col_name` whitelist-constructed, can't collide with a fixed column | Transactional `ADD COLUMN` verified; slugifier + reserved-set design in Architecture Patterns; empirically confirmed rollback-on-fail |
| FLD-03 | Rename (metadata-only `RENAME COLUMN`), reorder (`display_order`), change type/options | `RENAME COLUMN` verified transactional; reorder = pure UPDATE; **rename raises a `field_history` drift question — see Open Questions #2** |
| FLD-04 | Type change: pre-flight through target parser, auto-convert clean, flag unconvertible as tap-to-fix, destroy no data, snapshot in same txn, no confirmation | 7-parser design + pre-flight partitioning; **spec conflict on whether values are rewritten — Open Questions #1 (owner decision)** |
| FLD-05 | Delete = dynamic (empty→Delete, else→Quarantine, reversible ~30d); launch sweep expires (`DELETE def + DROP COLUMN` one txn) + prunes history on 30-day schedule | Dynamic-action design; sweep-hook registration into `registerSweepHook`; `DROP COLUMN` verified; 30-day fixed constant |
| FLD-06 | *(infra)* Every sort/filter routes through single `sortExpr()`; no value column indexed/UNIQUE | `sortExpr` from §14.2 verbatim; DROP-on-indexed-column failure verified (enforces the ban) |
| FLD-07 | Field shows on profile when it has a value (or always if `always_show`); create form shows only `show_on_new`; edit form shows every non-quarantined field | Dynamic query layer reads defs → forms/profile sections; pure read logic |
</phase_requirements>

## Architectural Responsibility Map

Tiers for this local-first RN app: **UI** (`src/screens`, `src/components`) · **Service** (`src/services`, pure business logic) · **Data** (`src/db` — DAOs, DDL ops, query builders) · **Storage** (on-device SQLite).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Field definition create/rename/reorder/retype/delete (DDL) | Data (`src/db`) | UI (settings screen) | DDL + `custom_field_defs` writes are pure data-layer, `withMutex`-serialized; UI only dispatches |
| `label → col_name` slugify + reserved-column guard | Data | — | The single producer of `col_name`; a leaf module Phase 4 imports (no circular dep) |
| Custom-value read/write per contact | Data | — | Dynamic `SELECT`/`UPSERT` on `contact_custom_values`, col names whitelist-interpolated |
| The 7 type parsers | Data or Service (pure) | — | Pure `string → parsed` functions; live beside the DDL so pre-flight and read-time render share them |
| Type-change pre-flight (partition convert/flag) | Service | Data | Reads all values, runs target parser, produces the summary; the write (if any) is a Data txn |
| `sortExpr()` | Data | — | The sole place TEXT storage leaks; consumed by every sort/filter query |
| Quarantine expiry + history retention sweep | Service (launch-sweep hook) | Data (the DDL txn) | Registered via `registerSweepHook`; the hook calls Data-tier DROP/prune ops |
| Field editor screen + dynamic form/profile renderers | UI | Data (reads defs) | Rewrite of the plugin `FormRenderer` against RN primitives; theme-tokened |
| Error-state rendering for flagged values | UI | — | Reads the flagged state (parser-fail at read time), renders tap-to-fix |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-sqlite` | ~57.0.1 (installed) | On-device SQLite; bundles SQLite 3.50.x; async API used through the existing `SqlExecutor` adapter | Already the project's data layer (DATA-01); ADD/RENAME/DROP COLUMN all supported [VERIFIED: node:sqlite 3.51.2 + expo-sqlite bundled 3.50.x ≥ 3.35] |
| `node:sqlite` | Node built-in (3.51.2) | Test-only harness for every SQL string and DDL op | Already wired (`__testkit__/node-sqlite.ts`); zero new deps; runs the exact DDL the device runs [VERIFIED: live run] |
| `vitest` | ^4.1.10 (installed) | Test runner (`npm test` → `vitest run`) | Existing test infra; `--experimental-sqlite` surfaces as a warning only |
| React Native primitives | RN 0.86.2 (installed) | `TextInput`, `Switch`, `FlatList`, `Pressable`, `Modal` for the field editor + dynamic widgets | No new dependency; sufficient for all 7 widgets except a native calendar (optional, deferred) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zustand` | ^5.0.15 (installed) | Field-defs store (list of defs, quarantine state) driving the editor + dynamic renderers | If the editor and consuming screens need shared reactive def state; otherwise read on focus |
| Existing `src/utils/dates.ts` `formatLocalDate()` + `date('now','localtime')` | in-repo | Quarantine 30-day math + `created_at`/`modified_at` stamps | All timestamp writes and the sweep window comparison |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RN-primitive date widget | `@react-native-community/datetimepicker` | Nicer native calendar, but adds a dependency; Phase 4 CRUD forms share the same widget — decide there, keep Phase 3 dependency-free |
| RN-primitive dropdown (modal list) | `@react-native-picker/picker` | Native spinner look, extra dep; a `Modal`+`FlatList` selectable list needs no dep and is themeable |
| Building the `photo` widget now | `expo-image-picker` (Phase 5) | Pulls the photo pipeline forward; defer — the `photo` field *type* can exist with a minimal/disabled widget until Phase 5 ([photos → fields]) |
| `async-mutex` | existing `withMutex` (4-line primitive) | Already rejected in Phase 2; reuse the shared instance so field ops serialize with recency writers |

**Installation:**
```bash
# No new packages. Everything required is already installed.
```

**Version verification:** `expo-sqlite@57.0.1` confirmed in `package.json`; bundled SQLite is 3.50.x (Expo SDK 57). `node:sqlite` reports SQLite `3.51.2` on Node `v22.22.2` [VERIFIED: `select sqlite_version()`]. Both exceed the 3.35 floor for `DROP COLUMN` and 3.25 for `RENAME COLUMN`.

## Package Legitimacy Audit

**No external packages are installed by this phase.** Every capability is built from already-present dependencies (`expo-sqlite`, `node:sqlite`, `vitest`, React Native, `zustand`) and existing in-repo modules.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(none — phase adds no dependencies)* | — | — | — | — | OK | No install |

**Packages removed due to `[SLOP]` verdict:** none
**Packages flagged as suspicious `[SUS]`:** none

If a later planning decision reverses course and pulls `@react-native-community/datetimepicker`, `@react-native-picker/picker`, or `expo-image-picker` into this phase, run the Package Legitimacy Gate on it first. Recommendation is to keep this phase dependency-free.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────── UI (src/screens, src/components) ────────────────────────┐
│  Settings → Custom Fields screen         Dynamic form / profile renderers          │
│   • list defs (reorder)                   • create form  = defs WHERE show_on_new   │
│   • create/edit field editor              • edit form    = all non-quarantined      │
│   • dynamic Delete/Quarantine action      • profile      = value present OR always  │
│   • error-state (tap-to-fix) widgets      • 7 type widgets (text/…/photo*)          │
└───────────────┬───────────────────────────────────┬───────────────────────────────┘
                │ dispatch                            │ read defs + values
                ▼                                     ▼
┌──────────────────────── Data (src/db) ─────────────────────────────────────────────┐
│  slugify(label) → col_name ──guard──► RESERVED_COLUMN_NAMES + existing col_names     │
│                                                                                     │
│  fieldDefsDao        DDL ops (each: withMutex + hand-rolled BEGIN/COMMIT/ROLLBACK)   │
│   INSERT/UPDATE       • create:  INSERT def  + ALTER ADD COLUMN "<col>" TEXT          │
│   display_order       • rename:  UPDATE def  + ALTER RENAME COLUMN (+history sync?)   │
│                       • drop:    snapshot→field_history + DELETE def + DROP COLUMN    │
│  fieldValuesDao       parsers[7]         sortExpr(field)   preflight(field, target)  │
│   UPSERT value         string→parsed      CAST wrap         partition convert/flag    │
└───────────────┬───────────────────────────────────┬───────────────────────────────┘
                │ registerSweepHook(...)              │ SQL via SqlExecutor
                ▼                                     ▼
┌──────── Service (launch-sweep) ────────┐   ┌──────── Storage (SQLite) ──────────────┐
│ hook: expire defs quarantined >30d      │   │ custom_field_defs (1 row / field)      │
│       (DROP COLUMN + snapshot, 1 txn)   │   │ contact_custom_values (1 col / field)  │
│       prune field_history >30d          │   │ field_history (snapshot log)           │
└─────────────────────────────────────────┘   └────────────────────────────────────────┘
* photo widget deferred to Phase 5 pipeline
```

### Recommended Project Structure
```
src/db/
├── reserved-columns.ts        # RESERVED_COLUMN_NAMES const + a test that asserts it == PRAGMA table_info
├── col-name.ts                # slugify(label) → col_name (single producer); labelToKey salvage
├── field-defs-dao.ts          # def CRUD (INSERT/UPDATE/reorder) — no DDL
├── field-ddl.ts               # the 3 transactional DDL ops (create/rename/drop), withMutex-wrapped
├── field-values-dao.ts        # per-contact value read/UPSERT on contact_custom_values
├── field-parsers.ts           # the 7 target-type parsers (pure, permissive)
├── field-sort.ts              # sortExpr(field) — the ONLY TEXT-leak point
├── field-type-change.ts       # pre-flight partition (convert vs flag) + apply
└── *.test.ts                  # node:sqlite tests co-located (existing convention)
src/services/
└── field-sweep.ts             # registerSweepHook: quarantine expiry + history retention (30-day)
src/components/
├── FieldEditor.tsx            # rewrite of plugin FormRenderer dispatch, RN primitives
└── field-widgets/             # 7 widgets (text/textarea/dropdown/date/toggle/number/photo*)
src/screens/
└── CustomFieldsScreen.tsx     # Settings → Custom Fields (list, create, reorder, delete/quarantine)
```

### Pattern 1: Transactional DDL op (shared mutex, hand-rolled txn)
**What:** Every field mutation that changes column structure runs as one hand-rolled transaction inside `withMutex`, never expo's `withTransactionAsync` (Phase 2 pitfall P3/P4 — its deferred `BEGIN` captures unrelated headless writes and its catch discards the real SQL error).
**When to use:** create, rename, drop (quarantine expiry). Reorder and pure metadata updates need a txn only for atomicity of a batch.
**Example (create — FLD-02):**
```ts
// Source: HANDOFF §14.1 + Phase-2 runner.ts BEGIN/COMMIT/ROLLBACK pattern; withMutex from src/db/mutex.ts
// col is whitelist-CONSTRUCTED (see Pattern 3), never user text; identifiers can't be bound, so double-quote it.
export async function createField(exec: SqlExecutor, def: NewFieldDef): Promise<void> {
  const col = def.col_name; // already slugified + reserved-checked + uniquified
  await withMutex(async () => {
    await exec.execAsync("BEGIN");
    try {
      await exec.runAsync(
        `INSERT INTO custom_field_defs
           (uid, col_name, label, type, options, show_on_new, always_show,
            display_order, share_with_ai, created_at, modified_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [def.uid, col, def.label, def.type, def.options, def.show_on_new ? 1 : 0,
         def.always_show ? 1 : 0, def.display_order, def.share_with_ai ? 1 : 0, def.now, def.now],
      );
      // Identifier interpolation is SAFE only because `col` is [a-z_][a-z0-9_]* and reserved-checked.
      await exec.execAsync(`ALTER TABLE contact_custom_values ADD COLUMN "${col}" TEXT`);
      await exec.execAsync("COMMIT");
    } catch (e) {
      await exec.execAsync("ROLLBACK").catch(() => {});
      throw e; // preserve original error, per Phase-2 runner
    }
  });
}
```
[VERIFIED: node:sqlite 3.51.2] A `BEGIN; ALTER TABLE ADD COLUMN; ROLLBACK` leaves the table's columns unchanged; `ADD`+`RENAME` inside one `BEGIN…COMMIT` commit atomically.

### Pattern 2: Quarantine expiry + history retention sweep (FLD-05)
**What:** A hook registered into Phase 2's launch-sweep registry. Snapshots values to `field_history`, then `DELETE def + DROP COLUMN` in one txn; separately prunes `field_history` older than the window.
**When to use:** once per real foreground launch (the registry already guarantees this; hooks must be idempotent).
**Example:**
```ts
// Source: HANDOFF §14.5/§14.6 + src/services/launch-sweep.ts registry
export const QUARANTINE_WINDOW_DAYS = 30; // FIXED (owner 2026-08-14) — not user-configurable

registerSweepHook(async () => {
  const stale = await exec.getAllAsync<{ id: number; col_name: string }>(
    `SELECT id, col_name FROM custom_field_defs
      WHERE quarantined_at IS NOT NULL
        AND quarantined_at <= date('now','localtime', ?)`,
    [`-${QUARANTINE_WINDOW_DAYS} days`],
  );
  for (const d of stale) {
    await withMutex(async () => {
      await exec.execAsync("BEGIN");
      try {
        // snapshot BEFORE the drop — values vanish once the column is gone
        await exec.runAsync(
          `INSERT INTO field_history (contact_id, field_col_name, old_value, operation, created_at)
             SELECT contact_id, ?, "${d.col_name}", 'quarantine_expiry', ?
               FROM contact_custom_values WHERE "${d.col_name}" IS NOT NULL`,
          [d.col_name, nowLocal()],
        );
        await exec.runAsync(`DELETE FROM custom_field_defs WHERE id = ?`, [d.id]);
        await exec.execAsync(`ALTER TABLE contact_custom_values DROP COLUMN "${d.col_name}"`);
        await exec.execAsync("COMMIT");
      } catch (e) { await exec.execAsync("ROLLBACK").catch(() => {}); throw e; }
    });
  }
  // history retention on the SAME 30-day schedule
  await exec.runAsync(
    `DELETE FROM field_history WHERE created_at <= date('now','localtime', ?)`,
    [`-${QUARANTINE_WINDOW_DAYS} days`],
  );
});
```
Each def gets its own `withMutex` txn so one failed drop can't wedge the rest, and each serializes with recency writers.

### Pattern 3: Whitelist-constructed `col_name` (single producer)
**What:** `col_name` is *constructed* from a restricted charset, never escaped from user text. The user label is bound as a parameter for the `label` column; only the generated slug is ever interpolated as an identifier.
**When to use:** every field creation. The slugifier is the *only* producer.
**Example:**
```ts
// Source: HANDOFF §14.1 "whitelist-constructed, never escaped"; keyToLabel salvage from plugin loader.ts:36
const RESERVED_COLUMN_NAMES = new Set([
  // contacts (from 001-initial.ts) — reserve the whole set per CLAUDE.md / [crud → fields]
  "id","uid","name","category_id","interval_days","social_battery","birthday","phone","email",
  "photo","last_contact","favourite_rank","ring_seq","archived_at","snooze_until","rarely_responds",
  "reminders_off","created_at","modified_at",
  // contact_custom_values fixed columns (these are the ones a new col could physically collide with)
  "contact_id","rowid","oid","_rowid_",
]); // sqlite_* names are additionally blocked by the leading-char rule below

export function slugify(label: string): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[a-z]/.test(base) ? base : `f_${base}`; // guarantee [a-z_] start; never a keyword after quoting
}

// Uniquify against reserved names AND already-existing col_names; append _2, _3, …
export function makeColName(label: string, existing: Set<string>): string {
  let c = slugify(label) || "field";
  if (!RESERVED_COLUMN_NAMES.has(c) && !existing.has(c)) return c;
  for (let n = 2; ; n++) { const cand = `${c}_${n}`;
    if (!RESERVED_COLUMN_NAMES.has(cand) && !existing.has(cand)) return cand; }
}
```
Ownership note (avoids the ROADMAP's circular-dependency concern): `reserved-columns.ts` is a **leaf module** owned by Phase 3. Phase 4 imports the const; it never imports back into Phase 3. A co-located test asserts `RESERVED_COLUMN_NAMES` ⊇ the actual `PRAGMA table_info(contacts)` + `contact_custom_values` columns, so the whitelist can't silently drift from the schema.

### Pattern 4: `sortExpr()` — the sole TEXT-leak point (FLD-06)
```ts
// Source: HANDOFF §14.2 (verbatim). Used by EVERY sort and filter on a custom field.
export function sortExpr(field: FieldDef): string {
  const col = `"${field.col_name}"`; // already whitelist-safe; quote defensively
  switch (field.type) {
    case "number": return `CAST(${col} AS REAL)`;
    case "toggle": return `CAST(${col} AS INTEGER)`;
    case "date":   return col;  // ISO YYYY-MM-DD sorts correctly as text
    default:       return col;  // text / textarea / dropdown / photo
  }
}
```
Filters reuse the same expression (a `WHERE CAST(col AS REAL) > ?` numeric filter). Keep one helper; do not build a second interpolation site.

### Anti-Patterns to Avoid
- **Using expo `withTransactionAsync`/`withExclusiveTransactionAsync` for the DDL ops.** Phase 2 rejected it (P3: catch discards the real error; P4: deferred `BEGIN` captures headless writes). Hand-roll `BEGIN/COMMIT/ROLLBACK` and wrap in `withMutex`.
- **Adding an index or UNIQUE to a value column.** [VERIFIED] `DROP COLUMN` then throws `error in index … after drop column`, breaking quarantine expiry. The `uid UNIQUE` autoindex on `contact_custom_values` is exempt (it's not a value column).
- **Interpolating a user label into SQL.** Only the generated slug is interpolated (as a quoted identifier); the label is always a bound parameter.
- **Declaring a value column anything but TEXT**, or writing a per-type pairwise converter (there are 7 parsers, not 42).
- **Rewriting `contact_custom_values` on a type change** (see Open Questions #1 — the dominant invariant forbids it).
- **Implementing quarantine expiry with a timer/`setTimeout`/DB trigger.** Nothing watches a timestamp; it's a launch-sweep sweep only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Serializing field ops with recency writers | A new per-caller mutex or `async-mutex` | The shared `withMutex` (`src/db/mutex.ts`) | One process, one connection — a second mutex reintroduces the capture race |
| Once-per-launch quarantine/history work | A background timer or DB trigger | `registerSweepHook` (`src/services/launch-sweep.ts`) | The DATA-06 registry already guarantees real-foreground-only, idempotent, deferred-not-dropped semantics |
| Local date math for the 30-day window | `toISOString().slice(0,10)` or manual date arithmetic | `date('now','localtime', '-30 days')` in SQL; `formatLocalDate()` in JS | Avoids the UTC evening off-by-one (a bug already fixed once in the plugin) |
| Atomic crash-safe DDL | A custom rollback protocol | Hand-rolled `BEGIN/COMMIT/ROLLBACK` mirroring `runner.ts` | Preserves the original error and leaves the device at a clean state |
| Deriving a label from a key | New string code | Salvaged `keyToLabel()` (plugin `loader.ts:36`) + its inverse `slugify` | ~9 lines, already proven; do NOT port the rest of `loader.ts` (Obsidian markdown, all dead) |

**Key insight:** This phase's correctness lives almost entirely in the data layer, and the data layer already has the exact primitives it needs (`SqlExecutor`, `withMutex`, `registerSweepHook`, the `node:sqlite` harness). The new work is composition + the 7 parsers + a thin UI, not new infrastructure.

## Common Pitfalls

### Pitfall 1: Snapshotting after the DROP instead of before
**What goes wrong:** `field_history` rows come back empty because the column was already gone when the `SELECT` ran.
**Why it happens:** `DELETE def` and `DROP COLUMN` are written first out of habit.
**How to avoid:** Inside the txn, `INSERT INTO field_history SELECT … FROM contact_custom_values` **before** `DROP COLUMN`. Order verified in Pattern 2.
**Warning signs:** A test that quarantine-expires a populated field finds zero history rows.

### Pitfall 2: Index/UNIQUE on a value column silently added by "helpful" optimization
**What goes wrong:** A later performance tweak adds an index on a hot custom column; quarantine expiry then throws at `DROP COLUMN`, and because it's inside the sweep, the failure is invisible until a user's field never expires.
**Why it happens:** Indexing a filtered column is normal instinct; the constraint is non-obvious.
**How to avoid:** Never index a value column. If a filter is slow at tens of contacts (it won't be), the fix is not an index. A co-located test asserts a populated field can always be dropped.
**Warning signs:** `error in index <name> after drop column: no such column` [VERIFIED this is the exact error].

### Pitfall 3: `contact_custom_values` row missing on value write
**What goes wrong:** Writing a custom value for a contact whose `contact_custom_values` row doesn't exist yet is a no-op (`UPDATE … WHERE contact_id=?` affects 0 rows) or FK-fails.
**Why it happens:** The row is one-per-contact keyed by `contact_id`; whoever creates the contact must also create it. Phase 4 owns contact creation.
**How to avoid:** Use an UPSERT (`INSERT INTO contact_custom_values (contact_id, uid, modified_at, "<col>") VALUES (?,?,?,?) ON CONFLICT(contact_id) DO UPDATE SET "<col>"=excluded."<col>", modified_at=excluded.modified_at`). Coordinate with Phase 4 so the row is created with the contact. Always bump `modified_at` ([backup → data] newest-wins merge depends on it).
**Warning signs:** Saved custom values disappear for newly created contacts.

### Pitfall 4: Type change treated as a value-rewrite (see Open Questions #1)
**What goes wrong:** Implementing "convert automatically" as a bulk `UPDATE` on `contact_custom_values` violates the non-negotiable "type change must not touch `contact_custom_values` at all," and reintroduces the multi-row-write risk the TEXT-forever design exists to eliminate.
**Why it happens:** FLD-04 and §14.6 read as if values are rewritten and snapshotted.
**How to avoid:** Resolve Open Questions #1 with the owner first. Recommended model: values are never rewritten; parsing is read-time; the pre-flight is read-only; flagged values render tap-to-fix.
**Warning signs:** A "blast radius zero" invariant test (assert `contact_custom_values` bytes are identical before/after a pure type change) fails.

### Pitfall 5: `RENAME COLUMN` orphaning `field_history` references (FLD-03, see Open Questions #2)
**What goes wrong:** After a rename, `field_history` rows still reference the old `field_col_name`, so an undo/restore can't find the current column.
**Why it happens:** `field_history.field_col_name` is a name snapshot, not a foreign key.
**How to avoid:** If col_name follows the label (the §14.1 design), `UPDATE field_history SET field_col_name = ? WHERE field_col_name = ?` in the same rename txn. Or make col_name immutable (Open Questions #2).
**Warning signs:** Undo after a rename restores nothing.

## Code Examples

### The 7 target parsers (permissive, one per target type — §14.4)
```ts
// Source: HANDOFF §14.4 (boolean example verbatim). Storage is TEXT; parser output is the CANONICAL
// TEXT form for that type so sortExpr's CASTs work. Returns {ok:false} to FLAG (never throws, never clears).
type ParseResult = { ok: true; value: string | null } | { ok: false };

export const parsers: Record<FieldType, (raw: string | null) => ParseResult> = {
  text:     (r) => ({ ok: true, value: r ?? null }),                       // accept anything incl. digits (§14.3)
  textarea: (r) => ({ ok: true, value: r ?? null }),
  dropdown: (r) /* options checked by caller */ => ({ ok: true, value: r ?? null }),
  number:   (r) => { if (r == null || r.trim() === "") return { ok: true, value: null };
                     const n = Number(r.replace(/,/g, "").trim());
                     return Number.isFinite(n) ? { ok: true, value: String(n) } : { ok: false }; },
  date:     (r) => { if (r == null || r.trim() === "") return { ok: true, value: null };
                     const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(r.trim());
                     return m ? { ok: true, value: `${m[1]}-${m[2]}-${m[3]}` } : { ok: false }; },
  toggle:   (r) => { if (r == null || r.trim() === "") return { ok: true, value: null };
                     const s = r.trim().toLowerCase();
                     if (["yes","true","y","on"].includes(s)) return { ok: true, value: "1" };
                     if (["no","false","n","off","none"].includes(s)) return { ok: true, value: "0" };
                     const n = Number(s); if (Number.isFinite(n)) return { ok: true, value: n !== 0 ? "1" : "0" };
                     return { ok: false }; },     // §14.4: "3"→yes, "0"→no, nonzero means yes
  photo:    (r) => ({ ok: true, value: r ?? null }), // identity for now; widget deferred to Phase 5
};
```
Note the canonical toggle storage is `"1"`/`"0"` so `CAST(col AS INTEGER)` in `sortExpr` sorts correctly, and new toggle-widget writes should use the same form.

### Type-change pre-flight (read-only partition — FLD-04)
```ts
// Source: HANDOFF §14.4 steps 1–4. READ-ONLY: computes the summary; writes nothing.
export async function preflightTypeChange(exec: SqlExecutor, field: FieldDef, target: FieldType) {
  const rows = await exec.getAllAsync<{ contact_id: number; v: string | null }>(
    `SELECT contact_id, "${field.col_name}" AS v FROM contact_custom_values WHERE "${field.col_name}" IS NOT NULL`);
  const parse = parsers[target];
  const convert: number[] = [], flag: number[] = [];
  for (const r of rows) (parse(r.v).ok ? convert : flag).push(r.contact_id);
  return { total: rows.length, convert, flag }; // "8 of 12 will convert automatically. 4 need your input."
}
```

### Dynamic value read for a contact profile (FLD-07)
```ts
// Build the SELECT from whitelist-safe col_names; render a def when value present OR always_show.
const cols = defs.map((d) => `"${d.col_name}"`).join(", ");
const row = await exec.getFirstAsync<Record<string, string | null>>(
  `SELECT ${cols} FROM contact_custom_values WHERE contact_id = ?`, [contactId]);
const visible = defs.filter((d) => d.always_show || (row?.[d.col_name] ?? null) !== null);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Emulate `DROP COLUMN` via add/copy/drop/rename table rebuild | Native `ALTER TABLE DROP COLUMN` | SQLite 3.35.0 (2021-03) | Quarantine expiry is one statement; available in expo-sqlite 3.50.x + node:sqlite 3.51.2 [VERIFIED] |
| Emulate `RENAME COLUMN` via table rebuild | Native `ALTER TABLE RENAME COLUMN` | SQLite 3.25.0 (2018-09) | Field rename is metadata-only [VERIFIED transactional] |
| `custom_fields` JSON blob on `contacts` | Two-table column-per-field model | HANDOFF §14.1 `[DECIDED]` | Rename = O(1) metadata, inspectable, no partial-write risk |
| Obsidian markdown/YAML schema authoring (`loader.ts`) | Rows in `custom_field_defs` + a native editor | This phase | `loader.ts` is dead except `keyToLabel`; the editor is the largest net-new item (§14.10) |

**Deprecated/outdated:**
- `src/schemas/loader.ts` (plugin) — all Obsidian markdown parsing is dead here. Salvage only `keyToLabel` (~9 lines).
- Plugin `photo` field = URL text input; replaced by a native picker (§14.3) — deferred to reuse Phase 5.
- FormRenderer's React-DOM primitives (`<input>/<select>/<textarea>`, `className`) — do not port; keep the `switch(field.type)` dispatch and `buildInitialState`/validation shape.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended type-change model is "values untouched, read-time parse, snapshot flagged values only" | Open Questions #1 | If owner wants physical value normalization, FLD-04's DDL/DAO changes materially (bulk UPDATE + full snapshot) |
| A2 | `col_name` follows the label via `RENAME COLUMN` (per §14.1), with a same-txn `field_history` name sync | Pitfall 5 / Open Questions #2 | If col_name is immutable instead, rename is a pure `UPDATE label` and the history sync is unnecessary |
| A3 | Canonical toggle storage is `"1"`/`"0"`; canonical date is `YYYY-MM-DD` | Code Examples | If a different canonical form is wanted, `sortExpr` CASTs and widget writes must match it |
| A4 | Phase 3 builds RN-primitive widgets (no `datetimepicker`/`picker`/`image-picker` dependency) | Standard Stack | If a native calendar/spinner is required now, add + legitimacy-audit the dep |
| A5 | The `share_with_ai` per-field toggle ([ai → fields]) is included in the editor now (column exists) | Open Questions #3 | If deferred to Phase 14, the editor is reopened later |
| A6 | The `photo` field type exists but its native widget is deferred to Phase 5 | Open Questions #4 | If a working photo widget is required at the `--to 3` gate, Phase 5's picker is pulled forward |
| A7 | expo-sqlite 57 bundles SQLite ≥ 3.35 (stated 3.50.x) so on-device `DROP COLUMN` works | Summary | If the bundled version were < 3.35, `DROP COLUMN` would fail on device (tests would still pass on 3.51.2) — verify on the Pixel at the build gate |

## Open Questions

1. **Does a type change rewrite `contact_custom_values`, or only `custom_field_defs.type`?** (owner decision — highest priority)
   - What we know: §14.2 + CLAUDE.md (non-negotiable) say "one UPDATE on one row in `custom_field_defs` … column not touched … blast radius zero … must not touch `contact_custom_values` at all." §14.4/§14.6/FLD-04 say clean values "convert automatically" and are "snapshotted to `field_history` in the same transaction."
   - What's unclear: these cannot both be literal if conversion physically rewrites values.
   - Recommendation: honor the dominant, twice-stated non-negotiable — **values are never rewritten; parsing is read-time; the pre-flight is read-only; unconvertible values render tap-to-fix and stay byte-identical.** To still satisfy FLD-04's "snapshot in the same transaction," the type-change txn writes a `field_history` audit row for each *flagged* value (operation `type_flagged`), leaving `contact_custom_values` untouched. This honors every invariant. **Confirm with the owner before planning FLD-04**, because if physical normalization is intended, the op becomes a bulk value UPDATE. This is a reconciliation of conflicting spec clauses, not a proposed reversal — flag it as such at the discuss gate.

2. **On rename, does `col_name` follow the label (`RENAME COLUMN`) or stay immutable?** (planner/owner)
   - What we know: §14.1 explicitly sells `RENAME COLUMN` as the rename mechanism and §14.10 lists "rename" as a DDL op to build. `field_history.field_col_name` is a name snapshot with no FK.
   - What's unclear: whether the physical column must track the label, or col_name is an internal immutable id and only `label` is edited.
   - Recommendation: follow §14 (`RENAME COLUMN`) and add a same-txn `UPDATE field_history SET field_col_name` to keep the undo buffer valid. Immutable-col_name is simpler (pure `UPDATE label`, no drift) but contradicts §14.1's stated design — treat that as an owner call, not a silent simplification.

3. **Include the `share_with_ai` per-field toggle in the editor now, or defer to Phase 14?** The column exists (migration 1) and [ai → fields] says the editor needs the toggle. Recommendation: include it now (default false) to avoid reopening the editor in Phase 14; cheap and column-backed.

4. **`photo` field widget at the `--to 3` gate:** defer the native picker to Phase 5 (recommended — the field type still works, widget is minimal/disabled) or land a minimal path now. Recommendation: defer; keep the parser as identity so the 7-type set is complete.

5. **Dropdown options change with existing out-of-options values:** when a user edits a dropdown's `options`, stored values no longer in the list are not destroyed (permissive); render them as a selectable raw option (the plugin's behavior) or as a tap-to-fix flag? Recommendation: show as a raw/selected option (no data loss, no friction), consistent with §14.4's "flag, don't destroy" only applying to type changes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-sqlite (SQLite ≥ 3.35 for DROP COLUMN) | FLD-02/03/05 DDL | ✓ | 57.0.1 (SQLite 3.50.x) | none needed |
| node:sqlite (test harness) | Validation | ✓ | Node 22.22.2 / SQLite 3.51.2 | none needed |
| vitest | Validation | ✓ | 4.1.10 | none needed |
| Pixel 6 Pro on-device run | `--to 3` gate: confirm bundled SQLite version + DDL on device | ✓ (desktop-build → Pixel pipeline, FND-01) | — | Emulator falls back but cannot assess Skia perf (N/A here) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none. (A native date/dropdown/photo widget would add a package but each has a dependency-free RN-primitive path — see Standard Stack.)

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true`). The data layer is fully node-testable; the UI is not (no RN-component harness exists) and is verified at the `--to 3` human gate + manual UAT.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 |
| Config file | `vitest`/`tsconfig` path alias `@/` already resolving in existing `src/db/*.test.ts` |
| Quick run command | `npx vitest run src/db/<file>.test.ts` |
| Full suite command | `npm test` (→ `vitest run`) |
| DB harness | `openTestDb()` + `nodeSqliteExecutor()` from `src/db/__testkit__/node-sqlite.ts` (`--experimental-sqlite`, warning only) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FLD-02 | create = INSERT def + ADD COLUMN atomically; rollback on failure leaves neither | unit (node:sqlite) | `npx vitest run src/db/field-ddl.test.ts` | ❌ Wave 0 |
| FLD-02 | slugifier constructs `[a-z_][a-z0-9_]*`; `"; DROP TABLE"` → sanitized; collides→`_2` | unit (pure) | `npx vitest run src/db/col-name.test.ts` | ❌ Wave 0 |
| FLD-02 | reserved set ⊇ actual `contacts`+`contact_custom_values` columns (drift guard) | unit (node:sqlite) | `npx vitest run src/db/reserved-columns.test.ts` | ❌ Wave 0 |
| FLD-03 | rename = RENAME COLUMN + label/history sync; reorder = display_order UPDATE | unit (node:sqlite) | `npx vitest run src/db/field-ddl.test.ts` | ❌ Wave 0 |
| FLD-04 | 7 parsers, permissive cases (`"3"`→yes, empty→null, `"about 60k"`→flag) | unit (pure) | `npx vitest run src/db/field-parsers.test.ts` | ❌ Wave 0 |
| FLD-04 | pre-flight partitions convert/flag; **`contact_custom_values` unchanged after a pure type change** (invariant) | unit (node:sqlite) | `npx vitest run src/db/field-type-change.test.ts` | ❌ Wave 0 |
| FLD-05 | empty→immediate delete; populated→quarantine (data untouched); restore nulls timestamp | unit (node:sqlite) | `npx vitest run src/db/field-ddl.test.ts` | ❌ Wave 0 |
| FLD-05 | sweep: def quarantined >30d → snapshot+DROP; <30d retained; history pruned >30d | unit (node:sqlite + injected clock) | `npx vitest run src/services/field-sweep.test.ts` | ❌ Wave 0 |
| FLD-06 | `sortExpr`: `"10"`,`"9"`,`"2"` sort numerically via CAST; populated field still DROP-able (no index) | unit (node:sqlite) | `npx vitest run src/db/field-sort.test.ts` | ❌ Wave 0 |
| FLD-07 | profile shows def when value present OR always_show; create=show_on_new; edit=all non-quarantined | unit (node:sqlite) | `npx vitest run src/db/field-values-dao.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the touched module's `npx vitest run src/db/<file>.test.ts`.
- **Per wave merge:** `npm test`.
- **Phase gate:** full suite green before `/gsd-verify-work`; plus an on-device Pixel run confirming the DDL ops + a real quarantine→expiry cycle (the `--to 3` review).

### Wave 0 Gaps
- [ ] `src/db/col-name.test.ts` — covers FLD-02 (slug construction, injection resistance, uniquify)
- [ ] `src/db/reserved-columns.test.ts` — covers FLD-02 (whitelist ⊇ schema drift guard)
- [ ] `src/db/field-ddl.test.ts` — covers FLD-02/03/05 (create/rename/reorder/quarantine, rollback)
- [ ] `src/db/field-parsers.test.ts` — covers FLD-04 (7 permissive parsers)
- [ ] `src/db/field-type-change.test.ts` — covers FLD-04 (pre-flight + the "values untouched" invariant)
- [ ] `src/db/field-sort.test.ts` — covers FLD-06 (`sortExpr` + DROP-after-populate)
- [ ] `src/db/field-values-dao.test.ts` — covers FLD-07 (visibility rules, UPSERT, modified_at)
- [ ] `src/services/field-sweep.test.ts` — covers FLD-05 (expiry + retention on injected clock)
- [ ] No RN-component test harness exists — keep logic in the testable modules above; field editor verified at the `--to 3` gate. (Framework install: none needed.)

## Security Domain

Security enforcement is on (`security_enforcement: true`, ASVS L1). This is a local-first, single-user, no-network subsystem; the dominant risk is SQL injection through the one place identifiers are interpolated.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local single-user app, no accounts |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No multi-user boundary; DB is app-private sandbox |
| V5 Input Validation | **yes** | Label length cap; `type` restricted to the 7-value `FieldType` enum; dropdown `options` validated; **`col_name` whitelist-constructed** (never escaped) |
| V6 Cryptography | no | No secrets handled here (API keys are Phase 14, `expo-secure-store`) |
| V7/V9 Data protection / egress | **yes** | No network on any field path (local-first commitment); `field_history` excluded from export ([backup → fields]); `share_with_ai` defaults false |

### Known Threat Patterns for expo-sqlite runtime DDL
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via a column *identifier* (labels can't be bound as identifiers) | Tampering | `col_name` is **constructed** from `[a-z_][a-z0-9_]*`, reserved-checked, and double-quoted; the user label is a bound parameter for the `label` column only. Test: `slugify("; DROP TABLE contacts;--")` yields a safe slug |
| Value injection in dynamic `SELECT`/`UPSERT` | Tampering | Column list is built from whitelist-safe `col_name`s; every *value* is a bound `?` parameter (project-wide rule, `SqlExecutor` array-params form) |
| Data destruction via mis-ordered DROP | Denial (data loss) | Snapshot to `field_history` before `DROP COLUMN` in one txn; quarantine (not immediate delete) whenever a field holds data; 30-day reversible window |
| Silent orphan (def without column / column without def) | Tampering/Integrity | `DELETE def` + `DROP COLUMN` in one atomic txn (both or neither) |
| Cross-table name confusion (a custom field named `phone`/`email`) | Integrity | Reserve the **entire** `contacts` + `contact_custom_values` fixed-column set in the slugifier |

## Sources

### Primary (HIGH confidence)
- `HANDOFF.md` §14.1–§14.11 — the `[DECIDED]` custom-fields design (storage model, TEXT-forever, sortExpr, parsers, quarantine, snapshot, where-fields-appear).
- `src/db/migrations/001-initial.ts` — the exact `custom_field_defs` / `contact_custom_values` / `field_history` DDL and the reserved `contacts` column set.
- `src/db/mutex.ts`, `src/db/migrations/runner.ts`, `src/services/launch-sweep.ts`, `src/db/database.ts`, `src/db/__testkit__/node-sqlite.ts` — the Phase-2 primitives this phase composes.
- `CLAUDE.md` "Custom fields — invariants" — the non-negotiable rules.
- Live `node:sqlite` 3.51.2 run — verified ADD/RENAME/DROP COLUMN transactionality and the indexed-column DROP failure [VERIFIED].
- `docs/dossier/INDEX.md` cross-domain constraint log — `[crud → fields]`, `[ai → fields]`, `[photos → fields]`, `[backup → fields]`.

### Secondary (MEDIUM confidence)
- `~/projects/Orbit/src/components/FormRenderer.tsx` — dispatch/validation shape to port (DOM primitives dropped).
- `~/projects/Orbit/src/schemas/loader.ts:36` — `keyToLabel` salvage; rest is dead.
- `src/schemas/types.ts` — ported `FieldType`/`FieldDef`/`SchemaDef`.
- SQLite release history (DROP COLUMN 3.35 / RENAME COLUMN 3.25) — well-established, cross-checked against the verified runtime versions.

### Tertiary (LOW confidence)
- expo-sqlite 57 exact bundled SQLite patch version (stated 3.50.x) — confirm on the Pixel at the build gate (A7); tests run on 3.51.2 regardless.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every tool already installed and in use.
- Architecture / DDL: HIGH — transactionality empirically verified on the exact test harness; patterns mirror proven Phase-2 code.
- Type-change design: MEDIUM — a genuine spec conflict (Open Questions #1) needs owner sign-off before the FLD-04 plan is final.
- Pitfalls: HIGH — grounded in verified SQLite behavior and the §14 invariants.
- UI: MEDIUM — Claude's discretion, no RN-component test infra; verified at the human gate.

**Research date:** 2026-08-14
**Valid until:** 2026-09-13 (stable domain; re-verify only if expo-sqlite major version or the SQLite floor changes)
</content>
</invoke>
