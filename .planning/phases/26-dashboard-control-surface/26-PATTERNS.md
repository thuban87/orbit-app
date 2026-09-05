# Phase 26: Dashboard Control Surface - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 15 (7 new, 8 modified)
**Analogs found:** 15 / 15 (every new file has an in-repo analog; this is a refactor/integration phase, not greenfield)

> Verification note: every excerpt below was read from disk this session (not from RESEARCH.md
> citations). Where a RESEARCH.md line number drifted from the actual file, the disk line is used.
> Notable drift: the HomeScreen header `Pressable` is at **537-551** (not 640-656 — that range is
> `StyleSheet` now); the overflow-actions array is **107-150** (verified).

---

## File Classification

### New files (LAYER 2 / LAYER 3 + pure helpers)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/components/control-surface/AnchoredPanel.tsx` | component (overlay/transient) | event-driven (open/dismiss) | `src/components/ui/overlay-base.tsx` (contract only) + `src/stores/shell-transient-store.ts` | role-match (borrow contract, NOT the RN Modal impl) |
| `src/components/control-surface/PopulationPanelContent.tsx` | component (presentation-agnostic) | request-response (state+onChange) | `src/components/SegmentedControl.tsx` + HomeScreen sort-row rows (360-403) | role-match |
| `src/components/control-surface/FilterPanelContent.tsx` | component | request-response | `src/components/FilterChipRow.tsx` + `SegmentedControl.tsx` | role-match |
| `src/components/control-surface/SortPanelContent.tsx` | component | request-response | HomeScreen inline sort row (362-403) → `SegmentedControl.tsx` | role-match |
| `src/components/control-surface/DashboardControlRow.tsx` | component (triggers) | event-driven | HomeScreen sort control (`Pressable` row) + `dashboard-query-store` reads | role-match |
| `src/components/control-surface/control-summary.ts` | utility (pure) | transform | `src/screens/unbound-list-logic.ts` (pure label helpers, node-testable) | exact (pure-fn idiom) |
| `src/components/control-surface/anchor-position.ts` | utility (pure) | transform | `src/logic/dashboard-query-logic.ts` (pure logic module, no RN import) | role-match |

### New read (LAYER 1 additive — D-12)

| New File/Fn | Role | Data Flow | Closest Analog | Match Quality |
|-------------|------|-----------|----------------|---------------|
| new population-aware **search** read in `src/db/dashboard-read.ts` | data-layer read | CRUD (read-only SQLite) | `listDashboardPopulation` (dashboard-read.ts:274-336) for structure + `listDashboard` term branch (365-442) for A3 semantics | exact structure + exact semantics to preserve |

### Modified files

| Modified File | Role | Data Flow | What Changes | Analog for the new bits |
|---------------|------|-----------|--------------|--------------------------|
| `src/screens/HomeScreen.tsx` | screen | request-response | Old→new store migration; FilterChipRow+inline sort → 3 panel controls; `listDashboard`→new search read; header 2 destinations; overflow rewrite | `dashboard-query-store`, `AnchoredPanel`, `ShellAppBar trailing` |
| `src/screens/ArchivedContactsScreen.tsx` | screen | CRUD | Chrome → `ShellAppBar variant="child"`; preserve ADR-018 purge verbatim | `ShellAppBar.tsx:20-67` |
| `src/screens/UnboundContactsScreen.tsx` | screen | CRUD | Chrome → `ShellAppBar variant="child"`; add own-route search (D-08/ADR-062) | `ShellAppBar` + HomeScreen search row (326-359) |
| `src/screens/unbound-list-logic.ts` | utility (pure) | transform | Add pure name-filter fn (DASHC-09) | existing helpers in same file |
| `src/db/unbound-read.ts` | data-layer read | CRUD | Optional name-filter variant of `listUnbound` (or filter in logic) | `listUnbound` (24-39) |
| `src/components/icons/icon-registry.ts` | config (registry) | — | Add 7 semantic names at the map only | `ICON_REGISTRY` (33-66) |
| `src/stores/dashboard-query-store.ts` | store | CRUD (SQLite via DAO) | Consume-only; possible test extension | — (consume, never fork) |
| `src/db/dashboard-read.ts` | data-layer read | CRUD | Add new search read; retire legacy `listDashboard` once wired (no dual-read) | see New read row |

---

## Pattern Assignments

### `AnchoredPanel.tsx` (LAYER 3 — the HUD swap point)

**Analog:** `src/components/ui/overlay-base.tsx` — borrow the **a11y-focus-on-open + Back contract**,
NOT the `RNModal` implementation (Pitfall 1 / D-11). Register with `shellTransientStore` for Back.

**a11y focus-on-open pattern to replicate** (overlay-base.tsx:76-84):
```typescript
const contentRef = useRef<View>(null);
useEffect(() => {
  if (!visible) return;
  const handle = findNodeHandle(contentRef.current);
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
}, [visible]);
```

**Scrim idiom to replicate but LIGHTEN** (overlay-base.tsx:35,103-109) — `SCRIM_OPACITY = 0.85`
is too opaque; the anchored panel needs a lower, theme-dependent opacity so the live-updating list
stays readable. Colour is always `colors.background` at opacity, never a literal:
```typescript
<View style={[StyleSheet.absoluteFill, styles.scrim, { backgroundColor: colors.background }]} />
```

**Transient registration for free Back / active-tab dismiss** (shell-transient-store.ts:22-56):
```typescript
// on open:
shellTransientStore.getState().openTransient("dashboard-panel", closePanel);
// on close:
shellTransientStore.getState().closeTransient("dashboard-panel");
```
This works because both system Back (RootNavigator.tsx:95-101) and app-bar Back (ShellAppBar.tsx:29-40)
route through `resolveBackIntent` → `dismissTop()` (back-intent.ts). `dismissTop` pops and calls the
registered `dismiss` callback (shell-transient-store.ts:46-54).

**Surface + radius:** wrap content in `GlassSurface density="dense"` (GlassSurface.tsx:54-67; it already
owns blur + graceful fallback + AA-checked tint, all token-only). Corners are `RADII.lg` = 16
(radii.ts:14; GlassSurface already applies this at styles.container:114).

**Animation:** Reanimated `withTiming(..., { duration: MOTION.base })` = 200ms (motion.ts `base:200`),
`EASING.decelerate` (`"out"` descriptor — map to `Easing.out(Easing.ease)` at call site) on enter;
collapse to instant when `useReducedMotion()` is true (use-reduced-motion.ts:122). **Never** drive
animation from React `setState` per frame; **never** use Skia (CLAUDE.md).

**Background inert + a11y-hidden** (Pattern 2 — the in-tree cost, no Modal auto-trap):
- full-screen scrim `Pressable` intercepts touches (outside-tap dismiss);
- `pointerEvents="none"`/`"box-none"` on the list wrapper while open;
- `importantForAccessibility={panelOpen ? "no-hide-descendants" : "auto"}` on the content wrapper
  (Android) + `accessibilityElementsHidden` for iOS parity. Verify with TalkBack on the Pixel.

---

### `PopulationPanelContent.tsx` / `FilterPanelContent.tsx` / `SortPanelContent.tsx` (LAYER 2)

**Contract (D-11 / §P):** take `{ state, onChange }` props ONLY. Zero imports of `AnchoredPanel`,
positioning, scrim, or animation. Zero direct `app-settings-dao` writes — `onChange` calls the store
setters. This is a checker/review grep target.

**Selectable-row visual idiom** — reuse the shipped filled-accent idiom from `SegmentedControl.tsx:54-84`
(and the identical treatment in the current HomeScreen sort row, HomeScreen.tsx:369-401):
```typescript
const isActive = option.value === value;
<Pressable
  accessibilityRole="button"
  accessibilityState={{ selected: isActive }}   // non-colour redundancy (required)
  accessibilityLabel={option.label}
  onPress={() => onChange(option.value)}
  style={[styles.segment, isActive
    ? { backgroundColor: colors.accent, borderColor: colors.borderStrong }
    : { backgroundColor: colors.surface, borderColor: colors.border }]}
>
  <Text style={[styles.label, { color: isActive ? colors.background : colors.textSecondary }]}>
    {option.label}
  </Text>
</Pressable>
```
Every selected/active state MUST carry the redundant non-colour channel (`accessibilityState.selected`
or `.checked` + a check/filled affordance) — colour-alone is prohibited (UI-SPEC Color).

**Value sets that drive the rows — quote verbatim from `dashboard-query-logic.ts`:**
- Populations (5:5-11): `favourites, birthdays, not-contacted, snoozed, all-contacts` — plus the
  implicit **Active Contacts** default which is NOT a row (D-07). Deselecting the last population
  returns to Active (`buildPopulationWhere` returns `ACTIVE_SEGREGATION_WHERE` when `selected` is empty,
  dashboard-query-logic.ts:185-186).
- Filter families (14-20): `category, social-battery, needs-attention, gravity, contact-frequency`;
  `DashboardFilters = Partial<Record<DashboardFilterFamily, string[]>>` (22).
- Sort modes (118-125): `default, name-asc, name-desc, least-recent, most-recent, status`.

**Store setters (onChange targets) — verbatim signatures** (dashboard-query-store.ts:16-28); each takes
an `exec` first arg and writes through `app-settings-dao` then `set()`:
```typescript
setPopulations(exec, populations)  // 73-80
setFilters(exec, filters)          // 81-88
setSort(exec, sort)                // 89-92
setViewMode(exec, viewMode)        // 65-72
resetDashboardView(exec)           // 93-105
```
Panel callbacks thread `getExecutor()` as `exec`. **Do NOT re-author Phase 25 labels/copy** — render only.

**Filters `Clear filters`** → `setFilters(exec, {})`. **Sort `Default`** → `setSort(exec, "default")`.

---

### `DashboardControlRow.tsx` (the three triggers + summaries)

**Analog:** the current HomeScreen sort control block (HomeScreen.tsx:362-403) for the `Pressable`+label
idiom; reads current axes from `dashboard-query-store` (populations/filters/sort). Restrained active
treatment (accent border/tint + accent label + non-colour cue) — not a full filled block (UI-SPEC §C).
Summaries come from the pure `control-summary.ts` helper.

testIDs (UI-SPEC): `dashboard-population-control`, `dashboard-filters-control`, `dashboard-sort-control`.

---

### `control-summary.ts` (PURE, node-testable — DASHC-03)

**Analog:** `src/screens/unbound-list-logic.ts` (a pure, react-native-free helper module with
node-tested string functions). No RN import. Renders the `+N` collapse; caller substitutes the axis
default (`Active Contacts` / `Filters` / `Default`). British `Favourites` spelling (Phase 25 locked).

---

### `anchor-position.ts` (PURE, node-testable — DASHC-04)

**Analog:** `src/logic/dashboard-query-logic.ts` (pure logic module pattern). Input: measured anchor
rect (`measureInWindow`), panel size, viewport; output: clamped `{ top, left, width }` respecting the
`SPACING.base` (16px) gutter. Anchor top edge just below the control row; align leading edge to the
control, clamped so it never bleeds off-screen (portrait-locked, so no rotation case).

---

### New population-aware SEARCH READ in `dashboard-read.ts` (D-12, LAYER 1 additive)

**Structural analog:** `listDashboardPopulation` (dashboard-read.ts:274-336) — copy its shape:
`buildPopulationWhere(query.populations, {birthdayIds})` + `buildFilterWhere(query.filters)` +
`populationMatchColumns` + `resolveDefaultSort` + `POPULATION_SORT[resolvedSort]` + the gravity
post-query pass (324-335). **Do NOT add a `term` param to `listDashboardPopulation` itself** (no
layer-1 fork — D-11/D-12). Author a *new* additive read that composes population + filters + term.

**Term semantics to PRESERVE (recorded A3 owner decision — dashboard-read.ts:38 header + branch 1 at
396-413).** With a term present, relax the never-contacted/snooze exclusions to **archived-only**; the
no-term list keeps the full exclusion. Copy the term mechanics verbatim from `listDashboard`'s branch 1:
```typescript
// dashboard-read.ts:404-412 — the A3 relaxation to preserve
const like = `%${escapeLike(term)}%`;
params.push(like); // snippet subquery (SELECT clause — appears first)
where = `c.archived_at IS NULL
   AND ${DASHBOARD_BOUND_WHERE}
   AND (
     c.name LIKE ? ESCAPE '\\'
     OR EXISTS (SELECT 1 FROM fuel WHERE contact_id = c.id AND ${RANKED_FUEL_EXCLUSIONS} AND text LIKE ? ESCAPE '\\')
   )`;
params.push(like, like); // name LIKE, then EXISTS text LIKE
```
The snippet subquery (378) and `${snippet} AS snippet` projection (390) are also term-only. `snippet`
bind is pushed FIRST because it sits in the SELECT list (405 comment).

**`now` arg (O-2 / CLAUDE.md formatLocalDate rule — LOAD-BEARING):** `listDashboardPopulation`
validates `now` starts with `YYYY-MM-DD` and throws otherwise (dashboard-read.ts:256-272). The new read
takes the same local wall-clock string. The call site MUST pass the app's local-date helper
(`localDateTime()` from `@/db/database`, already used by `dashboard-query-store` at line 3), **never**
`toISOString()` — the latter is the UTC evening off-by-one CLAUDE.md forbids.

**Retire legacy `listDashboard` once the new read is wired — no dual-read left (D-12).** `listDashboard`
is dashboard-read.ts:365-442; `listNeverContacted` (459-503) is already `@deprecated` and slated for
retirement with legacy Home. Removing `listDashboard` is in scope for this phase.

**Injection invariant (V5 / must hold):** every runtime value stays `?`-bound; only closed code
constants are interpolated (dashboard-read.ts:43-51 header). Do not interpolate any identifier/value.

---

### `HomeScreen.tsx` (the big refactor — Pattern 4)

**Replace** (all VERIFIED on disk):
- store: `useDashboardPrefs` (63,101-104) → `useDashboardQueryStore` + `useDashboardSessionStore`.
  New store is SQLite-backed/async — call `hydrate(getExecutor())` on mount (mirror DB-ready gate);
  defaults render pre-hydration (dashboard-query-store.ts:58-64).
- read: `listDashboard(exec, {filter,sort,term})` (193) → new population-aware search read
  (`listDashboardPopulation` for the no-term path or the new search read when `hasTerm`).
- controls: `FilterChipRow` (360) + inline `SORT_OPTIONS` sort row (362-403) → `DashboardControlRow`
  (3 anchored panels).
- overflow: rewrite `overflowActions` (107-150) to the amended 5-row set (see Shared Patterns).
- header trailing: the single Group Events `Pressable` (537-551) → two co-equal destinations
  (Your Week + Group Events) with icon-only fallback (D-04).

**Preserve:** the freshness triple (focus/AppState/pull, 224-266), the `cancelled`-guarded reload
(186-219), `useBottomClearance()` (62), and `isFavourite={item.favourite_rank !== null}` as a **binary
membership** flag (565 — correct per ADR-075, do NOT treat as order).

**Search text is ephemeral session state** now: `dashboard-session-store.searchText` (not local
`useState`), restored on Dashboard→Profile→Back, cleared on fresh launch.

---

### `ArchivedContactsScreen.tsx` (refactor, D-05)

**Change:** replace the hand-rolled header (`archived-back` Pressable + title 24/700,
ArchivedContactsScreen.tsx:180-196) with `ShellAppBar variant="child" title="Archived"`
(ShellAppBar.tsx:20-67 gives Back via `resolveBackIntent`/`dismissTop`).

**Preserve verbatim (ADR-018 — owner's bucket if it must change):** `confirmPurge` native destructive
Alert (58-74), `purgeBody` copy (84-87), the two-stage restore/purge flow (111-172), and the in-app
`danger`-token trigger (247-251). This phase introduces **no** new destructive action.

Route is registered in BOTH `DashboardStack` (DashboardStack.tsx:62) and `SettingsStack`
(SettingsStack.tsx:32) → one screen, two entry points (D-05). Keep both.

---

### `UnboundContactsScreen.tsx` + `unbound-list-logic.ts` + `unbound-read.ts` (D-08 / ADR-062)

**Chrome:** replace the hand-rolled header (UnboundContactsScreen.tsx:54-70) with
`ShellAppBar variant="child" title="Unbound contacts"`.

**Add own-route search (LOAD-BEARING trip-wire — the ADR-062 retrieval-path replacement):** `listUnbound`
today has NO search — fixed WHERE + `ORDER BY name COLLATE NOCASE, id` (unbound-read.ts:24-39). Add a
name-filter: either a pure filter fn in `unbound-list-logic.ts` (analog: its existing pure helpers 1-17)
over the loaded rows, or a name-filter variant of `listUnbound`. Wire a search input reusing HomeScreen's
search-row idiom (HomeScreen.tsx:326-359). testIDs: `unbound-contacts-search-input` /
`unbound-contacts-search-clear`. **Shipping the Unbound route without this search weakens ADR-062 →
STOP AND ASK** (do not close as cleanup).

---

### `icon-registry.ts` (additions at the map ONLY — D-05)

**Analog:** `ICON_REGISTRY` map (icon-registry.ts:33-66). Add 7 semantic names (outline/filled Ionicons
pairs). None currently exist (verified). `tsc --noEmit` validates glyphs via `Icon.tsx` (glyph flows into
`<Ionicons name={glyph}/>`). Exact glyphs are Claude's discretion. Suggested:
```typescript
filter:         { outline: "filter-outline",        filled: "filter" },
sort:           { outline: "swap-vertical-outline", filled: "swap-vertical" },
list:           { outline: "list-outline",          filled: "list" },
grid:           { outline: "grid-outline",          filled: "grid" },
"your-week":    { outline: "calendar-outline",      filled: "calendar" },
"group-events": { outline: "people-outline",        filled: "people" },
"chevron-down": { outline: "chevron-down",          filled: "chevron-down" },
```

---

## Shared Patterns

### Theme tokens (no colour literals — CLAUDE.md / check:colors)
**Source:** every analog above resolves colour via `useTheme().colors.*`. New icons at the registry map
only; `RADII.lg`=16, `MOTION.base`=200, `SPACING.base`=16, `EASING.decelerate` from `src/theme/tokens/*`.
`GlassSurface` is the ONLY panel-surface component (no parallel per-theme family). `npm run check:colors`
must stay green. **Apply to:** all new components.

### Back / dismiss for transients
**Source:** `shell-transient-store.ts:22-56` + `resolveBackIntent` (back-intent.ts) + the two callers
(RootNavigator.tsx:95-101 system Back; ShellAppBar.tsx:29-40 app-bar Back). **Apply to:** `AnchoredPanel`
registration only — do not hand-roll a `BackHandler`.

### Store→DAO write path (V5 input validation)
**Source:** `dashboard-query-store.ts` setters → `app-settings-dao` (`assertDashboard*` /
`parseDashboard*`). **Apply to:** every panel write. Never write `app-settings-dao` directly from a
Layer-2 component; never interpolate a value into SQL.

### Pure node-testable helper module idiom
**Source:** `unbound-list-logic.ts`, `dashboard-query-logic.ts` (no RN import; string/logic only).
**Apply to:** `control-summary.ts`, `anchor-position.ts`, the Unbound name-filter, and (extract from
HomeScreen) a pure overflow-actions builder for DASHC-08 testing. vitest env is `node` (render-free) —
these are the only genuinely unit-testable new files.

### Amended overflow set (DASHC-08 / §M)
**Source:** rewrite `HomeScreen.overflowActions` (107-150) rendered by `OverflowMenu.tsx:37-118` (which
already supports `testID`, `accessibilityLabel`, and a per-row `Pressable`). Canonical order:
`Group Events` (`dashboard-group-events-overflow-entry`) · `Unbound Contacts`
(`dashboard-unbound-overflow-entry`) · `Archived Contacts` (`dashboard-archived-overflow-entry`) ·
`Select Contacts` (`dashboard-select-contacts-entry`, **DISABLED** with `accessibilityState.disabled` —
D-09) · `Reset Dashboard View` (`dashboard-reset-view-entry` → `resetDashboardView(exec)` +
`clearSession()`, no confirmation). **Removed:** Your Week (→header), Backup, Orrery, Settings (→tabs).
**Never present:** Manage Favorites (ADR-075/D-06), import (D-10).
> `OverflowMenu` has no `disabled` prop today — Select Contacts needs one added (reduced-emphasis style
> + `accessibilityState={{disabled:true}}` + no-op press). Small extension to `OverflowAction`.

---

## No Analog Found

None. Every new file has a close in-repo analog. The only genuinely novel *behaviors* (anchor
positioning math, in-tree a11y-hide of the background) have no code analog but are pure/mechanical and
covered by Patterns 1-2 in RESEARCH.md.

---

## Metadata

**Analog search scope:** `src/components/`, `src/components/ui/`, `src/components/icons/`,
`src/screens/`, `src/stores/`, `src/db/`, `src/logic/`, `src/navigation/`, `src/theme/tokens/`.
**Files read on disk this session:** shell-transient-store, overlay-base, dashboard-query-store,
HomeScreen, dashboard-read, unbound-read, unbound-list-logic, SegmentedControl, ShellAppBar,
OverflowMenu, icon-registry, Icon, GlassSurface, ArchivedContactsScreen, UnboundContactsScreen,
dashboard-session-store, dashboard-query-logic, DashboardStack, SettingsStack, back-intent,
RootNavigator (grep), motion.ts, radii.ts, use-reduced-motion (grep), database.ts (grep).
**Verified constants at plan time (2026-09-05):** `TARGET_VERSION = 19`, migration head `019` →
**no migration this phase (D-03)**; if one proves unavoidable it is head+1 = 020, re-verify on disk.
**Pattern extraction date:** 2026-09-05
</content>
</invoke>
