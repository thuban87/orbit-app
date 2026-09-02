# Phase 7: Conversational Fuel - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 8 new + 2 modified (mount points)
**Analogs found:** 10 / 10 (every file has an on-disk analog — this phase is ~90% assembly)

> Every excerpt below was read from the actual file on disk and cited file:line. No analog is inferred from a summary.
> Load-bearing structural fact for the whole phase: **`off_limits` and unconfirmed `source='ai'` are excluded by a SQL `WHERE` predicate inside the shared read module — never by a UI `.filter()`.** (RESEARCH Pattern 3 / Pitfall 1; dossier `03-fuel.md:242`.)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/fuel-dao.ts` | DAO / writer | CRUD (add/edit/delete + confirm-flip UPDATE) | `src/db/events-dao.ts` (Core+mutexed split) · `src/db/contact-links-dao.ts` (diff of N rows) · `src/db/field-values-dao.ts` (per-item UPDATE) | exact |
| `src/db/fuel-read.ts` | read module | request-response (ranked projection + LIKE search) | `src/db/timeline-read.ts` (single shared read, no txn) · `src/db/queries.ts` (read-SQL conventions) | exact |
| `src/services/fuel-ranking.ts` | pure logic | transform (kind-priority comparator) | `src/services/gravity-logic.ts` / `intensity-logic.ts` (pure, injected tunable, no RN/DB import) | exact |
| `src/services/fuel-age.ts` | pure logic | transform ("N days ago") | `src/services/gravity-logic.ts` `parseLocalMs` (`:82-98`) | role+flow match |
| `src/components/FuelEditor.tsx` | component | event-driven (controlled add/edit/delete callbacks) | `src/components/LinksEditor.tsx` (controlled repeatable list, parent owns draft) | exact |
| `src/components/FuelItemForm.tsx` (optional split) | component | request-response (form) | `src/components/FieldDefForm` + `DropdownFieldWidget` (kind picker) | role match |
| `src/screens/FuelSearch.tsx` (minimal, veto-able) | screen | request-response (search) | `src/screens/CustomFieldsScreen.tsx` (list screen) · search query is the analog gap | role match |
| `src/screens/ContactProfileScreen.tsx` (MODIFY: mount) | screen | — | its own `load()` (`:134-161`) + Timeline section (`:441-472`) | in-place |
| `src/db/migrations/001-initial.ts` | migration | — | **DO NOT TOUCH** — `fuel` table already shipped (`:167-179`) | n/a — no migration |
| `src/db/purge-dao.ts` | DAO | — | **DO NOT TOUCH** — fuel already deleted (`:188`) + counted (`:103-107,149-151`) | n/a — done |

---

## Pattern Assignments

### `src/db/fuel-dao.ts` (DAO / writer, CRUD)

**Primary analog:** `src/db/events-dao.ts` — the `*Core` (non-mutexed) + public (mutexed) split.

**The exact Core+wrapper pattern to copy** (`events-dao.ts:62-93`):
```typescript
export async function recordEventCore(exec: SqlExecutor, input: RecordEventInput): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO events (uid, contact_id, type, occurred_at, detail, recorded_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.uid, input.contactId, input.type, input.occurredAt, input.detail ?? null, input.now, input.now],
  );
  return result.lastInsertRowId;
}
export function recordEvent(exec: SqlExecutor, input: RecordEventInput): Promise<number> {
  return inWriteTransaction(exec, () => recordEventCore(exec, input));
}
```
Apply verbatim to `addFuelCore`/`addFuel` over the shipped columns (`001-initial.ts:167-179`): `(uid, contact_id, kind, label, text, url, created_at, source, modified_at)`. Provide the `*Core` NOW even though capture is Phase 10 — the multi-attach fan-out (dossier `03-fuel.md:159`, N independent rows) will compose `addFuelCore` inside one outer txn.

**Multi-row / diff-in-one-transaction analog** (`contact-links-dao.ts:198-239`) — for edit/delete-on-save if the editor persists as a diff: `applyLinkDiff` opens ONE `inWriteTransaction` and calls `addLinkCore`/`removeLinkCore`/update cores inside it, never nesting the mutex.

**Per-item UPDATE analog** (`field-values-dao.ts:126-145`) — for `editFuel` and the confirm-flip. Note the header contract: `modified_at` is ALWAYS bumped (Phase-16 newest-wins depends on it), every runtime value is `?`-bound.

**The confirm-flip (FUEL-06) — a single UPDATE, NO migration:**
```sql
-- confirm an AI-proposed item = flip source; there is NO `confirmed` column in migration 1.
UPDATE fuel SET source = 'manual', modified_at = ? WHERE id = ?
```
**⚠ OPEN DECISION (RESEARCH Open Q1 / A1, owner's bucket — data provenance):** confirming can either (a) flip `source` `'ai'`→`'manual'` (no migration, erases "was AI-proposed" provenance) or (b) add a nullable `ai_confirmed_at TEXT` in a NEW forward-only migration 2 (preserves provenance; RESEARCH leans this way). **The task prompt states confirm = a single `UPDATE fuel SET source='manual'` and verified no `confirmed` column exists** — the planner should confirm the flip-vs-flag call with the owner before writing the DAO, because it changes the column set.

**`uid` + timestamp helpers** (mandatory, RESEARCH "Don't Hand-Roll"):
- `newUid()` from `src/db/uid.ts:18` — mint on every INSERT (mergeable table).
- `localDateTime()` from `src/db/database.ts` — `created_at`/`modified_at`.
- `inWriteTransaction` from `src/db/transaction.ts:42` — the ONE shared non-reentrant mutex. **NEVER nest it** (`transaction.ts:11-29` — permanent hang); compose via `*Core`.

---

### `src/db/fuel-read.ts` (read module, request-response)

**Analog:** `src/db/timeline-read.ts` — the model of a single shared read module reused by many surfaces: pure read, NO transaction, every value `?`-bound, only static column names literal (`timeline-read.ts:1-25, 92-127`). SQL-string constants + a thin mapping function.

**Read-SQL conventions + injection posture:** `queries.ts:9-13` — "every SQL here is a static fragment … the ONLY runtime value is `contact_id` … `?`-bound, never interpolated." Fuel has FIXED columns (unlike custom fields), so there is NO dynamic identifier to interpolate — every value is a `?` param (RESEARCH Security Domain).

**Ranked projection (FUEL-03) — kind priority THEN recency, `off_limits` excluded in-query** (RESEARCH Code Examples; dossier `03-fuel.md:240-251`):
```sql
SELECT id, contact_id, kind, label, text, url, created_at, source
  FROM fuel
 WHERE contact_id = ? AND kind != 'off_limits'
 ORDER BY CASE kind WHEN 'recent' THEN 0 WHEN 'gift' THEN 1
                    WHEN 'topic' THEN 2 WHEN 'fact' THEN 3 ELSE 4 END,
          created_at DESC, id DESC
```
Kind priority = `recent(0) > gift(1) > topic(2) > fact(3)`. A `recent` from last week outranks a `fact` from yesterday (the explicitly-rejected "newest regardless of kind", dossier `:249`). The glanceable read should ALSO exclude unconfirmed `source='ai'` (UI-SPEC `RankedFuelLine` note / RESEARCH Pitfall 4) — add `AND NOT (source='ai' AND <unconfirmed>)`.

**Cross-contact search (FUEL-05) — name OR fuel text, LIKE, `?`-bound, off_limits + archived excluded** (RESEARCH Code Examples):
```typescript
const like = `%${term}%`;
const rows = await exec.getAllAsync<SearchRow>(
  `SELECT DISTINCT c.id, c.name FROM contacts c
     LEFT JOIN fuel f ON f.contact_id = c.id AND f.kind != 'off_limits'
    WHERE c.archived_at IS NULL AND (c.name LIKE ? OR f.text LIKE ?)
    ORDER BY c.name`, [like, like]);
```
ASCII-only case folding is EXPECTED (ICU not compiled — dossier `03-fuel.md:355`); do not "fix" it. `?`-bind the term; consider `ESCAPE` for literal `%`/`_` (RESEARCH Pitfall 6). `archived_at IS NULL` mirrors `queries.ts:24`.

**Profile-editor list read** — the ONE read that OMITS the `off_limits` predicate (you must be able to edit an off_limits item; RESEARCH arch diagram). Every other consumer inherits the exclusion for free.

---

### `src/services/fuel-ranking.ts` (pure logic, transform)

**Analog:** `src/services/gravity-logic.ts` / `intensity-logic.ts` — pure `.ts`, no react-native/Skia/expo/DB import, node-tested, tunables at top-of-file and injected (`gravity-logic.ts:1-9, 53-61`).

Put `FUEL_KIND_PRIORITY = ['recent','gift','topic','fact']` at top-of-file as the single tunable (CLAUDE.md: tuning is a single-number/array edit). **The SQL `CASE` and this comparator MUST derive from the same constant** — RESEARCH Pitfall 3: a node-test feeds one fixture through the SQL query AND the pure comparator and asserts identical order (FUEL-03).

---

### `src/services/fuel-age.ts` (pure logic, transform)

**Analog:** `gravity-logic.ts:82-98` `parseLocalMs` — parse stored `YYYY-MM-DD HH:MM:SS` with LOCAL components, never `toISOString`/UTC (avoids the evening off-by-one, CLAUDE.md):
```typescript
function parseLocalMs(stored: string): number {
  const m = stored.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) throw new Error(`unparseable timestamp "${stored}"`);
  const [, y, mo, d, hh, mm, ss] = m;
  return new Date(Number(y), Number(mo)-1, Number(d), Number(hh??0), Number(mm??0), Number(ss??0)).getTime();
}
```
Copy this parse; format to `today` / `N days ago` / `N months ago` / `N years ago` (UI-SPEC copy `:253`). **Age only DISPLAYS and RANKS — never deletes/hides** (dossier `03-fuel.md:199-209`, RESEARCH Pitfall 5). No launch sweep, no DELETE/UPDATE keyed on `created_at`.

---

### `src/components/FuelEditor.tsx` (component, event-driven)

**Analog:** `src/components/LinksEditor.tsx` — a CONTROLLED repeatable list: parent owns the draft array, component renders + routes `onAdd`/`onUpdate(index, patch)`/`onRemove(index)` callbacks, NO DB access inside (`LinksEditor.tsx:1-9, 49-60`). Copy the empty-state ("No fuel yet" + "+ Add fuel" below), the per-row card (`styles.row`: `borderWidth:1, borderRadius:10, padding:12, gap:10`, `:217-222`), the `✕` remove with `hitSlop` to 44 (`:174-187`), and the accent "+ Add" affordance (`:193-204`).

**URL open affordance:** reuse `normaliseLinkUrl` (`LinksEditor.tsx:67-74`) — the http/https POSITIVE allowlist. Do not re-derive.

**Kind picker analog:** `src/components/field-widgets/DropdownFieldWidget.tsx` — `Pressable` trigger opening a `Modal` + `FlatList` of options, zero new deps, selected item rendered in `colors.accent` (`:89-114`). The 5 kinds are the fixed option set; selected kind is `accent` (UI-SPEC `:163`).

**Multiline text input:** the `TextAreaFieldWidget` posture (plain multiline `TextInput`, no markdown) — UI-SPEC `:112`, dossier decision-without-you #4 (fuel text is plain text).

**Persistence on save:** mirror `applyLinkDiff` (`contact-links-dao.ts:198`) — a single DAO diff, all-or-nothing in one txn — OR per-row immediate DAO calls; planner's call.

**off_limits / AI-unconfirmed row treatment (existing tokens only — NO net-new token, UI-SPEC `:61-64,127`):** `borderStrong` outline + a `border`/`textSecondary` 999-radius pill. off_limits = "Off-limits · private" 🔒; AI = "Suggested by AI" + Confirm(`accent`)/Dismiss(`textSecondary`). This styling is REINFORCEMENT — the guarantee is the SQL predicate, never the style.

---

### `src/screens/ContactProfileScreen.tsx` (MODIFY — mount point)

**Mount analog (its own code):** the Timeline section render (`:441-472`) is the template for a new "Conversational Fuel" `<View>` section (heading via `styles.sectionHeading` + `colors.textSecondary`, empty state, `.map` of rows). Mount the `RankedFuelLine` promoted strip above the editor (UI-SPEC `:181-190`).

**The SINGLE unified `load()`** (`:134-161`) — add the fuel read into the existing `Promise.all` and a `setFuel(...)` alongside `setTimeline`. **Every mutation (add/edit/delete/confirm) MUST call `await load()` to refresh** — the screen's own comments (`:200-201, 246, 279`) stress that partial reloads leave derived surfaces stale. Reuse the existing `Alert.alert("Couldn't load this contact", …)` error posture (`:159`).

---

### `src/screens/FuelSearch.tsx` (MINIMAL, veto-able — UI-SPEC Search Surface Decision `:213-228`)

Phase 7 ships the search **query + result-row rendering as REUSABLE units** (a `fuel-read.ts` query + a presentational result row), so Phase 8 can absorb them into the dashboard box without a rewrite. The screen itself is a thin `TextInput` + `FlatList` mount (analog: any list screen; `CustomFieldsScreen.tsx` structure). A `FuelSearch: undefined` route joins `RootStackParamList`; entry from `SettingsScreen`. **Owner may veto the screen** and ship query+row only — nothing else depends on it.

---

## Shared Patterns

### Write serialization / transactions
**Source:** `src/db/transaction.ts:42` (`inWriteTransaction`) + the `*Core` split convention (`events-dao.ts:62-93`).
**Apply to:** every fuel write in `fuel-dao.ts`.
NEVER nest `inWriteTransaction` (`transaction.ts:11-29` — permanent hang). Compose via non-mutexed `*Core` functions inside one outer transaction. NEVER use expo `withTransactionAsync`/`withExclusiveTransactionAsync`.

### uid + local-wall-clock timestamps
**Source:** `src/db/uid.ts:18` (`newUid`), `src/db/database.ts` (`localDateTime`), `src/utils/dates.ts` (`formatLocalDate`).
**Apply to:** every INSERT (uid) and every write (`created_at`/`modified_at`). Never `Date.now()`/ISO; never `toISOString().split('T')[0]`.

### `?`-binding / injection posture
**Source:** `queries.ts:9-13`, `timeline-read.ts:13-25`, `events-dao.ts:28-30`.
**Apply to:** all fuel SQL. Fuel has fixed columns → zero dynamic identifiers → every value is a bound `?`. (Contrast `field-values-dao.ts:11-17`, where `col_name` is the one guarded interpolated identifier — that hazard does NOT exist for fuel.)

### Pure-logic + node-test harness
**Source:** `gravity-logic.ts` (pure module) + `src/db/__testkit__/node-sqlite.ts` (`openTestDb` + `nodeSqliteExecutor`).
**Apply to:** `fuel-ranking.test.ts`, `fuel-age.test.ts`, `fuel-dao.test.ts`, `fuel-read.test.ts` (mirror `events-dao.test.ts`). Node-test the off_limits exclusion (every kind-population combo), the exact kind precedence with cross-kind date inversions, SQL-vs-comparator parity, search predicate, and `source='ai'` gating.

### Theme tokens (NO net-new token)
**Source:** `src/theme/theme-presets.ts` via `useTheme().colors.*` (`LinksEditor.tsx:94-103`).
**Apply to:** all fuel UI. off_limits + AI-unconfirmed markers use existing `border`/`borderStrong`/`textSecondary`/`accent` only (UI-SPEC `:61-64`). `npm run check:colors` must stay green.

---

## Already Done — DO NOT Add a Second Path

| Concern | Where it already lives | Rule |
|---------|------------------------|------|
| Purge deletes fuel rows | `purge-dao.ts:188` (`DELETE FROM fuel WHERE contact_id = ?`, explicit fan-out) | Do NOT add a second delete path (CRUD-06 ships). |
| Purge impact counts fuel | `purge-dao.ts:103-107` (count) + `:149-151` (`plural(…, "fuel item", "fuel items")`) | Done. Do NOT add a second count. |
| `fuel` table + all FUEL-01 columns | `migrations/001-initial.ts:167-179` | Table shipped EMPTY. **No new migration** unless the planner chooses a ranking index or an `ai_confirmed_at` column → then a NEW forward-only migration 2, NEVER edit migration 1. |

---

## Dead Surfaces to AVOID (planner: steer clear, cite so it isn't re-derived)

| Surface | Location | Why avoid |
|---------|----------|-----------|
| `Contact.fuel?: string[]` | `src/types.ts:88` (`/** Conversational fuel content (cached) */`) | The REJECTED "one text blob per contact" (dossier `03-fuel.md:38-40`), the dead F11 cache branch. Phase 7's model is per-item DB rows. Never read/write this field. |
| `{{Conversational Fuel}}` / `{{Small Talk Data}}` prompt template | `src/services/AiService.ts:31-35` | Ported-plugin prompt (name-bound placeholders that fail silently — F5). Phase 14 rebuilds prompt assembly from the ranked projection. Do NOT wire fuel into AiService this phase. |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | None. Every Phase-7 file maps to an existing on-disk analog; this is a ~90%-assembly phase. |

---

## Metadata

**Analog search scope:** `src/db/`, `src/services/`, `src/components/`, `src/components/field-widgets/`, `src/screens/`, `src/db/migrations/`.
**Files read (full or targeted):** `events-dao.ts`, `transaction.ts`, `uid.ts`, `field-values-dao.ts`, `timeline-read.ts`, `queries.ts`, `gravity-logic.ts`, `intensity-logic.ts`, `purge-dao.ts`, `migrations/001-initial.ts`, `LinksEditor.tsx`, `DropdownFieldWidget.tsx`, `contact-links-dao.ts`, `CustomFieldsScreen.tsx`, `ContactProfileScreen.tsx`, `types.ts`, `AiService.ts`.
**Pattern extraction date:** 2026-08-15
</content>
</invoke>
