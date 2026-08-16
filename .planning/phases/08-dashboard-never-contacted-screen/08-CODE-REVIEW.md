---
phase: 8
reviewer: claude
reviewed_at: 2026-08-16
status: findings
high: 0
medium: 1
low: 5
---

# Code Review — Phase 8 (Dashboard & Never-Contacted Screen)

Single Claude reviewer, code-level (not diff-level) read of the implemented source. **Verified sound:**
DATA-04 single-writer (`contacts.last_contact` written only by `recency-dao`; `favourites-dao` writes only
`favourite_rank`/`modified_at`; `dashboard-read` is read-only), in-query `off_limits` + unconfirmed-`ai`
exclusions on card line + snippet + search EXISTS (no component-side filter), the four-branch SQL, the
birthday parser edge cases, the `rewriteFavouriteRanks` guards, `recyclingKey`/`cacheBust`, token-clean
colours, and AppState-listener teardown. **0 HIGH.**

## Findings

### MEDIUM-1 — BirthdayBanner reads once at mount, never re-queries (defeats DASH-07 freshness)
`src/components/BirthdayBanner.tsx:67` — a bare `useEffect(() => {…}, [])` + `today = new Date()` captured
once. Mounted inside HomeScreen's `ListHeaderComponent`, it never re-runs on focus/foreground/pull, so a
same-session birthday (or a midnight `today` rollover) is missed until a cold restart — exactly the "must
not miss" prompt it exists for. **Fix:** drive the read via `useFocusEffect` (as `NeverContactedScreen` does).

### LOW-1 — Pull-to-refresh's `reload()` cancel handle is discarded
`src/screens/HomeScreen.tsx:182-185`. `onRefresh` calls `reload()` and throws away the returned cancel fn
(the focus + AppState effects both keep it). An in-flight pull-refresh read isn't cancelled on unmount.
**Fix:** `const cancel = reload();` and track/invoke it like the other two paths.

### LOW-2 — Async `persist()` invoked inside a `setState` updater
`src/screens/ManageFavouritesScreen.tsx:151-163`. `void persist(newIds)` runs inside `setRows((prev)=>…)`;
updaters must be pure — StrictMode/re-entrant render could fire `rewriteFavouriteRanks` twice per drag
(idempotent, so no corruption). **Fix:** compute `newIds` and call `persist` outside the updater.

### LOW-3 — Dead code orphaned by the FuelSearch retirement
`src/components/FuelSearchResultRow.tsx` and `searchFuel`/`SEARCH_FUEL` in `src/db/fuel-read.ts:202-231`
have no production importer since `FuelSearch.tsx` was retired (search now lives in `listDashboard`).
**Fix:** delete the orphaned component + query + their tests (git preserves history; re-port if a later
phase needs cross-contact search). Keep the shared fragments (`RANKED_FUEL_EXCLUSIONS`/`RANK_CASE`/
`escapeLike`) — `dashboard-read` uses them.

### LOW-4 — Search re-runs the counts + `listCategories` on every keystroke
`src/screens/HomeScreen.tsx:122-154`. `reload` depends on `[filter,sort,term]` and unconditionally runs the
four counts + `listCategories`, none of which depend on `term`, with no debounce. **Fix:** debounce `term`
and/or split the term-independent reads into an effect keyed on `[filter,sort]`.

### LOW-5 — Misleading "Focus-effect load" comment (actually mount-only)
`src/screens/ManageFavouritesScreen.tsx:111-131`. The comment says focus-effect but it's `useEffect([])`.
**Fix:** switch to `useFocusEffect` (consistent with the freshness contract) or correct the comment. Prefer
`useFocusEffect` so a favourite mutated elsewhere is reflected.

## Verdict
Overall risk LOW; 0 HIGH. All six findings scheduled for fix (owner directive 2026-08-16), then rebuild.
