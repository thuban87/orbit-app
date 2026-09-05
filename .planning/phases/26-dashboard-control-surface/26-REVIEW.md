---
status: issues_found
phase: 26-dashboard-control-surface
files_reviewed: 33
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
---

# Phase 26: Dashboard Control Surface — Code Review Report

**Reviewed:** 2026-09-05
**Depth:** deep (cross-file, subsystem-scoped per CLAUDE.md "review the code, not the diff")
**Files Reviewed:** 33 (all scoped) + `src/logic/dashboard-empty-logic.ts` and `src/db/fuel-read.ts` read for call-chain verification
**Status:** issues_found

## Summary

The correctness core of this phase is strong. The D-12 read wiring
(`listDashboardPopulation` / `listDashboardSearch`) is a single, fully
parameterized read chokepoint: every runtime value is `?`-bound, the only
interpolated tokens are closed code-constants, and the `now` value is captured
ONCE per reload in `HomeScreen.reload` and threaded to both the list read and
`countBirthdayPopulation`, so the local-midnight birthday-straddle bug the brief
called out cannot occur. I verified the locked invariants directly:

- **Single-writer on `contacts.last_contact` is intact.** No file changed in this
  phase writes that column; `dashboard-read.ts` is read-only (`getAllAsync` /
  `getFirstAsync` only, no transaction, no network).
- **Dual-read retirement is complete.** `listDashboard` / `listNeverContacted`
  survive only in test comments; no runtime reference remains (grep-confirmed).
- **D-03 machinery is preserved** — `countNeverContacted`,
  `readIncludeUnboundNeverContacted`, the `include_unbound_never_contacted`
  app_settings read, and its interaction with the persisted opt-in still have
  dedicated coverage (dashboard-read.test.ts:894-911).
- **`populationCounts` is the complete 5-key record** from cheap dedicated counts
  (`ZERO_POPULATION_COUNTS` + `setPopulationCounts`), never partial, never N full
  scans.
- **SegmentedControl `icon?: IconName`** is registry-typed; an unregistered icon
  fails `tsc` at the call site.
- **View-mode toggle idempotency** is doubly guarded (call site in `onChangeView`
  AND `setViewMode` no-ops on unchanged value; proven by store test).
- **Animation is Reanimated-driven**, gated on `isFocused && appActive &&
  !reducedMotion`, settling instantly otherwise (HomeScreen search expand,
  AnchoredPanel). No per-frame React state animation.
- **No hardcoded colour literals, no `toISOString().split`** in any reviewed file.

No Critical/BLOCKER defects found. Three Warnings concern user-facing behaviour
(accessibility focus churn, a stranded search filter, and a misleading empty
state); three Info items are low-risk latent issues.

## Warnings

### WR-01: AnchoredPanel re-registers its transient and re-steals accessibility focus on every in-panel toggle

**File:** `src/components/control-surface/AnchoredPanel.tsx:59-68` (effect dep
array `[visible, onDismiss]`), driven by `src/components/control-surface/DashboardOverlayHost.tsx:31`

**Issue:** `DashboardOverlayHost` builds its `dismiss` handler as a fresh inline
arrow function on every render (`const dismiss = () => {...}`), so `onDismiss`
passed to `AnchoredPanel` has a new identity on each host re-render. The panel's
effect depends on `onDismiss`, so it tears down (`closeTransient`) and re-runs
(`openTransient` + `AccessibilityInfo.setAccessibilityFocus(handle)`) every time
the host re-renders. The host re-renders whenever `dashboardPanelStore.request`
changes — which is exactly what `DashboardControlRow`'s three content-refresh
effects do (they call `dashboardPanelStore.getState().open({...request, content})`)
on every population/filter/sort toggle.

**Failure scenario:** A screen-reader user opens the Population panel and taps a
population chip. The store updates → `DashboardControlRow` refresh effect calls
`open()` with new content → host re-renders → `onDismiss` identity changes →
AnchoredPanel effect re-runs → accessibility focus is yanked back to the panel
container, away from the chip the user just toggled. Every subsequent toggle
repeats the focus jump, making the panel very hard to operate with TalkBack.

**Fix:** Memoize `dismiss` in `DashboardOverlayHost` and split the one-time
focus/transient registration from the dep that changes:
```tsx
// DashboardOverlayHost.tsx
const dismiss = useCallback(() => {
  dashboardPanelStore.getState().close();
  dashboardPanelStore.getState().request?.onDismiss();
}, []);
```
And in AnchoredPanel, drive the focus/transient effect off `visible` only, holding
the latest `onDismiss` in a ref so its identity does not re-arm the effect:
```tsx
const onDismissRef = useRef(onDismiss);
onDismissRef.current = onDismiss;
useEffect(() => {
  if (!visible) { shellTransientStore.getState().closeTransient("dashboard-panel"); return; }
  shellTransientStore.getState().openTransient("dashboard-panel", () => onDismissRef.current());
  const handle = findNodeHandle(contentRef.current);
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  return () => shellTransientStore.getState().closeTransient("dashboard-panel");
}, [visible]);
```

### WR-02: Collapsing the search toggle leaves the active term applied, filtering the list with no visible input or indicator

**File:** `src/screens/HomeScreen.tsx:240-242` (`onToggleSearch`), interacting with
the reload path at `src/screens/HomeScreen.tsx:268-322` and the conditional input
render at `:611-649`

**Issue:** `onToggleSearch` only flips `searchExpanded`; it never clears
`searchText`. The debounced twin (`debouncedSearchText`) that drives `reload`
therefore keeps the previous term after collapse. When collapsed, the `TextInput`
unmounts (replaced by `searchSpacer`) and the search Icon reverts to `state="default"`,
so there is zero on-screen indication a filter is active — yet the FlatList still
shows only the search matches (`term !== "" ? listDashboardSearch : listDashboardPopulation`).

**Failure scenario:** User expands search, types "bob", sees the list narrow to
matching contacts, then taps the search affordance (labelled "Close search") to
put it away. The search box disappears and the icon looks inactive, but the
dashboard silently continues to show only "bob" matches. The user has no way to
see why most of their contacts vanished and no visible control to clear it without
re-expanding.

**Fix:** Clear the term when collapsing (and preferably reset the debounced twin),
so "Close search" restores the full population:
```tsx
const onToggleSearch = useCallback(() => {
  setSearchExpanded((expanded) => {
    if (expanded) setSearchText(""); // collapsing → drop the active query
    return !expanded;
  });
}, [setSearchText]);
```
If persistence-through-collapse is genuinely intended, instead surface an active
indicator on the collapsed affordance (e.g. keep the Icon in `active` state and
add an accessible "search active" hint) so the filtered state is discoverable.

### WR-03: "No favourites yet" empty copy is shown even when favourites exist but a filter zeroes the list

**File:** `src/screens/HomeScreen.tsx:481-497` (filter-empty branch), gate at
`src/logic/dashboard-empty-logic.ts:157`

**Issue:** The gate resolves `filter-empty` (step 3) whenever any dashboard filter
is active and `rowCount === 0`, BEFORE the population-count branch. HomeScreen's
`filter-empty` renderer then chooses copy solely on
`query.populations.includes("favourites")` — it does not consult
`populationCounts.favourites`. So a user who has favourites but whose active
category/battery/frequency filter excludes all of them sees the first-run-style
"No favourites yet. Tap the star on a contact's profile to add them here." message,
which is false.

**Failure scenario:** User has 5 favourites, selects the Favourites population, then
adds a "Family" category filter that none of their favourites match. Result list is
empty → gate returns `filter-empty` → screen prints "No favourites yet", telling a
user who has favourites that they have none.

**Fix:** Gate the "No favourites yet" copy on the actual count, falling back to the
neutral filtered-empty copy otherwise:
```tsx
{query.populations.includes("favourites") && populationCounts.favourites === 0 ? (
  <>… No favourites yet …</>
) : (
  <Text …>Nothing matches these filters.</Text>
)}
```

## Info

### IN-01: clampAnchorPosition never clamps vertically; its height parameters are dead

**File:** `src/components/control-surface/anchor-position.ts:19-34`

**Issue:** `clampAnchorPosition` accepts `panelSize.height` and `viewport.height`
but uses neither. `top` is always `anchorRect.y + anchorRect.height` with no
bottom-edge clamp. Today the only anchors are the control-row triggers near the top
of the screen, so overflow is not observed, but the function's contract
("without crossing screen gutters") is only half-implemented and a future
lower-anchored panel would spill off the bottom.

**Fix:** Either clamp `top` against `viewport.height - panelSize.height - gutter`,
or drop the unused `height` fields from the parameter types so the contract matches
the behaviour.

### IN-02: Control-row toggle guards read a stale `pending` closure, allowing a rapid double-tap to issue two writes

**File:** `src/components/control-surface/DashboardControlRow.tsx:58-71`
(`togglePopulation`; same pattern in `toggleFilter`/`selectSort`)

**Issue:** The `if (pending) return;` guard reads `pending` captured in the
callback closure. The callback identity only updates after a re-render/content
refresh, so two taps dispatched before the panel content re-renders both see
`pending === false` and both proceed. The `current` snapshot is re-read via
`getState()`, so each write is based on the latest populations, but two concurrent
`updateAppSettings` writes can still interleave.

**Fix:** Track in-flight state in a ref checked synchronously
(`if (pendingRef.current) return; pendingRef.current = true;` … reset in `finally`),
or debounce/serialize the writes through the store.

### IN-03: countNeverContacted performs a redundant validation read of include_unbound_never_contacted

**File:** `src/db/dashboard-read.ts:448-497`

**Issue:** `countNeverContacted` calls `readIncludeUnboundNeverContacted`, which
reads `include_unbound_never_contacted` purely to throw if the row is missing and
then discards the value; the count query re-reads the same column via a correlated
subquery. This is two reads of the same setting per count. Harmless, but the
discarded-result helper reads as dead work and can confuse a future maintainer into
thinking the first read feeds the count.

**Fix:** Have `readIncludeUnboundNeverContacted` return the value and reuse it, or
inline the existence check, so the setting is read once.

---

_Reviewed: 2026-09-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
