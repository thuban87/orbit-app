# Phase 8: Dashboard & Never-Contacted Screen - Research

**Researched:** 2026-08-15
**Domain:** React Native / Expo home-screen list UI over on-device SQLite — flat status-sorted list, filter/segment/search controls, sibling list screens, birthday banner, favourites, offline focus-refresh freshness
**Confidence:** HIGH (the read/write substrate, reusable components, and freshness constraints are all verified first-hand on disk; the ONE net-new dependency — a drag-reorder library — is the only MEDIUM area, and it is an explicit owner-confirmed decision)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area 1 — Never-Contacted screen (domain 8 owns it)**
- **Card:** reuse the same dashboard card component (renders the fuel line); no status-sort emphasis since never-contacted have no `last_contact`.
- **Sort:** OFFER ALL THREE sort options — oldest-added-first (`created_at ASC`), newest-added-first, A–Z by name — **defaulting to oldest-added-first**.
- **Reached from:** a counted "Not yet contacted (N)" entry on the dashboard that PUSHES the sibling screen onto the existing native-stack (NOT a dashboard segment).
- **Empty state:** a calm "you've reached everyone / no one is waiting" state (exact copy = owner's design pass).

**Area 2 — "Manage favourites" screen (net-new; shared with widget config, domain 12)**
- **One shared screen, two entry points** — not two separate screens.
- **Entry points (v1):** the favourites filter's "Manage" affordance + a Settings row. Widget config wires in at Phase 12.
- **Reorder mechanism:** a drag-reorder list. The exact library is a **planning decision** and, because it adds a dependency, **the owner confirms it at plan review**.
- **Scope:** reorder-only. Marking a favourite stays the per-contact profile star. (Unstar-on-this-screen declined.)

**Area 3 — Filter / segment affordance**
- **Control style:** a chip row (not the plugin's dropdown menu).
- **Combination:** a single active filter in v1. (Multi-select combine declined.)
- **Snoozed/favourites placement:** peers in the one chip row; the Snoozed chip carries its count.
- **Persistence:** persist last-used sort+filter across launches (AsyncStorage idiomatic; SQLite settings row an acceptable alternative). (Force-reset-on-launch declined.)

**Area 4 — Search behavior (the dashboard absorbs Phase 7's fuel search)**
- **UX:** a live in-place filter of the flat list. (Distinct results view declined.)
- **Fuel-match vs name-match:** on a fuel match, the card shows the matching fuel snippet (reuse `FuelSearchResultRow` idea); name matches render the normal card.
- **Backend:** reuse/extend `searchFuel` (name AND fuel text, `off_limits` excluded, unconfirmed `source='ai'` excluded).
- **Standalone Settings search:** retire the Phase 7 Settings entry and relocate search to the dashboard (expected, NOT a reversal).

**Adopted straight from dossier 08 "Decisions made without you" (owner may veto at plan review)**
- The contact-count ("N contacts") is retained in some header form.
- Rogue contacts sort at the far end of the continuous status band (exact rogue-vs-decay ordering is domain 9's call) — rogue contacts are NOT hidden.
- The birthday-banner window stays 7 days.
- The plugin's hardcoded category-group map is dropped entirely; single flat list, sort is the only organizer.

### Claude's Discretion (delegated to planning / implementation)
- The default dashboard query + indexes and the segment/filter variants.
- The freshness wiring: `useFocusEffect` re-query + `AppState`→active listener + pull-to-refresh; async-only query API (never `...Sync`).
- The name+fuel search query shape and whether it needs its own index (FTS5 stays deferred to v2).
- The recency-sort tiebreak and handling of derived `daysSinceContact`.
- The nav mechanism confirmation (app already runs react-navigation native-stack; dashboard becomes home/initial route).
- The drag-reorder library selection (owner confirms the dependency at plan review).
- Where last-used sort/filter is persisted (AsyncStorage vs SQLite settings row).

### Deferred Ideas (OUT OF SCOPE)
- Weekly **digest** — domain 14 (dashboard reserves no digest surface in v1).
- Birthday **notifications** — domain 11 (dashboard owns only the banner).
- The birthday banner's tap offering a **message action** — domain 11; not v1.
- **FTS5** search — v2 (plain `LIKE` scan is free at this scale).
- Reconcile the **07-photos SDK version-label drift** (workpaper pinned to SDK 55 / RN 0.83.4 while the project runs SDK 57 / RN 0.86) — a label reconcile, changes no decision.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Dashboard is home: flat list excluding never-contacted/archived/snoozed, status-sorted by default with name/least-recent/most-recent options | New `dashboard-read.ts` DAO (§Architecture Pattern 1). Predicate + sort variants fully specified; base scan `STATUS_SCAN` (queries.ts) already proves the status/progress projection. Nav: swap `initialRouteName` → dashboard becomes `Home` content (§Pattern 8) |
| DASH-02 | Filter by needs-attention, category, social battery, favourites, snoozed segment; search by name+fuel | Filter/sort predicates enumerated (§Pattern 1). Search folds `searchFuel`'s escape + exclusion predicates into the same DAO (§Pattern 4). Single active filter (locked) |
| DASH-03 | Card: avatar (themed fallback), status ring (incl. rogue), name, required one-line fuel preview, category label, favourite marker — nothing log-derived | Reuse `Avatar` + `RankedFuelLine` unchanged; status via `getContactStatus`/STATUS_SQL. Card fuel line from the ranked-fuel projection (§Pattern 4). **Status-ring band colours are a token gap → owner decision** (§Open Questions Q1) |
| DASH-04 | "Not yet contacted (N)" sibling screen (renders fuel) + count-less "Archived" entry reachable from dashboard; snoozed segment shows count | Never-contacted read = inverse predicate (`last_contact IS NULL`). Archived screen already exists (`ArchivedContactsScreen`). **No snooze writer exists yet — snoozed count is 0 until Phase 11** (§Open Questions Q3) |
| DASH-05 | 7-day birthday banner (soonest-first, tap→profile) for any non-archived contact, overriding snooze/never-contacted suppression, with day-of-drop + Feb-29 bugs fixed | Standalone node-testable `birthday-logic.ts` parser (§Pattern 3). Handles BOTH `MM-DD` and `YYYY-MM-DD` stored formats (verified). Both bugs diagnosed with fixes |
| DASH-06 | Mark favourite via profile star; order favourites by drag on a shared "Manage favourites" screen | `favourite_rank` ordered-nullable semantics + a single-column toggle DAO mirroring `setContactPhoto` (§Pattern 5). Drag lib = ONE net-new dep, owner-confirmed (§Standard Stack, §Pattern 5) |
| DASH-07 | Renders with no network; refreshes via focus + AppState-active + pull-to-refresh (not the change-listener); async queries + `recyclingKey`; cause-aware empty states | Freshness path fully specified with the platform reason `addDatabaseChangeListener` is unusable (§Pattern 2). `recyclingKey` already wired in `Avatar`. Async API only (verified everywhere) |
</phase_requirements>

## Summary

Phase 8 is overwhelmingly an **integration and read-composition** phase, not a new-capability phase. Every hard part already exists on disk and is verified: the query-time status engine (`status.ts` → `STATUS_SCAN`/`getContactStatus`), the ranked-fuel projection and cross-contact search (`fuel-read.ts` → `getRankedFuel`/`searchFuel`, with `off_limits` + unconfirmed-`ai` + archived exclusions structurally in-query), the reusable `Avatar` (with `recyclingKey` already correctly wired), `RankedFuelLine`, and `FuelSearchResultRow` presentational units, the native-stack shell (`RootNavigator`), the single-writer DAO discipline, and a proven Zustand-`persist`-over-AsyncStorage pattern (`theme-store.ts`) that the sort/filter persistence copies verbatim. The migration-1 schema already carries every column this phase needs — `favourite_rank`, `snooze_until`, `birthday`, `category_id`, `ring_seq` — so **no migration ships this phase**.

The real work is: (1) a new `dashboard-read.ts` read DAO that composes the status/progress scan + the ranked-fuel line + the category label + the favourite marker into ONE parametrized query (by filter, by sort, and by an optional search term), node-tested for its predicates; (2) a standalone node-testable birthday parser fixing two ported bugs; (3) wiring the freshness path correctly (focus + AppState, never the change-listener); (4) a favourite-rank toggle DAO + a drag-reorder "Manage favourites" screen; and (5) turning `HomeScreen` into the dashboard and registering two new routes.

**Primary recommendation:** Build one `dashboard-read.ts` DAO parametrized by `{filter, sort, searchTerm}` that reuses the existing SQL fragments (`PROGRESS_SQL`, `STATUS_SQL`, the fuel `RANK_CASE` + exclusion predicates, `escapeLike`) rather than re-deriving any of them — extract shared fragments where needed and cover the extraction with a parity test. Extract the birthday parser and every list predicate/sort comparator into react-native-free `*-logic.ts` modules so they are Vitest-node-tested; the `.tsx` screens stay device-UAT. The single net-new dependency is a drag-reorder list — recommend `react-native-reorderable-list` (actively maintained, Reanimated-4-compatible) over `react-native-draggable-flatlist` (more popular but stale for Reanimated 4), and gate the install behind the owner's plan-review confirmation.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dashboard list read (filter/sort/search) | Database (SQLite DAO) | — | All population/status/fuel/category logic is SQL over local tables; a new `dashboard-read.ts` is the single read chokepoint |
| Status/progress derivation | Database (query-time SQL) | — | DERIVED-NEVER-STORED via `PROGRESS_SQL`/`STATUS_SQL`; the card reads the SAME computed number the profile does |
| Fuel preview + search matching | Database (fuel-read fragments) | — | `getRankedFuel` / `searchFuel` already own the exclusion invariants in-query; the dashboard reuses them, never re-filters in the component |
| Birthday window computation | Pure logic (`*-logic.ts`, node-tested) | UI (banner render) | Date math is correctness-critical and must be unit-tested off-device; the parser is reused by Phase 11 |
| Freshness / re-query | UI (React screen: `useFocusEffect` + `AppState`) | — | A read-path concern; the change-listener is structurally unusable (F1), so focus/foreground events drive re-query |
| Favourite mark (write) | Database (single-column DAO) | UI (profile star) | A per-contact write mirroring `setContactPhoto`; the profile star is the trigger |
| Favourite reorder (write) | Database (rank rewrite DAO) | UI (drag list) | The drag gesture is UI; the persisted rank sequence is a transactional DB write |
| Sort/filter persistence | Client (AsyncStorage via Zustand persist) | — | A device-local UI preference, not contact data; not load-bearing, no SQLite row needed |
| Navigation (routes, home) | UI (react-navigation native-stack) | — | Already the app shell; add two screens + change the initial content |

## Standard Stack

### Core (all already installed — verified in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-sqlite` | ~57.0.1 | Async on-device reads (dashboard scan, search, favourite writes) | The project's data layer; async API only keeps the read path off the JS-thread block (HANDOFF §3) |
| `expo-image` | ~57.0.3 | Card avatars via the `Avatar` component | Zero network for `file://` sources; `recyclingKey` is the anti-face-flash correctness lever (F2) |
| `@react-navigation/native` + `native-stack` | ^7.3.16 / ^7.18.8 | Route the two new screens; make the dashboard home | Already the Phase-4 app shell; `headerShown:false`, each screen owns Back chrome |
| `react-native` (`FlatList`, `RefreshControl`, `TextInput`, `Pressable`, `AppState`) | 0.86.2 | List, pull-to-refresh, search input, chips, foreground detection | Platform primitives; `RefreshControl` + `AppState` are the freshness affordances |
| `@react-native-async-storage/async-storage` | 2.2.0 | Persist last-used sort+filter | Already a dependency; the `theme-store.ts` Zustand-`persist` pattern is the template — **no new dep** |
| `zustand` (+ `zustand/middleware` persist) | ^5.0.15 | Sort/filter preference store | Established store pattern (`theme-store.ts`) |
| `react-native-reanimated` + `react-native-gesture-handler` | 4.5.1 / ~2.32.0 | Underpin the drag-reorder list | Already installed (Phase 5 Skia/gesture work); satisfy the reorder lib's peer deps |

### Supporting (net-new — ONE dependency, owner-confirmed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native-reorderable-list` **[ASSUMED]** | 0.18.1 | The "Manage favourites" drag-reorder list | RECOMMENDED. Peer deps `react-native-reanimated >=3.12.0` + `react-native-gesture-handler >=2.12.0` — both satisfied by the installed 4.5.1 / 2.32.0. Actively maintained (published 2026-07-12), ~92k downloads/wk, source repo `github.com/omahili/react-native-reorderable-list`. **Owner confirms the dependency at plan review** |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-native-reorderable-list` | `react-native-draggable-flatlist` **[ASSUMED]** (4.0.3) | More popular (~436k downloads/wk) and battle-tested, BUT last published 2025-05-06 (stale ~15mo) and its peer floor is `react-native-reanimated >=2.8.0` with documented Reanimated-3+ breakages (`useValue not found`) — higher risk against the installed Reanimated **4**. Prefer the fresher lib whose peer range explicitly spans Reanimated 4 |
| A drag library at all | Up/down arrow buttons on each favourite row | Zero dependency, zero owner-risk-posture decision, node-testable reorder logic. A genuinely viable v1 fallback if the owner declines a new dep — worth offering at plan review as the no-dep option |
| Per-visible-row `getRankedFuel` calls | One correlated-subquery fuel column in the dashboard scan | N async calls on scroll vs one query. At ~150-contact scale either works, but a single composed query is cleaner and avoids scroll-time query storms (§Pattern 4) |
| AsyncStorage persistence | A SQLite settings row | AsyncStorage is idiomatic for a device-local UI preference and matches `theme-store.ts`; a SQLite row adds a migration for non-contact data. Use AsyncStorage |

**Installation (only if owner approves the drag lib at plan review):**
```bash
npx expo install react-native-reorderable-list
```
*(Everything else needed is already in `package.json`.)*

**Version verification:** `react-native-reorderable-list@0.18.1` confirmed on npm (published 2026-07-12); peer deps read directly from the registry. `react-native-reanimated@4.5.1` peer range is `react-native: 0.83 - 0.86` (covers the installed 0.86.2) and `react-native-worklets: 0.10.x` (present in `package-lock.json`). No dashboard/search/favourite code requires a version bump.

## Package Legitimacy Audit

> This phase installs AT MOST one external package, and only with owner approval.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `react-native-reorderable-list` | npm | published 2026-07-12 (v0.18.x line, multi-year project) | ~92k/wk | github.com/omahili/react-native-reorderable-list | OK (registry signals) — **[ASSUMED provenance]** (discovered via WebSearch) | Recommended; **owner-gated** at plan review |
| `react-native-draggable-flatlist` | npm | published 2025-05-06 | ~436k/wk | github.com/computerjazz/react-native-draggable-flatlist | OK (registry signals) — **[ASSUMED provenance]** (discovered via WebSearch) | Alternative only; staleness vs Reanimated 4 is the reason it's not the pick |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none by registry signal. However, BOTH candidates were discovered via WebSearch, so per provenance rules they are tagged **[ASSUMED]** regardless of registry health. The owner-confirms-the-dependency requirement is already a locked decision, so the planner MUST add a `checkpoint:human-verify` task before any install — the existing owner-approval gate satisfies this. No install proceeds without it.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
   Focus event ──────────▶│  DashboardScreen (was HomeScreen)           │
   AppState→active ──────▶│  - useFocusEffect: re-query on focus         │
   Pull-to-refresh ──────▶│  - AppState listener: re-query on foreground │
                          │  - RefreshControl: manual re-query           │
                          │  - sort/filter from Zustand(persist)         │
                          │  - searchTerm in local state (live)          │
                          └───────────────┬─────────────────────────────┘
                                          │ async getExecutor()
                                          ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  dashboard-read.ts  (NEW read chokepoint — node-tested SQL)  │
        │  listDashboard({ filter, sort, term })                       │
        │   WHERE archived_at IS NULL                                  │
        │     AND last_contact IS NOT NULL                             │
        │     AND (snooze_until IS NULL OR date(snooze_until) <= today)│
        │     [+ filter predicate] [+ name/fuel term predicate]        │
        │   SELECT id,name,photo,modified_at,category label,           │
        │          favourite_rank, (PROGRESS_SQL), (STATUS_SQL),       │
        │          (correlated ranked-fuel text), (search snippet)     │
        │   ORDER BY <sort>                                            │
        └───────┬───────────────────────┬──────────────────┬──────────┘
                │ reuses                 │ reuses           │ reuses
       PROGRESS_SQL/STATUS_SQL   fuel RANK_CASE +    escapeLike +
       (status.ts)               exclusion preds     LIKE ESCAPE preds
                                 (fuel-read.ts)      (fuel-read.ts)
                │                                          │
                ▼                                          ▼
      ┌──────────────────────┐              ┌──────────────────────────┐
      │ Card (FlatList row)  │              │ birthday-logic.ts (NEW,  │
      │  Avatar(recyclingKey)│              │  node-tested, pure)      │
      │  status ring         │              │  daysUntilBirthday()     │
      │  name                │              │  ↑ reused by Phase 11    │
      │  RankedFuelLine|snip │              └──────────┬───────────────┘
      │  category label      │                         │
      │  favourite marker    │              ┌──────────▼───────────────┐
      └──────────────────────┘              │ BirthdayBanner (excludes │
                                            │  archived only; 7-day)   │
   Sibling screens (new routes):            └──────────────────────────┘
     NeverContacted ── inverse predicate (last_contact IS NULL)
     ManageFavourites ── drag reorder → rewriteFavouriteRanks() DAO
   Existing route reused: Archived (ArchivedContactsScreen)
   Profile gains: favourite star → setFavouriteRank()/clearFavouriteRank() DAO
```

### Recommended Project Structure
```
src/
├── db/
│   ├── dashboard-read.ts        # NEW: listDashboard(filter,sort,term) + counts + never-contacted read
│   ├── dashboard-read.test.ts   # NEW: node tests for predicate/sort/snippet parity
│   ├── favourites-dao.ts        # NEW: setFavouriteRank/clearFavouriteRank + rewriteFavouriteRanks (transactional)
│   ├── favourites-dao.test.ts   # NEW
│   ├── fuel-read.ts             # EXTEND: export shared ranked-fuel fragment (RANK_CASE + exclusions) for reuse
│   └── queries.ts               # reference: STATUS_SCAN/statusOrder already here
├── logic/  (or alongside screens, matching repo convention)
│   ├── birthday-logic.ts        # NEW: pure daysUntilBirthday(), MM-DD & YYYY-MM-DD, both bugs fixed
│   ├── birthday-logic.test.ts   # NEW: day-of, Feb-29 non-leap, year-optional, past-rollover cases
│   ├── dashboard-filter-logic.ts# NEW (optional): pure comparators/predicate builders if any JS-side logic
│   └── *.test.ts
├── stores/
│   └── dashboard-prefs-store.ts # NEW: Zustand persist(sort+filter) — copy theme-store.ts
├── screens/
│   ├── HomeScreen.tsx           # BECOMES the dashboard surface
│   ├── NeverContactedScreen.tsx # NEW route
│   ├── ManageFavouritesScreen.tsx # NEW route (drag reorder)
│   ├── ContactProfileScreen.tsx # EXTEND: add favourite star toggle
│   └── SettingsScreen.tsx       # EXTEND: +Manage favourites row, −search row
├── components/
│   ├── ContactCard.tsx          # NEW: the shared dashboard/never-contacted card
│   ├── BirthdayBanner.tsx       # NEW: RN banner (NOT the plugin's DOM one)
│   ├── FilterChipRow.tsx        # NEW
│   ├── Avatar.tsx / RankedFuelLine.tsx / FuelSearchResultRow.tsx  # reused unchanged
└── navigation/
    ├── RootNavigator.tsx        # register NeverContacted + ManageFavourites; retire FuelSearch route
    └── types.ts                 # add the two routes to RootStackParamList; remove FuelSearch
```

### Pattern 1: The dashboard read DAO (default query + filter/segment/sort variants)

**What:** A single `listDashboard(exec, { filter, sort, term })` in a new `dashboard-read.ts`, returning the full card projection. Reuses `PROGRESS_SQL`/`STATUS_SQL` (status.ts) and the fuel/search fragments (fuel-read.ts) — never re-derives them.

**Default population predicate (DASH-01) [VERIFIED: queries.ts STATUS_SCAN + status.ts]:**
```sql
WHERE archived_at IS NULL
  AND last_contact IS NOT NULL
  AND (snooze_until IS NULL OR date(snooze_until) <= date('now','localtime'))
```
- `last_contact IS NOT NULL` is load-bearing, not cosmetic: `STATUS_SQL` alone buckets a NULL `last_contact` as `'stable'` (every comparison against NULL is false → ELSE). STATUS_SCAN documents exactly this.
- `date('now','localtime')` converts the true-UTC `now` to the local calendar day. **Do NOT wrap `snooze_until` in `'localtime'`** — stored timestamps are already local wall-clock (the fixed "timezone double-conversion" review HIGH in status.ts). Use `date(snooze_until)` (no modifier) for a day-granular compare, consistent with `PROGRESS_SQL`'s `date(last_contact)`.

**Filter variants (single active filter, locked) [CITED: dossier Cluster A; UI-SPEC Interaction States]:**
| Chip | Added predicate / ordering |
|------|----------------------------|
| `all` (default) | none beyond the base predicate |
| `needs-attention` | `AND (${PROGRESS_SQL}) >= ${STABLE_MAX}` → wobble+decay+rogue (0.8 threshold) |
| `category-{id}` | `AND category_id = ?` |
| `battery-{value}` | `AND social_battery = ?` (values: `'Charger'`/`'Neutral'`/`'Drain'` — verified in src/types.ts) |
| `favourites` | `AND favourite_rank IS NOT NULL`, `ORDER BY favourite_rank ASC` (rank order overrides the sort control) |
| `snoozed` | REVEAL the excluded population: replace the snooze clause with `AND snooze_until IS NOT NULL AND date(snooze_until) > date('now','localtime')`. Does NOT reverse 01-data C (default still hides them) |

**Sort variants (default = status) [CITED: dossier Cluster A; UI-SPEC]:**
| Sort | ORDER BY |
|------|----------|
| status (default) | `ORDER BY (${STATUS_SQL rank}) ASC, (${PROGRESS_SQL}) DESC` — or reuse `progress DESC` alone as STATUS_SCAN does. Rogue (progress ≥ ROGUE_K) naturally lands first; the rarely-responds rogue is the one case pure `progress DESC` under-ranks, so a status-rank CASE (mirroring `statusOrder`) then `progress DESC` is the precise form. Exact rogue-vs-decay ordering is domain 9's call, so either is acceptable for v1 |
| name (A–Z) | `ORDER BY name COLLATE NOCASE` |
| least-recent | `ORDER BY last_contact ASC, name COLLATE NOCASE` |
| most-recent | `ORDER BY last_contact DESC, name COLLATE NOCASE` |

**Recency-sort tiebreak + `daysSinceContact`:** every default-list row has `last_contact IS NOT NULL`, so ordering by the stored `last_contact` string directly is chronologically correct (local wall-clock strings sort lexically = chronologically, same property the DAOs rely on). There is **no need to compute `daysSinceContact`** for sorting — it would only be a display value, and the card shows nothing log-derived (forbidden). Tiebreak on `name COLLATE NOCASE` (stable, human-meaningful) then `id`.

**Index need:** NONE. Benchmark ceiling is ~150 contacts (`benchmark.ts` verified). A full scan of tens-to-low-hundreds of rows is well within budget (DATA-07 already proved the status scan). The existing `idx_interactions_recency (contact_id, occurred_at DESC)` serves the fuel/recency subqueries. FTS5 stays deferred to v2.

**When to use:** the single entry point for the dashboard list, the never-contacted list (inverse predicate), and every filter/sort/search combination.

### Pattern 2: The freshness path (focus + AppState + pull-to-refresh — NOT the change-listener)

**What:** Re-query on three triggers, async API only.
**Why the change-listener is unusable [VERIFIED: dossier F1 + expo-sqlite@57 API]:** `addDatabaseChangeListener` wraps SQLite's `sqlite3_update_hook`, which is **connection-scoped** — it "cannot access any changes made outside of that connection; not even other threads in the same process using a different connection." The widget/notification "mark contacted" write (04-log F5, Phase 11/12) runs **headless in a separate JS context on its own connection**, so a foreground listener is structurally blind to the single most important cross-context update. It also misses truncate-optimized deletes and `ON CONFLICT REPLACE`. Do not use it.

**The reliable path [CITED: dossier Cluster F; verified against ContactProfileScreen's existing `useFocusEffect` usage]:**
```typescript
// 1. Re-query when the screen regains focus (covers in-app navigation back to home).
useFocusEffect(
  useCallback(() => {
    let cancelled = false;
    (async () => {
      const rows = await listDashboard(getExecutor(), { filter, sort, term });
      if (!cancelled) setRows(rows);
    })();
    return () => { cancelled = true; };
  }, [filter, sort, term]),
);

// 2. Re-query on app foreground (covers home→widget-tap→reopen, which may fire NO nav event).
useEffect(() => {
  const sub = AppState.addEventListener("change", (s) => {
    if (s === "active") { /* re-run the same async load */ }
  });
  return () => sub.remove();
}, [/* stable load ref */]);

// 3. Pull-to-refresh: RefreshControl re-runs the identical query.
<FlatList refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.accent} />} ... />
```
- **Async ONLY** — never `getAllSync`/`getFirstSync` (documented to block the JS thread; HANDOFF §3). Every read in `dashboard-read.ts` uses `exec.getAllAsync`.
- Guard each async load with a `cancelled` flag (the `FuelSearch.tsx` pattern) so a stale result never clobbers a newer one.

**When to use:** the dashboard and the never-contacted screen; the profile star write should also trigger a local refresh of the card on return (it already re-focuses).

### Pattern 3: The single birthday parser (standalone, node-testable, two bugs fixed)

**What:** A pure `daysUntilBirthday(stored: string, today: Date): number | null` in `birthday-logic.ts`, react-native-free so Vitest tests it. Reused by Phase 11's birthday notification (NOTIF-04). Keeps the optional year.

**Storage formats it MUST accept [VERIFIED: edit-contact-logic.ts:98-124]:** `contacts.birthday` is stored as `MM-DD` (5 chars, year unknown) OR `YYYY-MM-DD` (year known). The parser must handle both — `parseBirthdayForForm` distinguishes them by string length; the plugin's parser used regex (`/^(\d{1,2})-(\d{1,2})$/` then `/^\d{4}-.../`). Either works; the day/month extraction is what matters.

**Bug 1 — the day-of drop [VERIFIED: ~/projects/Orbit/src/components/BirthdayBanner.tsx:12,83,86,47-48]:**
```js
const today = new Date();                              // carries a TIME-OF-DAY
let birthdayThisYear = new Date(thisYear, month, day); // LOCAL MIDNIGHT
if (birthdayThisYear < today) { ...next year... }      // on the birthday, midnight < now → rolls to NEXT year
```
On the actual birthday, `birthdayThisYear` (today at 00:00) is `< today` (now, later in the day) → rolls forward ~365 days → `daysUntil ≈ 365` → the contact **vanishes from the banner on their birthday**, and the `daysUntil === 0` "Today!" branch is dead code.
**Fix:** truncate `today` to local midnight before comparing (compare date-only). E.g. `const today0 = new Date(y, m, d)` from the current local Y/M/D, or compare on `date`-granular integers. Then `daysUntil === 0` is reachable.

**Bug 2 — Feb-29 → Mar-1 overflow [VERIFIED: same file, JS `Date` overflow]:** `new Date(thisYear, 1, 29)` in a non-leap year silently overflows to Mar 1. A Feb-29 birthday then shows on Mar 1 instead of being handled deliberately.
**Fix:** detect month==Feb & day==29 and choose the observed day in a non-leap year **explicitly** (the two sensible conventions are "observe on Feb 28" or "observe on Mar 1"). **This is a small product/taste call — flag it at plan review** (§Open Questions Q2); the bug is the *silent* overflow, so any explicit choice fixes it. Recommend Feb-28 observation (celebrate within the birth month) unless the owner prefers Mar-1.

**Predicate for the banner (DASH-05) [CITED: dossier Cluster E, F3]:** iterate a DELIBERATE predicate — **exclude archived only** (`archived_at IS NULL`), NOT the plugin's all-contacts loop. The banner OVERRIDES snooze- and never-contacted-suppression (a snoozed or never-contacted person's birthday still shows). Read: `SELECT id, name, birthday FROM contacts WHERE archived_at IS NULL AND birthday IS NOT NULL`, then filter/sort in JS via `daysUntilBirthday` (0..7, soonest first). Tap → `Profile`.

### Pattern 4: Name+fuel search folded into the dashboard list

**What:** When `term` is non-empty, the dashboard list becomes the search result set — a **live in-place filter** (locked), not a separate screen. Reuse `searchFuel`'s proven pieces rather than calling it as-is (its lean projection lacks status/photo/category/favourite the card needs).

**Recommended approach:** parametrize `dashboard-read.ts` with an optional `term`. When present, add the name-OR-fuel predicate and a snippet column, reusing `escapeLike` + the `LIKE ? ESCAPE '\'` + `kind != 'off_limits' AND source != 'ai'` predicates verbatim from `SEARCH_FUEL` [VERIFIED: fuel-read.ts:147-205]:
```sql
-- term present: add to WHERE (full card columns still selected)
AND ( name LIKE ? ESCAPE '\'
   OR EXISTS (SELECT 1 FROM fuel f WHERE f.contact_id = c.id
              AND f.kind != 'off_limits' AND f.source != 'ai'
              AND f.text LIKE ? ESCAPE '\') )
-- plus a correlated snippet subquery (same exclusions) → NULL on a name-only match
```
This keeps the full card for name matches and supplies the snippet for fuel matches (UI-SPEC "search-match variant"): name-only → normal `RankedFuelLine`; fuel-match → the matching snippet (the `FuelSearchResultRow` idea, folded into the card).

**The one scope question (§Open Questions Q4):** the existing `searchFuel` excludes archived only — it INCLUDES never-contacted. If the dashboard search keeps the dashboard's default population predicate, it won't find never-contacted people you saved fuel for (the "who did I save this for" case, which capture creates as never-contacted). Recommend the search widen past the never-contacted/snooze exclusions (like the birthday banner does) so search finds anyone non-archived — but flag for the owner, since it's a behavioral choice.

**Retire the standalone surface [CITED: STATE.md Phase-7 note; UI-SPEC]:** remove the `FuelSearch` route + `settings-search-row`; `FuelSearchResultRow` + the `searchFuel` predicates are the reusable units absorbed. This is expected, NOT a reversal.

**Index:** none needed (plain `LIKE` scan is free at ~150 contacts; FTS5 deferred to v2). ASCII-only case folding is expected (ICU absent) — do NOT "fix" it.

### Pattern 5: Favourites — mark (profile star) + reorder (drag screen)

**What:** `favourite_rank INTEGER` is an **ordered nullable rank** [VERIFIED: migration 001, contact-read.ts:110, reserved-columns.ts:42]. `NULL` = not a favourite; a non-null integer = a favourite at that rank position. Marking and ordering are a clean split (dossier Cluster D): the profile star marks; the shared screen orders.

**Mark toggle DAO (new `favourites-dao.ts`)** — mirror `setContactPhoto`/`clearContactPhoto` exactly (verified pattern in contacts-dao.ts:518-563): one `inWriteTransaction`, `?`-bound single-column UPDATE, `changes===1` loud-failure guard, `last_contact` untouched, `modified_at` bumped.
```
setFavouriteRank(exec, id, now):   append at the end → rank = (SELECT COALESCE(MAX(favourite_rank),-1)+1 FROM contacts), UPDATE contacts SET favourite_rank=?, modified_at=? WHERE id=?
clearFavouriteRank(exec, id, now): UPDATE contacts SET favourite_rank=NULL, modified_at=? WHERE id=?
```
Rank values need not be gap-free — ordering is by `favourite_rank ASC`. A gap after an unstar is harmless; the reorder screen can renormalize.

**Reorder DAO** — `rewriteFavouriteRanks(exec, orderedIds[], now)`: in ONE `inWriteTransaction`, rewrite each favourite's rank to its new index (0..n-1). Extract the ordering computation (drag from-index/to-index → new id array) into a pure `*-logic.ts` so it's node-tested; the transactional write is the only DB touch.

**The star write does NOT bump the single-writer invariant:** `favourite_rank` is not `last_contact`; DATA-04 is untouched. `updateContactMetadataCore`'s SET list deliberately omits `favourite_rank` (verified — it's not in the list), so a dedicated single-column writer is correct and consistent with how `photo` is handled.

**Profile star placement:** `ContactProfileScreen` (verified structure — header at testID `contact-profile-back`/`contact-profile-name`). Add `testID="contact-profile-favourite-star"` (accessibilityLabel toggles "Mark favourite"/"Remove favourite"). Reversible, non-destructive → NO confirmation dialog.

**Drag list:** `react-native-reorderable-list` (§Standard Stack). Rows = `Avatar` + name + drag handle; reorder-only (no unstar here). On drag-end, call `rewriteFavouriteRanks`. If the owner declines the dependency, the no-dep fallback is up/down arrow buttons driving the same DAO.

### Pattern 6: The shared contact card

**What:** ONE `ContactCard.tsx` used by the dashboard AND the never-contacted screen (locked: reuse the same card). Content contract is LOCKED (UI-SPEC): `Avatar` (with `recyclingKey={contactId}` + `cacheBust={modified_at}` — a correctness requirement, F2), status ring (`getContactStatus`/STATUS_SQL band), name (`numberOfLines={1}`), `RankedFuelLine` OR search snippet, category label (hidden when null), favourite marker (`favourite_rank IS NOT NULL`). **Forbidden on the card:** anything log-derived (recency string, "N days ago", channel glyph, gravity, intensity, quality) — those are profile-only (04-log D/G).

**Never-contacted variant:** same card, but no status ring emphasis (they have no `last_contact`, so status is null/undefined — render the ring in a neutral/absent state). Still renders the fuel line (DASH-04 says the screen "renders fuel").

### Anti-Patterns to Avoid
- **`addDatabaseChangeListener` for freshness** — structurally blind to headless cross-connection writes (F1). Use focus + AppState.
- **Sync SQLite reads on the list path** — blocks the JS thread (HANDOFF §3). Async only.
- **Re-deriving status thresholds, the fuel ranking CASE, or `escapeLike` in the dashboard query** — drift risk. Reuse `PROGRESS_SQL`/`STATUS_SQL`, the exported fuel fragment, and `escapeLike`; cover any extraction with a parity test.
- **Porting the plugin's all-contacts birthday loop** — it honours none of mobile's suppression rules (F3). Use the deliberate "exclude archived only" predicate.
- **Wrapping stored timestamps in `'localtime'`** — double-conversion shifts late-night rows a day early. Only `now` gets `'localtime'`.
- **Interpolating any user value into SQL** — every runtime value is `?`-bound; the term is bound AND `escapeLike`'d with `ESCAPE '\'`.
- **Hardcoding a status-ring hex** — `check:colors` bars it; the stable/wobble/decay band colours are a token gap owner-decision (Q1).
- **Driving list animation from React state** — CLAUDE.md; the drag lib uses Reanimated worklets, not `setState`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query-time status/progress | A JS status calculator over fetched rows | `PROGRESS_SQL`/`STATUS_SQL` + `getContactStatus` | Already the single source; keeps card and profile identical; DERIVED-NEVER-STORED |
| Ranked fuel preview | A new "top fuel" query | `getRankedFuel` / the `RANK_CASE` fragment + `RankedFuelLine` | Exclusions (`off_limits`, unconfirmed-`ai`, blank) are structurally in-query; the component is surface-agnostic and reused unchanged |
| Name+fuel search + LIKE-escaping | A new search + a hand-rolled `%`/`_` escaper | `searchFuel` predicates + `escapeLike` (`ESCAPE '\'`) | Binding alone does NOT make `%`/`_` literal; the escaper handles backslash-first ordering (T-07-04) |
| Sort/filter persistence | A bespoke AsyncStorage read/write | Zustand `persist` + `createJSONStorage(AsyncStorage)` (copy `theme-store.ts`) | Proven rehydrate-on-launch pattern; partialize to persist only the selection |
| Drag-reorder gestures + spring animation | A Reanimated/gesture-handler reorder from scratch | `react-native-reorderable-list` (owner-confirmed) | Reorder physics, autoscroll, and haptics are deceptively hard; the lib is Reanimated-4-compatible |
| Avatar recycling correctness | A manual key/blank scheme | `Avatar`'s existing `recyclingKey`/`cacheKey` | Already folds `contactId` + `cacheBust` + per-write revision; solves the face-flash (F2) |
| Favourite write transactionality | An inline UPDATE in the screen | `favourites-dao.ts` mirroring `setContactPhoto` | Single-column, `changes===1` guard, `modified_at` bump, `last_contact` untouched |

**Key insight:** Phase 8's correctness lives in SQL predicates and date math that already exist or are tiny pure functions — the temptation is to re-express them in the screen where they can't be node-tested and will drift. Keep every predicate/comparator/parser in `db/*.ts` or `*-logic.ts` and test it off-device.

## Common Pitfalls

### Pitfall 1: The birthday day-of drop reappears
**What goes wrong:** the contact vanishes from the banner ON their birthday; "Today!" never shows.
**Why:** comparing a time-carrying `today` against a local-midnight `birthdayThisYear` (Bug 1 above).
**How to avoid:** truncate to local midnight before comparing; add a node test that asserts `daysUntilBirthday` returns `0` when today IS the birthday, run at several times-of-day.
**Warning signs:** a test at 14:00 local returns ~365 for today's birthday.

### Pitfall 2: Feb-29 silently observed on Mar-1
**What goes wrong:** a Feb-29 birthday shows Mar-1 in non-leap years with no deliberate choice.
**Why:** `new Date(y, 1, 29)` overflows.
**How to avoid:** special-case Feb-29; pick the observed day explicitly (owner decision Q2); node-test a non-leap year.
**Warning signs:** the banner shows a Feb-29 person on Mar-1 with no code branch acknowledging it.

### Pitfall 3: The snoozed segment silently always-empty
**What goes wrong:** the "Snoozed (N)" chip always reads 0 and reveals nothing.
**Why:** **no code writes `snooze_until` yet** [VERIFIED: grep — only migration/type/event-vocabulary references exist; no writer]. Snooze is populated by Phase 11's notification snooze action.
**How to avoid:** implement the read/predicate correctly now (it's forward-compatible); document that the population is empty until a snooze writer lands, so a UAT "0 snoozed" is expected, not a bug. Confirm the `snooze_until` storage format (local `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS`) with the owner so `date(snooze_until)` compares correctly when Phase 11 writes it.
**Warning signs:** a reviewer files "snoozed segment broken" — it isn't; there's just no data source yet.

### Pitfall 4: Status-ring pixel work blocked on a missing token
**What goes wrong:** the executor invents `stable`/`wobble`/`decay` hexes; `check:colors` fails (or worse, they get committed in a Skia call).
**Why:** only `rogue` exists in `space-dark`; there are no band tokens [VERIFIED: theme-presets.ts].
**How to avoid:** treat the band colours as an owner decision (Q1). Until resolved, the card can ship a text/shape status indicator using existing tokens (UI-SPEC option b). The ring still carries `testID="dashboard-card-status-<id>"` + an `accessibilityLabel` naming the status so UAT asserts it without colour.
**Warning signs:** a hex literal outside `theme-presets.ts`.

### Pitfall 5: Search result set loses card data
**What goes wrong:** switching to search shows lean rows (name only), dropping status/category/favourite for name matches.
**Why:** calling `searchFuel` as-is (its projection is `{contactId, name, snippet}`).
**How to avoid:** fold the search predicate into `dashboard-read.ts` so the full card projection is preserved and the snippet is an extra column (Pattern 4).
**Warning signs:** name-only matches render without a status ring or category.

### Pitfall 6: Nested transaction hang on the reorder write
**What goes wrong:** the reorder DAO deadlocks.
**Why:** the shared mutex is NON-REENTRANT (transaction.ts) — nesting `inWriteTransaction` is a permanent hang (the repeated HIGH-1 lesson across phases).
**How to avoid:** `rewriteFavouriteRanks` opens ONE `inWriteTransaction` and issues N `?`-bound UPDATEs inside it; never call a wrapped single-write DAO in a loop.
**Warning signs:** the Manage-favourites save spins forever.

## Code Examples

### Reused unchanged (verified on disk)
```typescript
// getRankedFuel → RankedFuelLine: the card fuel preview, exclusions already in-query.
// Source: src/db/fuel-read.ts:109-128, src/components/RankedFuelLine.tsx
const [top] = await getRankedFuel(exec, contactId); // rows[0] is the promoted line, or undefined
<RankedFuelLine text={top?.text} testID={`dashboard-card-fuel-${contactId}`} />

// Avatar with correctness recyclingKey (already wired). Source: src/components/Avatar.tsx:45-82
<Avatar photo={photo} name={name} contactId={contactId} cacheBust={modified_at} size={48} />
```

### Sort/filter persistence store (copy the verified theme-store pattern)
```typescript
// Source pattern: src/stores/theme-store.ts:1-60 (VERIFIED)
export const useDashboardPrefs = create<DashboardPrefs>()(
  persist(
    (set) => ({ sort: "status", filter: "all", setSort: (sort) => set({ sort }), setFilter: (filter) => set({ filter }) }),
    { name: "orbit-dashboard-prefs", storage: createJSONStorage(() => AsyncStorage), version: 1,
      partialize: (s) => ({ sort: s.sort, filter: s.filter }) },
  ),
);
```

### Favourite toggle DAO (mirror setContactPhoto)
```typescript
// Source pattern: src/db/contacts-dao.ts:518-563 (VERIFIED)
export function clearFavouriteRank(exec: SqlExecutor, id: number, now: string): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const r = await exec.runAsync(
      "UPDATE contacts SET favourite_rank = NULL, modified_at = ? WHERE id = ?", [now, id]);
    if (r.changes !== 1) throw new Error(`clearFavouriteRank: no contact id=${id} (changed ${r.changes})`);
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plugin: hardcoded category-group sections | Single flat status-sorted list; sort is the only organizer | Dossier Cluster A (locked) | Drop `ContactGrid.tsx:11-24`; no grouping code |
| Plugin: manual Refresh button + implicit reactivity | focus + AppState re-query + pull-to-refresh | Dossier Cluster F (F1) | No refresh button; no change-listener |
| Plugin: all-contacts birthday loop | Deliberate "exclude archived only" predicate | Dossier Cluster E (F3) | Banner respects mobile suppression exceptions |
| Reanimated 2/3-era drag libs | Reanimated-4-compatible `react-native-reorderable-list` | Reanimated 4 (installed) | Prefer the fresh lib; the popular one is stale |

**Deprecated/outdated:**
- `FuelSearch` standalone route + `settings-search-row` — superseded by the dashboard search box (expected relocation).
- The plugin's `getDaysUntilBirthday` — reimplemented with both bugs fixed.

## Validation Architecture

> nyquist_validation is not explicitly false in config — section included. Correctness-critical pure logic here is node-testable; `.tsx` screens are device-UAT (the repo's established `*-logic.ts` convention).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (node environment) — the harness the repo's `db/*.test.ts` and `*-logic.test.ts` run under [VERIFIED: existing `.test.ts` files across src/db and src/screens] |
| Config file | (project-standard; e.g. vitest config — existing tests run today) |
| Quick run command | `npx vitest run src/db/dashboard-read.test.ts src/logic/birthday-logic.test.ts` (scoped) |
| Full suite command | `npx vitest run` (+ `tsc --noEmit`, `npm run check:colors`, Biome) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Default predicate excludes never-contacted/archived/snoozed; each sort orders correctly | unit (SQL over in-memory/`node:sqlite` fixture, mirroring queries.test.ts) | `npx vitest run src/db/dashboard-read.test.ts` | ❌ Wave 0 |
| DASH-02 | Each filter predicate selects the right population; search term matches name AND fuel, excludes off_limits/ai | unit | `npx vitest run src/db/dashboard-read.test.ts` | ❌ Wave 0 |
| DASH-02 | Ranked-fuel column parity with `getRankedFuel` (no drift) | unit (parity, like fuel-read.test.ts) | `npx vitest run src/db/dashboard-read.test.ts` | ❌ Wave 0 |
| DASH-03 | Card content contract (status/fuel/category/favourite present; nothing log-derived) | device-UAT (uiautomator on Pixel) | manual (desktop-build-pipeline) | n/a |
| DASH-05 | `daysUntilBirthday`: today→0 at multiple times-of-day; Feb-29 non-leap; MM-DD & YYYY-MM-DD; past→rolls to next year; >7 excluded | unit | `npx vitest run src/logic/birthday-logic.test.ts` | ❌ Wave 0 |
| DASH-06 | Reorder logic (from/to → new id array); `rewriteFavouriteRanks` writes 0..n-1 in one txn; toggle sets/clears rank | unit | `npx vitest run src/db/favourites-dao.test.ts src/logic/*reorder*.test.ts` | ❌ Wave 0 |
| DASH-07 | Freshness (focus/AppState/pull) + empty states | device-UAT | manual | n/a |

### Sampling Rate
- **Per task commit:** the scoped quick-run for the module touched + `tsc --noEmit` + `check:colors`.
- **Per wave merge:** `npx vitest run` (full suite).
- **Phase gate:** full suite green + on-device UAT on the Pixel (verify-ui-on-pixel-yourself: build+install+drive the dashboard, never-contacted, manage-favourites, birthday banner, search) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/db/dashboard-read.test.ts` — DASH-01/02 predicates, sorts, search, fuel-parity
- [ ] `src/logic/birthday-logic.test.ts` — DASH-05 parser (both bugs + both formats)
- [ ] `src/db/favourites-dao.test.ts` — DASH-06 toggle + reorder transactionality
- [ ] `src/logic/*reorder*-logic.test.ts` — pure drag→order computation
- [ ] (Framework already present — no install needed)

## Security Domain

> `security_enforcement` not explicitly false — included. This phase adds no auth/network/crypto surface (local-first, offline read path). The only externally-influenced input is the search term.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local-only app, no accounts |
| V3 Session Management | no | — |
| V4 Access Control | yes (data visibility) | `off_limits` + unconfirmed-`ai` + archived exclusions are STRUCTURAL, in-query (fuel-read.ts) — the card/search never surface a private note; reuse the fragments, never re-filter in the component |
| V5 Input Validation | yes (search term) | `?`-bound AND `escapeLike` + `LIKE ? ESCAPE '\'` on every predicate (T-07-04); a term never becomes a glob or an injection |
| V6 Cryptography | no | No secrets touched this phase |

### Known Threat Patterns for {RN + SQLite dashboard}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via search term | Tampering | Static query string; term `?`-bound; only code-constant identifiers interpolated (verified pattern in fuel-read.ts/queries.ts) |
| Private (`off_limits`) fuel leaking to a glanceable surface | Information disclosure | In-query exclusion (never a UI `.filter()` that could be refactored away) |
| Network egress on the read path | Information disclosure | No network in `dashboard-read.ts`; `expo-image` makes zero calls for `file://` (F2); local-first commitment (CLAUDE.md) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-native-reorderable-list` (0.18.1) is the best drag-reorder pick for Reanimated 4.5 / RN 0.86 | Standard Stack, Pattern 5 | LOW — package discovered via WebSearch (ASSUMED provenance); owner confirms the dep at plan review regardless, and an up/down-arrow no-dep fallback exists |
| A2 | Feb-29 non-leap observation should default to Feb-28 | Pattern 3, Pitfall 2 | LOW — a taste call; either Feb-28 or Mar-1 fixes the silent-overflow bug. Owner picks |
| A3 | Dashboard search should widen past never-contacted/snooze exclusions (find anyone non-archived) | Pattern 4, Q4 | MEDIUM — a behavioral choice; if wrong, search misses (or over-shows) never-contacted people. Owner confirms |
| A4 | `snooze_until` will be stored as a local date/datetime string comparable via `date()` | Pattern 1, Pitfall 3 | MEDIUM — no writer exists yet; if Phase 11 stores an epoch/UTC form, the predicate needs adjusting. Confirm the format convention |
| A5 | Status sort may use `progress DESC` (or a status-rank CASE) for v1; exact rogue-vs-decay order is domain 9's | Pattern 1 | LOW — dossier explicitly defers the precise ordering to domain 9 |
| A6 | No new index is needed (≤~150 contacts) | Pattern 1 | LOW — benchmark ceiling verified; if a user far exceeds it, add an index later (non-breaking) |

## Open Questions

1. **Status-ring band colours (blocks pixel implementation of the ring).**
   - What we know: only `rogue` (#E0904A) exists; `stable`/`wobble`/`decay` have no token [VERIFIED: theme-presets.ts]. `check:colors` bars inventing hexes.
   - What's unclear: whether the owner approves three new `space-dark` tokens now, or defers the coloured ring (ship a text/shape indicator using existing tokens until domain 9 defines the status/rogue visual language).
   - Recommendation: owner approves three attention-graded hues (UI-SPEC Owner Decision 1, recommend option a). Until then, the card renders a non-colour status indicator + a11y label.

2. **Feb-29 observation day in non-leap years.**
   - What we know: the silent Mar-1 overflow is the bug; any explicit choice fixes it.
   - Recommendation: default Feb-28; confirm at plan review.

3. **The snoozed segment has no data source yet.**
   - What we know: no code writes `snooze_until` [VERIFIED: grep]. Snooze is Phase 11's notification action.
   - Recommendation: implement the (forward-compatible) predicate/count now; document the always-0 population as expected until Phase 11; confirm the `snooze_until` storage format.

4. **Dashboard search scope vs the dashboard population.**
   - What we know: `searchFuel` excludes archived only (includes never-contacted); the dashboard list excludes never-contacted/snoozed.
   - What's unclear: does search find never-contacted people (the "who did I save this for" case, which capture creates) or only the dashboard population?
   - Recommendation: widen search past the never-contacted/snooze exclusions (find anyone non-archived); owner confirms.

5. **Favourite-rank normalization on unstar.**
   - What we know: ordering is by `favourite_rank ASC`; gaps are harmless.
   - Recommendation: leave gaps on unstar; renormalize (0..n-1) only on the Manage-favourites save. No user-visible effect either way.

## Environment Availability

> Skipped — this phase adds no external tool/service/runtime dependency beyond the one npm library (covered in Standard Stack / Legitimacy Audit). Reanimated, gesture-handler, AsyncStorage, expo-sqlite, expo-image, and react-navigation are all already installed and verified in `package.json`. On-device verification uses the existing desktop-build → Pixel pipeline (STATE.md, verified in Phase 1/4).

## Sources

### Primary (HIGH confidence — verified first-hand on disk)
- `src/db/queries.ts` (STATUS_SCAN, NEWEST_PER_CONTACT, statusOrder), `src/db/status.ts` (PROGRESS_SQL/STATUS_SQL/REASON_SQL + thresholds), `src/db/contact-status-read.ts` (getContactStatus + never-contacted guard)
- `src/db/fuel-read.ts` (getRankedFuel, searchFuel, RANK_CASE, escapeLike, the in-query exclusions), `src/db/contacts-dao.ts` (single-writer discipline, setContactPhoto pattern, updateContactMetadataCore SET list), `src/db/contact-read.ts`
- `src/db/migrations/001-initial.ts` (favourite_rank, snooze_until, birthday, ring_seq, categories all present — no new migration)
- `src/screens/edit-contact-logic.ts:98-124` (birthday stored as MM-DD or YYYY-MM-DD)
- `src/components/Avatar.tsx` (recyclingKey/cacheKey already wired), `RankedFuelLine.tsx`, `FuelSearchResultRow.tsx`, `src/screens/FuelSearch.tsx` (cancelled-flag async pattern), `src/screens/HomeScreen.tsx`, `ContactProfileScreen.tsx` structure, `SettingsScreen.tsx` rows
- `src/navigation/RootNavigator.tsx` + `types.ts` (native-stack shell, initialRouteName Home)
- `src/stores/theme-store.ts` (Zustand persist + AsyncStorage template), `src/theme/theme-presets.ts` (token inventory — rogue only, no band tokens), `src/db/benchmark.ts` (~150 contact ceiling), `src/utils/dates.ts` (formatLocalDate)
- `~/projects/Orbit/src/components/BirthdayBanner.tsx` (both parser bugs diagnosed line-by-line)
- `docs/dossier/08-dashboard.md` (all clusters, F1–F4), `08-CONTEXT.md`, `08-UI-SPEC.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `./CLAUDE.md`

### Secondary (MEDIUM confidence — registry-verified, WebSearch-discovered)
- npm registry: `react-native-reorderable-list@0.18.1` (peer deps, publish date, downloads, repo), `react-native-draggable-flatlist@4.0.3`, `react-native-reanimated@4.5.1` peer range — all read via `npm view` / npm downloads API
- Reanimated compatibility guidance (docs.swmansion.com) — Reanimated 4 requires New Architecture + worklets 0.10.x

### Tertiary (LOW confidence)
- WebSearch narrative on drag-lib Reanimated-4 support (corroborated by the registry peer-dep data above)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core deps installed and verified; the one net-new lib is registry-verified and owner-gated
- Architecture (queries, freshness, search, favourites, birthday, nav): HIGH — every substrate exists and was read on disk; patterns compose verified fragments
- Pitfalls: HIGH — each is grounded in a verified file or a documented platform constraint
- Drag-reorder library choice: MEDIUM — WebSearch-discovered (ASSUMED provenance), owner-confirmed at plan review

**Research date:** 2026-08-15
**Valid until:** 2026-09-14 (stable substrate; the drag-lib landscape is the only fast-moving item — re-check its Reanimated-4 peer range if plan review slips)
</content>
</invoke>
