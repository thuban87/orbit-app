# Phase 8: Dashboard & Never-Contacted Screen - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 16 new/modified
**Analogs found:** 15 / 16 (1 net-new dependency-backed screen has only a partial analog)

> All analog excerpts below were read from the ACTUAL files on disk, not from RESEARCH.md summaries.
> Project rules enforced throughout: colours only via `useTheme().colors.*` (no hex outside `theme-presets.ts`); async-only reads (`getAllAsync`/`getFirstAsync`, never `...Sync`); the dashboard is READ-ONLY and adds **no** writer to `contacts.last_contact`; `formatLocalDate()` / `date('now','localtime')` for dates; never nest `inWriteTransaction`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/dashboard-read.ts` | db read DAO | CRUD (read) / request-response | `src/db/queries.ts` + `src/db/fuel-read.ts` | exact (composition of both) |
| `src/db/dashboard-read.test.ts` | test | unit | `src/db/fuel-read.test.ts` (parity-test convention) | role-match |
| `src/db/favourites-dao.ts` | db write DAO | CRUD (write) | `setContactPhoto`/`clearContactPhoto` in `src/db/contacts-dao.ts:518-563` | exact |
| `src/db/favourites-dao.test.ts` | test | unit | existing `db/*.test.ts` | role-match |
| `src/logic/birthday-logic.ts` | pure logic | transform | `src/screens/edit-contact-logic.ts` (`*-logic.ts` convention) + legacy `~/projects/Orbit/.../BirthdayBanner.tsx` (bug source) | role-match |
| `src/logic/birthday-logic.test.ts` | test | unit | existing `*-logic.test.ts` | role-match |
| `src/logic/favourites-reorder-logic.ts` | pure logic | transform | `src/screens/edit-contact-logic.ts` convention | role-match |
| `src/logic/favourites-reorder-logic.test.ts` | test | unit | existing `*-logic.test.ts` | role-match |
| `src/stores/dashboard-prefs-store.ts` | store | persisted state | `src/stores/theme-store.ts` | exact |
| `src/screens/HomeScreen.tsx` (→ dashboard) | screen | request-response | `src/screens/FuelSearch.tsx` (cancelled-flag async) + `ArchivedContactsScreen.tsx` (focus/load) | role-match |
| `src/screens/NeverContactedScreen.tsx` | screen | request-response | `src/screens/ArchivedContactsScreen.tsx` | exact |
| `src/screens/ManageFavouritesScreen.tsx` | screen | event-driven (drag) | `ArchivedContactsScreen.tsx` chrome; drag lib net-new | partial |
| `src/screens/ContactProfileScreen.tsx` (EXTEND: star) | screen | request-response | `setContactPhoto` call sites + FuelSearch async | role-match |
| `src/screens/SettingsScreen.tsx` (EXTEND: +row, −search) | screen | request-response | existing Settings rows | exact |
| `src/components/ContactCard.tsx` | component | request-response | `src/components/FuelSearchResultRow.tsx` + `Avatar` + `RankedFuelLine` | role-match |
| `src/navigation/RootNavigator.tsx` + `types.ts` (EXTEND) | route config | config | `src/navigation/RootNavigator.tsx` self | exact |
| `src/components/BirthdayBanner.tsx` | component | request-response | `FuelSearchResultRow.tsx` (row idiom) | role-match |
| `src/components/FilterChipRow.tsx` | component | event-driven | (no RN chip analog — new) | none |

## Pattern Assignments

### `src/db/dashboard-read.ts` (db read DAO, read)

**Analog:** `src/db/queries.ts` (status scan) + `src/db/fuel-read.ts` (fuel + search fragments). Reuse the exact SQL fragments — do NOT re-derive thresholds, the fuel RANK_CASE, exclusions, or `escapeLike`.

**Status/progress fragment reuse** (`src/db/status.ts:59-73`, `src/db/queries.ts:26-29`):
```typescript
// import { PROGRESS_SQL, STATUS_SQL, STABLE_MAX } from "@/db/status";
// Base predicate (mirrors STATUS_SCAN's load-bearing NULL guard):
//   WHERE archived_at IS NULL
//     AND last_contact IS NOT NULL          -- load-bearing: STATUS_SQL buckets NULL as 'stable'
//     AND (snooze_until IS NULL OR date(snooze_until) <= date('now','localtime'))
// SELECT ..., (${PROGRESS_SQL}) AS progress, (${STATUS_SQL}) AS status
```
- CRITICAL (from `status.ts:11-19`): only `now` gets `'localtime'`. Stored columns (`snooze_until`, `last_contact`) are already local wall-clock — use `date(snooze_until)` with NO modifier, or you reintroduce the fixed double-conversion HIGH.
- Status sort rank CASE mirrors `queries.ts:62-68` `statusOrder` (`rogue:0, decay:1, wobble:2, stable:3`). `progress DESC` alone is acceptable for v1 (STATUS_SCAN uses it).

**Fuel-line + search fragment reuse** (`src/db/fuel-read.ts:79-115, 176-205`):
```typescript
// RANK_CASE (fuel-read.ts:79-82) + the three exclusions (fuel-read.ts:112-114):
//   AND kind != 'off_limits'
//   AND source != 'ai'
//   AND NULLIF(TRIM(text, char(9)||char(10)||char(11)||char(12)||char(13)||char(160)||' '), '') IS NOT NULL
// Fold as a correlated subquery for the card's ranked-fuel snippet column.
// Extract these shared fragments (RANK_CASE + exclusion tuple) from fuel-read.ts and
// cover the extraction with a PARITY test (fuel-read.test.ts convention) so they cannot drift.
```

**Search predicate reuse — copy `escapeLike` verbatim** (`src/db/fuel-read.ts:147-149`):
```typescript
function escapeLike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
// Reuse SEARCH_FUEL's name-OR-fuel EXISTS shape (fuel-read.ts:176-196), binding `%${escapeLike(term)}%`
// with `LIKE ? ESCAPE '\'` on EVERY predicate. Empty/whitespace term → return [] before querying (fuel-read.ts:202).
```
- Open question flagged to owner (RESEARCH Q4/A3): dashboard search may widen past never-contacted/snooze exclusions. `searchFuel` already excludes archived-only — decide scope at plan review.

**Async-only read** (every DAO here): `return exec.getAllAsync<Row>(SQL, params)` — never a `...Sync` call. No `inWriteTransaction` (pure read).

---

### `src/db/favourites-dao.ts` (db write DAO, write)

**Analog:** `setContactPhoto`/`clearContactPhoto` — `src/db/contacts-dao.ts:518-563`. Mirror it exactly: single `inWriteTransaction`, `?`-bound single-column UPDATE, `changes===1` loud-failure guard, `modified_at` bumped, `last_contact` untouched.

**Toggle pattern** (`contacts-dao.ts:547-563`):
```typescript
export function clearContactPhoto(exec, id, now): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE contacts SET photo = NULL, modified_at = ? WHERE id = ?", [now, id]);
    if (result.changes !== 1) {
      throw new Error(`clearContactPhoto: no contact matched id=${id} (changed ${result.changes})`);
    }
  });
}
```
Apply verbatim shape to:
- `setFavouriteRank(exec, id, now)` → `favourite_rank = (SELECT COALESCE(MAX(favourite_rank),-1)+1 FROM contacts)` (append at end).
- `clearFavouriteRank(exec, id, now)` → `favourite_rank = NULL`.
- `rewriteFavouriteRanks(exec, orderedIds[], now)` → ONE `inWriteTransaction`, N `?`-bound UPDATEs (rank = index 0..n-1) INSIDE it.

**Transaction rule** (`src/db/transaction.ts:11-29`): the mutex is NON-REENTRANT. `rewriteFavouriteRanks` must NOT call the single-write `setFavouriteRank` in a loop — issue raw UPDATEs inside the one outer transaction, or it deadlocks permanently (RESEARCH Pitfall 6).

**Invariant note:** `updateContactMetadataCore`'s SET list omits `favourite_rank` (verified analog reasoning at `contacts-dao.ts:500-512` re: `photo`) — a dedicated single-column writer is correct and does NOT touch DATA-04's `last_contact`.

---

### `src/logic/birthday-logic.ts` (pure logic, transform)

**Analog (convention):** `src/screens/edit-contact-logic.ts:98-124` (`parseBirthdayForForm`/`buildBirthdayForStorage`) — same MM-DD (5-char) vs YYYY-MM-DD string discrimination the parser must accept.
**Analog (bug source, fix contract only):** `~/projects/Orbit/src/components/BirthdayBanner.tsx:64-95`.

**Bug 1 — day-of drop** (`BirthdayBanner.tsx:82-88`):
```javascript
const today = new Date();                              // carries time-of-day
let birthdayThisYear = new Date(thisYear, month, day); // local midnight
if (birthdayThisYear < today) { ...next year... }      // on the day: midnight < now → rolls +365, "Today!" dead
```
Fix: truncate `today` to local midnight before comparing so `daysUntil === 0` is reachable. Node-test at multiple times-of-day.

**Bug 2 — Feb-29 → Mar-1 overflow** (`new Date(y, 1, 29)` overflows in non-leap years). Fix: detect month==Feb & day==29, choose observed day explicitly (owner picks Feb-28 vs Mar-1 at plan review — RESEARCH Q2/A2). Node-test a non-leap year.

**Signature:** `daysUntilBirthday(stored: string, today: Date): number | null` — react-native-free (Vitest-node-tested), keeps optional year, reused by Phase 11. Banner predicate: exclude archived ONLY; overrides snooze/never-contacted suppression.

---

### `src/logic/favourites-reorder-logic.ts` (pure logic, transform)

**Analog:** the `*-logic.ts` convention (`edit-contact-logic.ts`). Extract the drag from-index/to-index → new ordered id array as a pure node-tested function; the transactional write stays in `favourites-dao.ts`.

---

### `src/stores/dashboard-prefs-store.ts` (store, persisted state)

**Analog:** `src/stores/theme-store.ts:25-49` — copy the Zustand `persist` + `createJSONStorage(AsyncStorage)` shape verbatim.

**Full pattern** (`theme-store.ts:25-49`):
```typescript
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({ mode: "dark", presetId: DEFAULT_PRESET_ID,
      setMode: (mode) => set({ mode }), setPreset: (presetId) => set({ presetId }) }),
    { name: "orbit-theme", storage: createJSONStorage(() => AsyncStorage), version: 1,
      partialize: (state) => ({ mode: state.mode, presetId: state.presetId }),
      onRehydrateStorage: () => (_state, error) => { if (error) console.warn(...); } },
  ),
);
```
Adapt: `name: "orbit-dashboard-prefs"`, state `{ sort: "status", filter: "all" }`, `partialize` persists only sort+filter. AsyncStorage (no SQLite settings row) per RESEARCH A-map.

---

### `src/screens/HomeScreen.tsx` → dashboard (screen, request-response)

**Analogs:** `src/screens/FuelSearch.tsx` (cancelled-flag live-search async) + `src/screens/ArchivedContactsScreen.tsx` (`useCallback` load + `getExecutor()`).

**Freshness path (NEW — focus + AppState + pull-to-refresh, NOT `addDatabaseChangeListener`).** `ArchivedContactsScreen.tsx:18,93` already imports `useCallback`/`useEffect`/`useState` and does `setRows(await listArchived(getExecutor()))`. Extend with:
- `useFocusEffect(useCallback(...))` re-query on focus (guard with a `cancelled` flag — see below).
- `AppState.addEventListener("change", s => s === "active" && reload())`.
- `<FlatList refreshControl={<RefreshControl ... tintColor={colors.accent} />}>`.

**Cancelled-flag async guard** (copy from `FuelSearch.tsx:50-64`):
```typescript
useEffect(() => {
  let cancelled = false;
  (async () => {
    try { const rows = await searchFuel(getExecutor(), term); if (!cancelled) setResults(rows); }
    catch (err) { Logger.error(LOG_SCOPE, "search failed", err); if (!cancelled) setResults([]); }
  })();
  return () => { cancelled = true; };
}, [term]);
```
Reuse this shape for every dashboard load (filter/sort/term deps). Async only.

**Nav + theme boilerplate** (`HomeScreen.tsx:20-23`): `useNavigation<NativeStackNavigationProp<RootStackParamList>>()`, `const { colors } = useTheme()`, root `testID` + `backgroundColor: colors.background`. testIDs per UI-SPEC (`dashboard-root`, etc.).

---

### `src/screens/NeverContactedScreen.tsx` (screen, request-response)

**Analog:** `src/screens/ArchivedContactsScreen.tsx` (exact — list screen, own Back chrome, `useCallback` load, FlatList). Read = inverse predicate (`last_contact IS NULL`), own sort control defaulting to `created_at ASC` (Oldest added). Reuses `ContactCard`.

---

### `src/screens/ManageFavouritesScreen.tsx` (screen, event-driven — partial analog)

**Analog:** `ArchivedContactsScreen.tsx` chrome (Back, themed root). Drag list is net-new (`react-native-reorderable-list`, OWNER-CONFIRMS the dependency at plan review — gate with a `checkpoint:human-verify` task before install). No-dep fallback = up/down arrows driving the same `rewriteFavouriteRanks`. Rows: `Avatar` + name + drag handle; reorder-only. On drag-end → `rewriteFavouriteRanks`. testIDs: `manage-favourites-root`, `manage-favourites-row-{id}`, `manage-favourites-handle-{id}`.

---

### `src/screens/ContactProfileScreen.tsx` (EXTEND — favourite star)

**Analog:** `setContactPhoto` call sites + the FuelSearch cancelled-flag async. Add `testID="contact-profile-favourite-star"`, accessibilityLabel toggling "Mark favourite"/"Remove favourite". Calls `setFavouriteRank`/`clearFavouriteRank`. Reversible, non-destructive → NO confirmation dialog.

---

### `src/components/ContactCard.tsx` (component, request-response)

**Analogs:** `src/components/FuelSearchResultRow.tsx` (row idiom: name↔snippet 2px gap, `minHeight:44`, tail-ellipsis), `Avatar`, `RankedFuelLine` (reused unchanged).

**Avatar correctness wiring** (`src/components/Avatar.tsx:37-78`): `recyclingKey` is already wired (`recyclingKey={bust ? ...}` at :78, cacheKey folds `cacheBust` at :74). Pass `contactId={contactId}` + `cacheBust={modified_at}` — a CORRECTNESS requirement (anti-face-flash), not an optimization.
```tsx
<Avatar photo={photo} name={name} contactId={contactId} cacheBust={modified_at} size={48} />
<RankedFuelLine text={top?.text} testID={`dashboard-card-fuel-${contactId}`} />
```
Card content contract LOCKED (UI-SPEC): avatar, status ring, name (`numberOfLines={1}`), one-line fuel OR search snippet, category label (hidden when null), favourite marker. FORBIDDEN: anything log-derived. Card carries `testID="dashboard-card-status-{id}"` + accessibilityLabel naming status (UAT asserts without colour).

---

### `src/navigation/RootNavigator.tsx` + `types.ts` (EXTEND — config)

**Analog:** the files themselves (`RootNavigator.tsx:48-64`, `types.ts:20-46`).
- Register `NeverContacted` + `ManageFavourites` screens; retire `FuelSearch` route (`RootNavigator.tsx:62`) + its `types.ts:45` entry.
- Dashboard stays `Home` content — `initialRouteName="Home"` unchanged (`RootNavigator.tsx:51`); `HomeScreen` becomes the dashboard surface.
- `RootStackParamList` (`types.ts:20`) is a `type` alias (needed for `ParamListBase` index signature) — add the two routes as `undefined`.

## Shared Patterns

### Async-only read path (DASH-07 / HANDOFF §3)
**Source:** `src/db/fuel-read.ts:62,127,204` (`exec.getAllAsync`), `ArchivedContactsScreen.tsx:95`.
**Apply to:** every read in `dashboard-read.ts` and every screen load. Never `getAllSync`/`getFirstSync`. Guard each async load with a `cancelled` flag (`FuelSearch.tsx:50-64`).

### Write transactionality + non-reentrancy
**Source:** `src/db/transaction.ts:42-57` (`inWriteTransaction`) + the non-reentrancy note (`:11-29`).
**Apply to:** `favourites-dao.ts` only (dashboard reads open no transaction). ONE outer `inWriteTransaction`; never nest; `rewriteFavouriteRanks` issues N raw UPDATEs inside one transaction.
```typescript
return inWriteTransaction(exec, async () => {
  const result = await exec.runAsync("UPDATE contacts SET ... WHERE id = ?", [...]);
  if (result.changes !== 1) throw new Error(`...: no contact matched id=${id} (changed ${result.changes})`);
});
```

### In-query exclusion of private data (V4 access control)
**Source:** `src/db/fuel-read.ts:112-114,181-183,191-194`.
**Apply to:** the dashboard fuel-line column AND the search predicate. `kind != 'off_limits'` + `source != 'ai'` + non-blank `NULLIF(TRIM(...))` must live IN THE SQL, never a component `.filter()`.

### LIKE-escape + `?`-binding (V5 input validation)
**Source:** `src/db/fuel-read.ts:147-149` (`escapeLike`) + `LIKE ? ESCAPE '\'`.
**Apply to:** every search predicate in `dashboard-read.ts`. Term is `?`-bound AND escaped; only code-constant identifiers interpolated.

### Local-date correctness
**Source:** `src/db/status.ts:11-19,59` (only `now` gets `'localtime'`); `src/utils/dates.ts:17` (`formatLocalDate`).
**Apply to:** every date comparison — `date('now','localtime')` for now, bare `date(col)` for stored columns; `formatLocalDate()`/`localDateTime()` for written timestamps.

### Colour tokens only
**Source:** every analog screen (`useTheme().colors.*`). **Apply to:** all new UI. Status-ring band colours (`stable`/`wobble`/`decay`) are a TOKEN GAP → owner decision (UI-SPEC Owner Decision 1); until resolved, ship a non-colour status indicator + a11y label. `check:colors` bars invented hexes.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/FilterChipRow.tsx` | component | event-driven | No horizontal chip-row component exists in `src/components/` yet — build from RN `Pressable`/`ScrollView` primitives per UI-SPEC (active = `accent`/`borderStrong`, inactive = `surface`/`border`). Planner uses UI-SPEC Interaction States, not a code analog. |

Partial-only: `ManageFavouritesScreen.tsx` — chrome from `ArchivedContactsScreen`, but the drag-list mechanic is a net-new owner-gated dependency (no in-repo reorder analog).

## Metadata

**Analog search scope:** `src/db/`, `src/stores/`, `src/screens/`, `src/components/`, `src/navigation/`, `src/theme/`, `~/projects/Orbit/src/components/`.
**Files scanned:** 13 (all read on disk: queries.ts, fuel-read.ts, status.ts, contacts-dao.ts, transaction.ts, theme-store.ts, FuelSearch.tsx, HomeScreen.tsx, RootNavigator.tsx, types.ts, edit-contact-logic.ts, legacy BirthdayBanner.tsx, Avatar.tsx/ArchivedContactsScreen.tsx via grep).
**Pattern extraction date:** 2026-08-15
