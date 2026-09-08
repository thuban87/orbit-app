# Phase 30: Orrery Systems - Pattern Map

**Mapped:** 2026-09-08
**Files analyzed:** 8 (4 new, 4 extend) + 1 migration registration
**Analogs found:** 8 / 8 (every artifact has a strong on-disk analog; all verified by reading the file)

> Ground truth is the dossier (`docs/dossier/milestone-2/phase-09-orrery-systems-dossier.md`) + planning-notes; CONTEXT.md is a shim. Every excerpt below was read on disk this session — line numbers are current as of TARGET_VERSION 21 (head migration 021). **Re-verify the migration number at plan time** (D-03): head is `021`, so this phase is `022`, but numbers drift every schema phase.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/migrations/022-orrery-systems.ts` (NEW) | migration | transform (DDL) | `src/db/migrations/016-contact-knowledge.ts` | exact (multi-table additive w/ uid+cascade+indexes) |
| `src/db/systems-dao.ts` (NEW) | dao | CRUD | `src/db/memories-dao.ts` | exact (uid table, core+mutex pair, cascade, revision bump) |
| `src/logic/system-rule-resolver.ts` (NEW) | logic/service | transform (read-side) | `src/logic/dashboard-query-logic.ts` + `dashboard-gravity-filter.ts` + `orrery-system-read.ts` | role-match (compose existing predicates) |
| `src/logic/orrery-system-logic.ts` (EXTEND) | logic | transform | self (extend closed union) | exact |
| `src/db/app-settings-dao.ts` (EXTEND) | dao | CRUD (grammar) | self (`assertOrreryLastSystem`, `OrrerySystemId`) | exact |
| `src/components/orrery/OrrerySystemSelector.tsx` + `orrery-controls-logic.ts` (EXTEND) | component + logic | request-response (UI) | self | exact |
| `src/components/orrery/ManageMembersGrid.tsx` (NEW) | component | list/multi-select | `contact-picker-selection.ts` / `-source.ts` (logic) | role-match (logic reuse; NOT `ContactPicker.tsx`) |
| `src/screens/SystemBuilderScreen.tsx` + `SystemsManagementScreen.tsx` + `SystemPreviewCanvas.tsx` (NEW) | screen/component | UI + Skia render loop | `OrrerySystemSelector.tsx` (focus/AppState/GlassSurface); Phase 29 canvas | partial (new surfaces; reuse primitives + store) |
| `src/backup/backup-schema.ts` (EXTEND, declare-only) | validation | transform | self (`PORTABLE_SETTINGS_KEYS`, `assertPortableSettings`) | exact |

## Pattern Assignments

### `src/db/migrations/022-orrery-systems.ts` (migration, DDL) — NEW

**Analog:** `src/db/migrations/016-contact-knowledge.ts` (verified on disk).

Copy the structure exactly: named exported `CREATE_*` SQL constants, a `Migration` object with `version` + `apply(exec, deps)` that calls `exec.execAsync` per statement. The runner owns the transaction — **never** put `BEGIN` in the body (confirmed: 016 has none; migration021 has none).

Table conventions to mirror (016 lines 10-28):
```typescript
CREATE TABLE memories (
  id              INTEGER PRIMARY KEY,
  uid             TEXT UNIQUE NOT NULL,
  contact_id      INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  ...
  created_at      TEXT NOT NULL,
  modified_at     TEXT NOT NULL
);
```
- `uid TEXT UNIQUE NOT NULL` on every durable entity.
- `contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE` for the manual-inclusion / manual-exclusion rows (cascade removes overrides when a contact is deleted).
- Partial/unique indexes as separate `CREATE [UNIQUE] INDEX` statements (016 lines 59-74).
- Migration object (016 lines 76-87):
```typescript
export const migration016: Migration = {
  version: 16,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(CREATE_MEMORIES);
    ...
  },
};
```

Phase-specific SQL requirements (ORRS-09, ORRS-02): case-insensitive unique System name — use `CREATE UNIQUE INDEX ... ON systems(name COLLATE NOCASE)`; per-System-per-contact uniqueness — `UNIQUE(system_id, contact_id)` on inclusion/exclusion rows. Rule value rows one-per-`(system_id, family, value)`. **Do NOT touch `app_settings`** — `orrery_last_system` already exists (migration021 line 16). A migration022 body that ALTERs `app_settings` is Pitfall 1.

**Registration (must not miss):** add `import { migration022 }` and append to the `MIGRATIONS` array in `src/db/database.ts` (analog: line 45 import, line 80 in array) AND bump `export const TARGET_VERSION = 21` → `22` (database.ts line 56).

**Test analog:** neighbor `020-dashboard-swipe-pref.test.ts` / `019-dashboard-prefs.test.ts` exist — mirror for `022-orrery-systems.test.ts` (node:sqlite schema-invariant tests).

---

### `src/db/systems-dao.ts` (dao, CRUD) — NEW

**Analog:** `src/db/memories-dao.ts` (verified on disk) — the canonical uid-table CRUD DAO over a migration-016 cascade table.

Copy the DAO idioms verbatim:

**Imports / uid / revision (memories-dao lines 1-10):**
```typescript
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
```

**Core + public pair pattern (lines 94-130 and 296-305):** every mutation is a non-mutexed `…Core(exec, input)` (safe to compose inside a caller's transaction) plus a public `fn(exec, input)` wrapping it in `inWriteTransaction` + `bumpDataRevisionCore`:
```typescript
export async function addMemoryCore(exec, input): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO memories (uid, contact_id, ...) VALUES (?, ?, ...)`,
    [newUid(), input.contactId, ...],   // every value ?-bound
  );
  return result.lastInsertRowId;
}
export function addMemory(exec, input): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await addMemoryCore(exec, input);
    await bumpDataRevisionCore(exec);
    return id;
  });
}
```

**Change-count guard (lines 77-88):** every UPDATE/DELETE asserts `changes === 1` scoped by id (+ owner) so a stale target rolls back:
```typescript
function assertOneChange(op, id, contactId, changes) {
  if (changes !== 1) throw new Error(`${op}: no row matched id=${id} ... (changed ${changes})`);
}
```

**Partial-update builder (lines 184-235):** only fields explicitly present in the input are written (prevents a stale UI snapshot clobbering a concurrent edit) — reuse for System rename/visibility/reorder patches.

Phase-specific DAO responsibilities (ORRS-03/09/10): deterministic duplicate naming (`{name} Copy` / `Copy 2` …, uniqueness-aware — §S); case-insensitive name uniqueness enforced in the DAO before insert (throw the §T collision, do not rely only on the index); delete cascades value rows in the same transaction; builtin/category immutability (reject writes to those refs). **All Systems SQL lives here — no inline SQL in components (CLAUDE.md).**

---

### `src/logic/system-rule-resolver.ts` (logic, read-side transform) — NEW

**Analog:** composes `src/logic/dashboard-query-logic.ts` + `src/logic/dashboard-gravity-filter.ts`, following the builtin resolution shape already in `src/logic/orrery-system-logic.ts:73-115` and `src/db/orrery-system-read.ts:54-75`.

**Why a new resolver (not another `buildOrrerySystemWhere` string):** builtin/category are static `{sql, params}` WHEREs (orrery-system-logic.ts:73-115). Custom Systems cannot be — gravity is a post-query TS pass and inc/exc are rows. Resolve to a member **id set** (Pattern 2, Pitfall 2).

**Compose the canonical fragments (dashboard-query-logic.ts:75-116, 149-160):**
```typescript
import { buildFilterWhere, ACTIVE_SEGREGATION_WHERE,
  FAVOURITES_WHERE, NOT_CONTACTED_WHERE, SNOOZED_WHERE } from "@/logic/dashboard-query-logic";
const { sql, params } = buildFilterWhere(storedRules); // OR-within-family, AND-across-family
const where = sql ? `${ACTIVE_SEGREGATION_WHERE} AND (${sql})` : ACTIVE_SEGREGATION_WHERE;
```
- `buildFilterWhere` handles category / social-battery / contact-frequency / needs-attention families, all `?`-bound, closed-constant tokens only (never interpolated) — the injection-safe idiom (lines 83-115).
- Rule-family tokens (verbatim, dashboard-query-logic.ts:14-20): `"category"`, `"social-battery"`, `"needs-attention"`, `"gravity"`, `"contact-frequency"`. Social-battery values `"Charger"`/`"Neutral"`/`"Drain"` (line 38); frequency buckets `weekly`/`monthly`/`quarterly`/`yearly` (lines 29-34); needs-attention value `"on"` (line 39, `NEEDS_ATTENTION_VALUE`).

**Gravity as a post-query TS pass (dashboard-gravity-filter.ts:19-38) — NEVER SQL (Pitfall 2):**
```typescript
import { filterByGravity } from "@/logic/dashboard-gravity-filter";
const survivors = await filterByGravity(candidateIds, selectedTiers, loadInputs, now);
```
Gravity tier names (verbatim, `src/services/impact.ts` `GRAVITY_TIERS`): `"thin"`, `"building"`, `"solid"`, `"deep"`.

**Overrides (dossier §E, ORRS-02):** `members = (candidates ∪ manualInclusions) ∖ manualExclusions`, then **prune exclusions whose contact is no longer in the candidate set** (dynamic buckets, not ledgers — no stale exclusions accumulate).

**Broken-rule detection (ORRS-04, D-07, Pitfall 5 — decision-reversal risk):** a rule whose `category:<uid>` no longer joins `categories` is flagged *needs attention* at resolve time; **never silently deleted or rewritten**. Model on the existing builtin-category case: `orrery-system-read.ts:59-65` returns `status: "missing-category"` and `MissingOrreryCategoryError` (lines 166-171). Custom Systems need an analogous per-rule broken flag while other valid rules keep resolving. A reviewer flagging silent rule removal is an escalation trigger (CLAUDE.md).

**Feed the id-set into the UNCHANGED pipeline:** `readOrrerySystemMembersCore` → `readOrrerySystemSnapshotCore` (orrery-system-read.ts:54-165) → store → renderer. Do not fork that pipeline.

---

### `src/logic/orrery-system-logic.ts` (logic) — EXTEND

**Analog:** self (verified lines 17-115).

**Extend the closed union (lines 24-26) — do not fork it (Pattern 1):**
```typescript
export type OrrerySystemRef =
  | { kind: "builtin"; id: OrreryBuiltinId }
  | { kind: "category"; uid: string }
  | { kind: "custom"; uid: string };   // NEW
```
- `systemRefId` (lines 55-62) must emit `custom:<uid>`; `parseSystemRef` (lines 44-54) must round-trip it (add a `token.startsWith("custom:")` branch alongside the existing `"category:"` branch at line 51).
- `buildOrrerySystemWhere` (lines 73-115) keeps the fast static path for builtin/category; custom is routed to the new resolver, not a WHERE.

---

### `src/db/app-settings-dao.ts` (dao, grammar) — EXTEND

**Analog:** self (verified lines 50-84).

Widen two things **together** so `custom:<uid>` round-trips:

**Type (lines 58-60):**
```typescript
export type OrrerySystemId =
  | (typeof ORRERY_BUILTIN_SYSTEM_IDS)[number]
  | `category:${string}`;   // add | `custom:${string}`
```

**Validator (lines 74-84):**
```typescript
export function assertOrreryLastSystem(field: string, value: unknown): void {
  if (typeof value === "string" &&
    ((ORRERY_BUILTIN_SYSTEM_IDS as readonly string[]).includes(value) ||
      /^category:[^\s\p{Cc}]{1,256}$/u.test(value)))   // add a parallel custom: alternative
    return;
  throw new Error(...);
}
```
The SQL column CHECK is only `length BETWEEN 9 AND 265` (migration021 line 17), so `custom:<uid>` already passes the column — only the TS grammar rejects it today. Purely additive: no stored value becomes invalid (existing devices only hold `builtin:*`/`category:*`). `orreryLastSystem` is already in `PORTABLE_SETTINGS_KEYS` (backup-schema.ts:178).

---

### `src/components/orrery/OrrerySystemSelector.tsx` + `orrery-controls-logic.ts` (component + logic) — EXTEND

**Analog:** self (verified: selector full file; controls-logic lines 1-64).

**Extend `buildSystemChoices` (orrery-controls-logic.ts:7-26):** currently `[...BUILTIN_SYSTEMS, ...categories.sorted().map(...)]`. Add custom Systems, apply Management order + visibility (hidden omitted), and carry empty/broken severity + live counts (ORRS-11). Return `SystemDescriptor`-shaped rows.

**Switcher row rendering (selector lines 148-177):** copy the `accessibilityRole="radio"` + `accessibilityState={{ checked, busy }}` + accent-vs-border selected styling; add the `{systemName} — {count}` count and distinct `system-empty` (statusWobble) / `system-broken` (danger) indicators — **icon shape + text, never hue alone** (UI-SPEC §Y). Add these three icon keys centrally to `icon-registry.ts`: `system-empty`, `system-broken`, `system-overrides` (never inline glyphs).

**Focus / dismiss lifecycle to REUSE verbatim (selector lines 71-79) — the required Skia/overlay pattern:**
```typescript
useEffect(() => { if (!focused) dismiss(); }, [focused, dismiss]);
useEffect(() => {
  const subscription = AppState.addEventListener("change", (v) => { if (v !== "active") dismiss(); });
  return () => subscription.remove();
}, [dismiss]);
```
Same `useIsFocused()` + AppState-background pause governs the new switch animation (never per-frame React state).

---

### `src/components/orrery/ManageMembersGrid.tsx` (component, multi-select) — NEW

**Analog:** `src/logic/contact-picker-selection.ts` + `contact-picker-source.ts` (verified). **NOT `src/components/ContactPicker.tsx`** — that is a single-select bottom-sheet Modal (`onSelect: (contactId: number) => void`, verified line 25/98). Build a NEW virtualized multi-select grid on the *logic* modules (dossier §M forbids a second selection system; A3).

**Selection state (contact-picker-selection.ts:3-26):**
```typescript
export function toggleSelection(selected: ReadonlySet<string>, lookupKey: string): Set<string> { ... }
export function selectionCount(selected: ReadonlySet<string>): number { return selected.size; }
export function matchesQuery(row: ContactPickerRow, term: string): boolean { ... }  // name + searchMethods
export function filterRows(rows, term): ContactPickerRow[] { ... }
```
Use `Set`-based selection + `filterRows` for the search box.

**Row shape (contact-picker-source.ts:9-35):** `ContactPickerRow` (lookupKey, displayName, searchMethods, photoThumbUri) with `toPickerRows` + initials fallback (`"Unnamed contact"`).

Phase-specific (ORRS-06): rule matches enter preselected; deselecting a rule-derived member marks it **Excluded** in place (`textSecondary`, reduced opacity), not removed; Add People adds eligible **active** contacts tagged **Added**; counts `{count} members · {added} added · {excluded} excluded`; virtualize so hundreds of cards do not eager-mount (§Z). 44×44 min touch targets.

---

### `src/screens/SystemBuilderScreen.tsx`, `SystemsManagementScreen.tsx`, `SystemPreviewCanvas.tsx` (screens/component) — NEW

**Analogs:** `OrrerySystemSelector.tsx` (GlassSurface overlay + focus/AppState lifecycle + `OrreryObstacle` + `shellTransientStore`); Phase 29 orrery canvas for the Preview/switch render; `orrery-system-store.ts` for select/save semantics.

**Store select/save semantics to consume (orrery-system-store.ts:66-124) — do not reinvent (ORRS-08):**
- `select(system, name)` bumps a generation guard and publishes async by generation (lines 66-97) — save-new switches; the store already handles fallback and `MissingOrreryCategoryError` (lines 113-122).
- `persist` uses the serialized preference writer (lines 51-65).
- Delete-fallback (ORRS-10): store falls back to `ALL_CONTACTS_SYSTEM` (already the default `requested`, lines 128-132).

**Reuse verbatim (Don't-Hand-Roll):** `useDiscardKeepGuard` (`src/navigation/discard-keep-guard.ts`) for unsaved changes (§P); `snackbar-store` for the Undo-after-delete snackbar (§R); `useReducedMotionShared()` / `useReducedMotion()` (`src/theme/use-reduced-motion.ts`, ADR-085) for the switch reduced-motion path (§X).

**Switch animation (ORRS-13, §W):** Skia render loop / Reanimated shared values, intensity adaptive to membership delta, pause on `useIsFocused===false` / AppState background. **Never per-frame React state** (CLAUDE.md). **Define worklet helpers ABOVE their callers** in the same file (MEMORY worklet forward-ref hazard — undefined-on-device Hermes crash vitest cannot catch; already bit Phase 29). All colours via `useTheme().colors[...]`, including Skia draws (`npm run check:colors` gate).

**Reorder (ORRS-09):** goes through `commitRingReorder` (ring-seq-dao.ts:80-133) — see Shared Patterns; do NOT narrow its guards to a System.

---

### `src/backup/backup-schema.ts` (validation, declare-only) — EXTEND

**Analog:** self (verified lines 150-220).

**Declare-only idiom (Pitfall 4, D-06) — the established Phase 23/25/29 pattern:** allowlist keys / accept shapes on restore, but **do NOT emit to the wire and do NOT bump `BACKUP_FORMAT_VERSION`** (already 4; emission is Phase 36). Precedent (lines 156-178): Phase 23/25/29 keys added to `PORTABLE_SETTINGS_KEYS` with the "allowlisted NOW … NOT emitted this phase" comment.

**Restore validation (lines 200-220):** `assertPortableSettings` calls `assertOrreryLastSystem` — widening that validator (above) automatically makes restore accept `custom:*` (do not silently coerce). For the Systems *tables* (not settings), this phase only documents the entity shape + validation + orphan-repair expectations as a contract Phase 36 consumes. Any edit to `export-manifest.ts` / `BACKUP_FORMAT_VERSION` / `FORWARD_MIGRATIONS` this phase is a warning sign.

## Shared Patterns

### DAO core+mutex pair with revision bump
**Source:** `src/db/memories-dao.ts:94-130, 296-305` (+ `assertOneChange` 77-88).
**Apply to:** every `systems-dao.ts` mutation. Non-mutexed `…Core` composes inside a caller transaction; public wrapper adds `inWriteTransaction` + `bumpDataRevisionCore`; `?`-bound params only; `changes===1` guard.

### Closed-grammar validators + `?`-bound SQL (V5 input validation)
**Source:** `app-settings-dao.ts:74-84`; `dashboard-query-logic.ts:83-115`.
**Apply to:** the resolver, the DAO, the grammar. Rule/name values are always `?`-bound; family/tier/value tokens are chosen from closed constants and never interpolated into SQL. Identifiers never interpolated.

### Ring-seq reorder over the COMPLETE population (trip-wire — Pitfall 3)
**Source:** `src/db/ring-seq-dao.ts:80-133` (`commitRingReorder`) + `147-198` (`rewriteRingSeqCore` three guards).
**Apply to:** any reorder inside a filtered System. `commitRingReorder` already takes an `OrrerySystemRef` and reconciles the visible subset against the full population via `mergeVisibleRingOrder` (lines 114-127). A custom System is just another `system` argument — **do not narrow Guard 1 (uniqueness), Guard 2 (complete-set count), or Guard 3 (live-contact scoped UPDATE)**; removing/narrowing a guard corrupts ring order.

### Overlay focus / AppState-background dismiss
**Source:** `OrrerySystemSelector.tsx:71-79` (+ `shellTransientStore` registration 51-70).
**Apply to:** HUD, Preview, switcher, management transients, and the switch animation pause condition.

### Reduced motion, snackbar undo, discard guard (reuse verbatim)
**Sources:** `src/theme/use-reduced-motion.ts` (ADR-085); `src/stores/snackbar-store.ts`; `src/navigation/discard-keep-guard.ts`.
**Apply to:** switch animation (§X), delete undo (§R), unsaved-changes guard (§P).

### Local date/time helpers (never `toISOString().split`)
**Source:** CLAUDE.md; ring-seq uses `localDateTime()`. Use `formatLocalDate()` / `localDateTime()` for any created_at/modified_at.

## No Analog Found

None. Every artifact this phase creates or extends has a strong on-disk analog. The genuinely *new* logic — the custom-System membership resolver — has no single-file analog but is pure composition of three verified modules (`dashboard-query-logic`, `dashboard-gravity-filter`, `orrery-system-read`), so it is a role-match rather than a gap.

## Metadata

**Analog search scope:** `src/db/`, `src/db/migrations/`, `src/logic/`, `src/stores/`, `src/components/orrery/`, `src/components/`, `src/backup/`, `src/theme/`.
**Files read on disk this session:** 016-contact-knowledge.ts, 021-orrery-preferences.ts, orrery-system-logic.ts, app-settings-dao.ts (50-99), dashboard-query-logic.ts (1-160), dashboard-gravity-filter.ts, orrery-system-read.ts, orrery-system-store.ts (40-164), OrrerySystemSelector.tsx, orrery-controls-logic.ts, contact-picker-selection.ts, contact-picker-source.ts, ring-seq-dao.ts (80-198), memories-dao.ts, backup-schema.ts (150-220), database.ts (grep: TARGET_VERSION 21, MIGRATIONS array), ContactPicker.tsx (grep: single-select onSelect).
**Migration number:** head = 021 (verified `ls` + `TARGET_VERSION = 21`) → this phase = **022** (re-verify at plan time, D-03).
**Pattern extraction date:** 2026-09-08
```
