---
phase: 26-dashboard-control-surface
verified: 2026-09-05T10:05:00Z
status: passed
score: 10/10 requirements code-satisfied; on-device UAT 7/7 passed + owner-approved (2026-09-05). A launch-blocking render loop (HomeScreen useShallow, fc62a7b) was found and fixed during UAT; post-UAT owner feedback (archived→profile 53bb4af; panels centered + scrollable c414e51) fixed and owner-approved.
behavior_unverified: 0
overrides_applied: 0
next_action: "Run the batched 26-UAT.md pass on the Pixel to confirm the device-observable control-surface behaviours (anchored panels, live-apply with no Apply button, inert/a11y-hide while open, Back-dismiss, header icon-only fallback, reduced-motion, 44px targets, 200% text scale, origin-aware return). All code-level truths, artifacts, wiring, prohibitions, and pure-logic tests are green."
requirements_coverage:
  - id: DASHC-01
    status: satisfied
    evidence: "HomeScreen renders header (ShellAppBar) → DashboardControlRow → search+toggle row → FlatList collection → DashboardOverlayHost; control row is a fixed sibling, position invariant to header/search state."
  - id: DASHC-02
    status: satisfied
    evidence: "ShellAppBar trailing renders Your Week (route Digest) + Group Events (route GroupEvents); compact icon-only fallback computed from measured-intrinsic label-probe (onTextLayout) with fail-closed default."
  - id: DASHC-03
    status: satisfied
    evidence: "DashboardControlRow renders three separate Pressables (dashboard-population/filters/sort-control); summaries via collapseSummary '+N'; accent border + accessibilityState.selected on non-default. No 'Manage View' combination."
  - id: DASHC-04
    status: satisfied
    evidence: "AnchoredPanel is an in-tree absolute View (NOT RN Modal), root-level DashboardOverlayHost; intent callbacks apply immediately (setPopulations/setFilters/setSort) with no Apply step; list re-queries via reload()/query dependency."
  - id: DASHC-05
    status: satisfied
    evidence: "panelOpen wraps app-bar + listRegion with pointerEvents='none' + importantForAccessibility='no-hide-descendants'; control-row triggers stay above scrim (zIndex 20 vs 10); AnchoredPanel registers shellTransientStore openTransient(onDismiss) for Back; scrim Pressable dismisses on outside tap; single request in dashboardPanelStore."
  - id: DASHC-06
    status: satisfied
    evidence: "PopulationPanelContent lists 'all-contacts' as first ordinary row; empty populations → ACTIVE default (buildPopulationWhere); FilterPanelContent has dashboard-filters-clear → setFilters({}); SortPanelContent has explicit default → setSort('default')."
  - id: DASHC-07
    status: satisfied
    evidence: "Row 3 dashboard-search-row: collapsible toggle + TextInput (session-backed searchText) + right-aligned SegmentedControl (96px wrap, 44px segments); ephemeral session store cleared on fresh launch, restored via session store; 220ms debounce drives read."
  - id: DASHC-08
    status: satisfied
    evidence: "buildDashboardOverflowActions returns exactly 5 rows in order: Group Events, Unbound Contacts, Archived Contacts, Select Contacts (disabled:true, real no-op), Reset Dashboard View. No Manage Favorites, no import entry. Node-tested."
  - id: DASHC-09
    status: satisfied
    evidence: "ArchivedContactsScreen + UnboundContactsScreen use ShellAppBar variant='child' with resolveBackIntent/dismissTop; Archived registered in BOTH DashboardStack + SettingsStack (one screen); Unbound + Archived are DashboardStack child routes. Unbound gains own name search (filterUnboundByName). ADR-018 purge flow byte-preserved."
  - id: DASHC-10
    status: satisfied
    evidence: "Reset row → onReset → resetDashboardView(getExecutor()) + clearSession(); handled async surfaces themed snackbar on rejection and skips clearSession on failure; viewMode preserved (resetDashboardView returns Active/none/Default). No confirmation dialog."
human_verification:
  - test: "Open each of Population, Filters, Sort. Confirm each opens an anchored floating panel (not a full-screen modal / bottom sheet) anchored below its control, with the dashboard list visibly re-querying behind a light full-surface scrim."
    expected: "Panel floats anchored under the tapped control; list behind updates live as options toggle; scrim covers the whole surface including the app bar."
    why_human: "Panel anchoring geometry, scrim coverage, and live-update-behind-panel are render/device-observable only."
  - test: "With a panel open, try tapping the header destinations, overflow, search, and a contact card. Then dismiss via (a) re-tapping the same control, (b) tapping outside anywhere including over the app bar, and (c) Android system Back."
    expected: "Background is inert and out of AT focus while open; all three dismiss paths close the panel; Back dismisses the panel before any route navigation; only one panel is ever open."
    why_human: "pointerEvents/importantForAccessibility inertness, scrim outside-tap over the app bar, and Back-intent ordering are on-device behaviours."
  - test: "Toggle populations/filters/sort options and observe results. Confirm there is NO Apply/Done button and changes apply on tap; a selection yielding zero rows leaves the panel open with the cause-aware empty state behind it."
    expected: "Every change applies immediately; no Apply affordance exists; zero-result keeps panel open with the correct empty copy behind."
    why_human: "Live-apply timing and empty-state routing behind an open panel are device-observable."
  - test: "At default and at 200% OS text scale, observe the two header destinations (Your Week, Group Events)."
    expected: "Both always present; labels shown when they fit, otherwise BOTH collapse to icon-only; header never wraps, shrinks below role size, or pushes the control/search rows down."
    why_human: "Responsive icon-only fallback depends on measured rendered width under OS text scale."
  - test: "Expand and collapse the Row-3 search with reduced-motion OFF then ON; background the app mid-animation; verify the right-aligned List/Card toggle keeps a 44px target at supported widths and 200% text scale."
    expected: "Restrained motion with reduced-motion collapsing to instant; no half-run animation after backgrounding; 44px toggle targets hold; search takes remaining row width."
    why_human: "Animation, reduced-motion, backgrounding, and touch-target sizing are render/device-observable."
  - test: "Navigate Dashboard → Archived → a Profile → Back, and Dashboard → Unbound → search → Back. Confirm both Archived entry points (overflow + Settings row) reach the same screen."
    expected: "Origin-aware return lands back on Archived (not Dashboard root); Unbound own-route search filters live and disambiguates no-match from true-empty; both Archived entry points open one screen."
    why_human: "Origin-aware per-tab-stack return and live in-memory search filtering are navigation/device-observable."
  - test: "Tap the disabled Select Contacts overflow row; run Reset Dashboard View from a mixed state and from an already-default state."
    expected: "Select Contacts is a true no-op with the sheet staying open and reads disabled to AT; Reset returns Active/no filters/Default sort/cleared search with NO confirmation dialog while preserving the List/Card viewMode."
    why_human: "Disabled-row AT behaviour and no-confirmation reset UX are device-observable (logic itself is node-tested)."
review_notes:
  - "26-REVIEW.md: 0 Critical / 3 Warning / 3 Info. The three Warnings (WR-01 a11y focus re-steal on in-panel toggle; search term persists after collapse; favourites-vs-filter empty copy edge) are user-facing UX refinements — none reverses a locked must_have, ADR, or HANDOFF entry, and none breaks the phase goal. Not gaps; worth an owner glance during the UAT."
---

# Phase 26: Dashboard Control Surface — Verification Report

**Phase Goal:** The Dashboard exposes its query foundation through a lean header and three equal anchored panels that apply changes live, with no modal step and no Apply button.
**Verified:** 2026-09-05T10:05:00Z
**Status:** human_needed (all code-level truths verified; rendered/on-device behaviour batched into one Pixel UAT)
**Re-verification:** No — initial verification

## Goal Achievement

Every layer of the phase goal is realised in the code on disk, verified by reading the actual files (not the SUMMARYs):

- **Lean ordered hierarchy** — `HomeScreen.tsx` renders header → control row → search+toggle → collection → root overlay host, with the control row a fixed sibling whose position is invariant to header/search state (DASHC-01).
- **Three equal anchored panels** — `DashboardControlRow.tsx` renders three co-equal Pressables, each measuring its own anchor (`measureInWindow`) and reporting `{anchorRect,size,content,onDismiss}` to the root-level `DashboardOverlayHost`. `AnchoredPanel.tsx` is an **in-tree absolute `View`, not an RN `Modal`** (goal: "no modal step") with a full-surface scrim (DASHC-03/04/05, D-11).
- **Apply live, no Apply button** — the layer-2 panels emit **intents** (`onTogglePopulation`/`onToggleFilter`/`onClearFilters`/`onSelectSort`); the serialized owner derives `next` from `useDashboardQueryStore.getState()` at press time under a per-axis pending lock and calls the store setter immediately. No Apply/Done affordance exists anywhere in the control surface (DASHC-04/06).

## Observable Truths (code-level)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dashboard reads header → control row → search+toggle → collection | ✓ VERIFIED | HomeScreen.tsx:500-693 render order; control row is a fixed sibling |
| 2 | Two co-equal header destinations with measured icon-only fallback | ✓ VERIFIED | HomeScreen.tsx:510-585 + ShellAppBar.tsx:49-73 (compact from onTextLayout probe, fail-closed default) |
| 3 | Three separate equal controls, `+N` summaries, restrained active treatment | ✓ VERIFIED | DashboardControlRow.tsx:210-246; collapseSummary; accent border + accessibilityState.selected |
| 4 | Anchored floating panel, in-tree non-Modal, live re-query behind scrim | ✓ VERIFIED | AnchoredPanel.tsx (View not Modal) + DashboardOverlayHost.tsx root-level; HomeScreen reload() |
| 5 | Background inert + a11y-hidden while open; re-tap/outside/Back dismiss; one panel | ✓ VERIFIED | HomeScreen.tsx:505-591 inert wrappers; AnchoredPanel.tsx:59-95 scrim + shellTransientStore; dashboardPanelStore single request |
| 6 | All Contacts ordinary row; Active implicit default; Clear filters; Sort Default | ✓ VERIFIED | PopulationPanelContent.tsx:6-44; FilterPanelContent dashboard-filters-clear; SortPanelContent default option |
| 7 | Collapsible session-backed search + right-aligned 44px List/Card toggle | ✓ VERIFIED | HomeScreen.tsx:592-658; dashboard-session-store; SegmentedControl icon?:IconName |
| 8 | Overflow = fixed 5 rows, Select Contacts disabled no-op, no Manage Favorites | ✓ VERIFIED | dashboard-overflow-actions.ts:19-51; OverflowMenu.tsx:104-109 short-circuit; node test passes |
| 9 | Unbound/Archived child routes, origin-aware return, both Archived entry points → one screen | ✓ VERIFIED | ShellAppBar variant='child'; DashboardStack + SettingsStack both register Archived; Unbound own search |
| 10 | Reset returns Active/none/Default/cleared, preserves viewMode, no dialog | ✓ VERIFIED | HomeScreen.tsx:146-174 handled async + resetDashboardView store setter |
| 11 | listDashboardSearch: additive, shared helper (no fork), bound-only, A3 scope | ✓ VERIFIED | dashboard-read.ts:398-446 composePopulationRead shared; implicit-active relaxes to archived-only; ?-bound term |
| 12 | 5-key populationCounts from cheap dedicated bound-only counts | ✓ VERIFIED | dashboard-read.ts:511-543 countFavourites/countAllContacts/countBirthdayPopulation (empty-candidate guard) |
| 13 | Legacy listDashboard + listNeverContacted retired, no dual-read | ✓ VERIFIED | grep: no runtime callers, defs removed; D-03 count/policy machinery preserved |
| 14 | View-toggle + store-setter idempotency; hydration generation guard | ✓ VERIFIED | dashboard-query-store.ts:79-122; 50/50 targeted tests pass |

**Score:** 10/10 requirements code-satisfied; every code-level truth VERIFIED. Remaining verification is rendered/on-device behaviour (below).

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| control-surface/AnchoredPanel.tsx | ✓ VERIFIED | 115 lines, in-tree non-Modal, Reanimated gated on focus/AppState/reduced-motion |
| control-surface/DashboardOverlayHost.tsx | ✓ VERIFIED | 46 lines, zustand dashboardPanelStore, single request |
| control-surface/DashboardControlRow.tsx | ✓ VERIFIED | 262 lines, three triggers, intent callbacks, per-axis pending locks, error surfacing |
| control-surface/PopulationPanelContent.tsx | ✓ VERIFIED | All Contacts first, intent-only, no dao import |
| control-surface/FilterPanelContent.tsx | ✓ VERIFIED | Sources GRAVITY_TIERS + SOCIAL_BATTERY_VALUES + NEEDS_ATTENTION_VALUE + CONTACT_FREQUENCY_BANDS |
| control-surface/SortPanelContent.tsx | ✓ VERIFIED | Single-select modes incl explicit default |
| control-surface/{anchor-position,control-summary,control-labels,filter-summary}.ts | ✓ VERIFIED | Pure helpers, single label source, tests pass |
| screens/dashboard-overflow-actions.ts | ✓ VERIFIED | Pure 5-row builder, object param, node-tested |
| db/dashboard-read.ts (listDashboardSearch, count* helpers) | ✓ VERIFIED | New exports present, bound-only, A3 preserved, empty guards |
| screens/{Archived,Unbound}ContactsScreen.tsx | ✓ VERIFIED | ShellAppBar variant='child'; ADR-018 purge preserved; Unbound own search |
| screens/unbound-list-logic.ts | ✓ VERIFIED | filterUnboundByName + unboundCountLabel matching-mode |
| components/SegmentedControl.tsx | ✓ VERIFIED | Optional icon?:IconName, backward-compatible |
| stores/{dashboard-query-store,dashboard-session-store}.ts | ✓ VERIFIED | Generation guard, idempotent setViewMode, ephemeral search |

## Prohibitions (all upheld in code)

| Prohibition | Status | Evidence |
|-------------|--------|----------|
| No RN Modal / BaseOverlay for the panel | ✓ UPHELD | AnchoredPanel uses absolute `View`, not `Modal` |
| No React-state-per-frame / no Skia for animation | ✓ UPHELD | Reanimated shared values; gated on focus/AppState/reduced-motion |
| No colour literals | ✓ UPHELD | Theme tokens throughout; `npm run check:colors` green (this session) |
| No Manage Favorites / ranked-favourites affordance | ✓ UPHELD | Overflow has no such row; no sort-by-favourite_rank |
| No term param added to / fork of listDashboardPopulation | ✓ UPHELD | Shared private composePopulationRead; public signature unchanged |
| No contact-import entry on Select Contacts / overflow | ✓ UPHELD | Select Contacts disabled no-op, no import |
| ADR-018 purge flow unchanged | ✓ UPHELD | confirmPurge/purgeBody/computeImpact/POST-COMMIT cleanup intact |
| No dual-read left after listDashboardSearch wired | ✓ UPHELD | listDashboard/listNeverContacted retired, no runtime callers |
| D-03 count/policy machinery preserved (no key drop) | ✓ UPHELD | countNeverContacted + readIncludeUnboundNeverContacted + include_unbound_never_contacted intact |

## Requirements Coverage

All 10 phase requirement IDs (DASHC-01…10) are declared across the 7 plans and each maps to satisfied implementation evidence (see `requirements_coverage` frontmatter). REQUIREMENTS.md maps `DASHC-01…10 → Phase 26` and no additional ID is orphaned. No plan under-claims the roadmap scope.

## Behavioural Evidence

Targeted run of the load-bearing behaviour-dependent tests (state transitions / counts / idempotency): **50/50 passed** across `dashboard-query-store.test.ts`, `dashboard-read.test.ts`, `anchor-position.test.ts`, `unbound-list-logic.test.ts`, `dashboard-overflow-actions.test.ts`. Full suite (238 files / 2246 tests), `tsc --noEmit`, and `check:colors` were confirmed green this session.

## Human Verification Required

This is a UI-heavy phase. Panel anchoring geometry, live-apply-behind-panel, background inertness/a11y-hide, Back-dismiss ordering, header icon-only fallback, reduced-motion, 44px targets, 200% text scale, and origin-aware return are legitimately render/device-observable only. Seven batched checks are captured in the `human_verification` frontmatter for a single **26-UAT.md** pass on the Pixel. None are code-level gaps — the code, wiring, and pure logic all verify.

## Gaps Summary

No gaps. No missing artifacts, no stubs, no broken wiring, no unverified prohibitions, no unreferenced debt markers. The phase goal is achieved in the codebase; the only outstanding step is on-device UAT confirmation of the UI-observable behaviours.

---

_Verified: 2026-09-05T10:05:00Z_
_Verifier: Claude (gsd-verifier)_
