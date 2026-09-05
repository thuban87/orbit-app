---
phase: 25-dashboard-data-state-foundation
plan: 07
subsystem: ui
tags: [dashboard, navigation, sqlite, react-navigation, search, bound-unbound]

# Dependency graph
requires:
  - phase: 25-02
    provides: "Birthdays population (30-day) + listBirthdayCandidates as the sole birthday surface after the banner is removed"
  - phase: 25-03
    provides: "listDashboardPopulation not-contacted population (the Not-Contacted DATA path that survives the screen retirement)"
  - phase: 25-04
    provides: "the new scoped dashboard search (also Bound-only per DASHQ-08)"
  - phase: 25-06
    provides: "prior-wave navigation/types cleanup (ManageFavourites half of the types.ts comment)"
provides:
  - "Dashboard birthday banner removed (ADR-076/DASHQ-14); freshness triad retained"
  - "Standalone Never Contacted screen + its route retired (DASHQ-03); consumers re-pointed to live Home"
  - "include-Unbound Settings toggle UI removed; app_settings column + portable key KEPT (Phase 36 coordinates removal)"
  - "legacy listDashboard term branch made BOUND-ONLY (D-13) — Unbound no longer leaks into legacy Home search"
  - "Dashboard-search Unbound retrieval rows retired (D-07); no searchUnbound built (deferred to Phase 26)"
affects: [26-dashboard-controls, 27-list-view, 28-card-view, 36-ai-config]

# Actuals
actuals:
  tokens: 6979
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consumer-repointing retirement: delete a screen/route only after every navigate() target + browseRoutes literal + registration is re-pointed atomically to a live route"
    - "Deletion-with-consumers deferral: remove UI only, keep the durable column + portable-settings key until the coordinated backup-format bump"

key-files:
  created: []
  modified:
    - "src/screens/HomeScreen.tsx — banner mount + import removed; footer nav re-pointed to Home; Unbound search-row render + helper import + dead styles removed"
    - "src/db/dashboard-read.ts — listDashboard Branch 1 gains AND ${DASHBOARD_BOUND_WHERE}; BASE_WHERE exported (value byte-unchanged); listNeverContacted marked @deprecated"
    - "src/db/dashboard-read.test.ts — Unbound-search test inverted to the D-13 assertion; BASE_WHERE byte-lock added"
    - "src/screens/SettingsScreen.tsx — include-Unbound toggle row removed (column/key kept)"
    - "src/screens/DigestScreen.tsx — onPressBacklog re-pointed to Home; stale doc comment reworded; countNeverContacted read kept"
    - "src/navigation/tabs/DashboardStack.tsx, src/navigation/types.ts, src/navigation/RootNavigator.tsx, src/navigation/focused-route-classification.test.ts — NeverContacted route + param + browseRoutes literal + stale comments removed"

key-decisions:
  - "Legacy Home term branch made Bound-only NOW (D-13): AND c.tracking_enabled = 1 added to Branch 1 only; BASE_WHERE + every other branch byte-unchanged."
  - "Unbound name-lookup replacement DEFERRED to Phase 26 (owner-accepted one-phase gap, D-13) — no searchUnbound added; browse via listUnbound stays."
  - "Never Contacted screen retired NOW (D-14); Not-Contacted chip lands Phase 26; navigate() re-points to live Home; countNeverContacted kept for Digest."
  - "include_unbound_never_contacted column + PORTABLE_SETTINGS_KEYS entry retained pending Phase 36 backup-format bump (D-05); only the toggle UI removed."
  - "BASE_WHERE exported solely to enable the byte-lock regression assertion; the WHERE string value is byte-identical."

patterns-established:
  - "Bound-predicate reuse: route the tracking_enabled = 1 constraint through the shared DASHBOARD_BOUND_WHERE constant, never an inline literal."

requirements-completed: [DASHQ-03, DASHQ-08, DASHQ-14]

coverage:
  - id: D1
    description: "Dashboard birthday banner removed; HomeScreen freshness triad (useFocusEffect / AppState / pull-to-refresh) retained; birthdays reached only via the Birthdays population"
    requirement: "DASHQ-14"
    verification:
      - kind: other
        ref: "grep -n 'BirthdayBanner' src/screens/HomeScreen.tsx (no match); npx tsc --noEmit; npm run check:colors"
        status: pass
    human_judgment: true
    rationale: "The at-a-glance birthday coverage gap (D-06) and the visual absence of the banner are owner-facing product judgments; only the code removal is machine-verifiable."
  - id: D2
    description: "Standalone Never Contacted screen + route retired; HomeScreen footer + DigestScreen backlog nav re-pointed to a live route; countNeverContacted kept for Digest"
    requirement: "DASHQ-03"
    verification:
      - kind: unit
        ref: "src/navigation/focused-route-classification.test.ts (browseRoutes no longer lists NeverContacted); full vitest run 2238 pass"
        status: pass
      - kind: other
        ref: "grep -rn 'name=\"NeverContacted\"|navigate(\"NeverContacted\")|\"NeverContacted\",' src → only benign seed-name fixtures; npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D3
    description: "include-Unbound Settings toggle UI removed; app_settings column + portable key kept for Phase 36"
    requirement: "DASHQ-03"
    verification:
      - kind: other
        ref: "grep -n 'includeUnboundNeverContacted' src/backup/backup-schema.ts src/db/app-settings-dao.ts (present); grep 'settings-include-unbound-never-contacted' src (removed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Legacy Home term-search branch made Bound-only (D-13); an Unbound name match is excluded while a Bound match is present; BASE_WHERE byte-unchanged"
    requirement: "DASHQ-08"
    verification:
      - kind: unit
        ref: "src/db/dashboard-read.test.ts#D-13: the legacy term branch is BOUND-ONLY ...; #D-13: ... BASE_WHERE stays byte-unchanged"
        status: pass
    human_judgment: false
  - id: D5
    description: "Dashboard-search Unbound retrieval rows retired; no searchUnbound added; unbound-read.ts + UnboundContactsScreen.tsx untouched"
    requirement: "DASHQ-08"
    verification:
      - kind: other
        ref: "grep -rn 'searchUnbound' src (empty); grep -rn 'dashboard-search-row-logic|dashboardSearchRowPresentation|isNeutralDashboardSearchRow' src (empty)"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-09-04
status: complete
---

# Phase 25 Plan 07: Dashboard Surface Retirements Summary

**Removed the Dashboard birthday banner + the standalone Never Contacted screen + the include-Unbound Settings toggle as consumer-repointing deletions, and made the legacy Home term-search branch Bound-only (D-13) so Unbound contacts stop leaking into legacy search — with the count read, portable key/column, and Unbound browse surface all preserved.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 9 modified, 5 deleted (14 total)
- **Commits:** 3 task commits + 1 docs commit

## Accomplishments

- **Task 1 — birthday banner retired (ADR-076/DASHQ-14):** `BirthdayBanner.tsx` deleted; its HomeScreen mount + import removed. HomeScreen's freshness triad (`useFocusEffect` / `AppState`→active / pull-to-refresh) is retained unchanged. No permanent replacement module added — birthdays are reached only via the Birthdays population (Plan 02). `listBirthdayCandidates` kept (notification-read + the Plan-02 population consume it).
- **Task 2 — Never Contacted screen + include-Unbound toggle retired (DASHQ-03):** `NeverContactedScreen.tsx` + its test deleted; the `NeverContacted` route removed from `DashboardStack`, the param entry from `types.ts`, and the `browseRoutes` literal from `focused-route-classification.test.ts`. `HomeScreen`'s footer entry and `DigestScreen`'s backlog nav re-pointed to the live `Home` route. `countNeverContacted` kept (Digest badge); `listNeverContacted` marked `@deprecated` (retired with legacy `listDashboard` in render phases 26–28). The Settings toggle UI row removed; the `include_unbound_never_contacted` column + `PORTABLE_SETTINGS_KEYS` entry KEPT (Phase 36 coordinates removal, D-05).
- **Task 3 — legacy Home search made Bound-only + Unbound rows retired (D-13/D-07/DASHQ-08):** `listDashboard` Branch 1 gained `AND ${DASHBOARD_BOUND_WHERE}` (`c.tracking_enabled = 1`); `BASE_WHERE` and every other branch stay byte-unchanged. The Dashboard-search Unbound retrieval rows removed from HomeScreen and `dashboard-search-row-logic.ts` + `HomeScreen.test.tsx` deleted. No `searchUnbound` built — the Unbound name-lookup replacement is an owner-accepted one-phase gap deferred to Phase 26; `unbound-read.ts` + `UnboundContactsScreen.tsx` untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the Dashboard birthday banner** — `0948395` (feat)
2. **Task 2: Retire the Never Contacted screen + include-Unbound toggle** — `ad7cc6d` (feat)
3. **Task 3: Make legacy Home search bound-only + retire Dashboard-search Unbound rows** — `41916e1` (feat)

**Plan metadata:** this docs commit (docs: complete plan)

## Files Created/Modified

- `src/components/BirthdayBanner.tsx` — DELETED (banner retired)
- `src/screens/NeverContactedScreen.tsx` + `.test.tsx` — DELETED (screen retired)
- `src/screens/dashboard-search-row-logic.ts` + `src/screens/HomeScreen.test.tsx` — DELETED (Unbound retrieval-row helper + its test retired)
- `src/screens/HomeScreen.tsx` — banner + Unbound-row render/import/dead-styles removed; footer nav → `Home`
- `src/db/dashboard-read.ts` — Branch 1 Bound-only; `BASE_WHERE` exported (value byte-identical); `listNeverContacted` `@deprecated`
- `src/db/dashboard-read.test.ts` — D-13 Bound-only assertion + `BASE_WHERE` byte-lock
- `src/screens/SettingsScreen.tsx` — include-Unbound toggle row removed (column/key kept)
- `src/screens/DigestScreen.tsx` — backlog nav → `Home`; stale comment reworded; count read kept
- `src/navigation/tabs/DashboardStack.tsx`, `src/navigation/types.ts`, `src/navigation/RootNavigator.tsx`, `src/navigation/focused-route-classification.test.ts` — `NeverContacted` route/param/literal + stale comments removed

## Decisions Made

Followed the plan and its recorded owner decisions exactly (D-05, D-06, D-07, D-13, D-14). One incidental implementation choice: `BASE_WHERE` was given an `export` keyword purely to enable the requested byte-lock regression assertion in `dashboard-read.test.ts` — the constant's string value is byte-identical; only its visibility changed. This does not alter any WHERE semantics and is consistent with the "BASE_WHERE stays byte-unchanged" trip-wire (which scopes to the WHERE content, not the declaration's visibility).

## Owner-accepted transient gaps (recorded per plan)

- **Unbound name-lookup gap (D-13):** Between Phase 25 and Phase 26, Unbound contacts have NO typed name-lookup (search) path. This is owner-ACCEPTED. The legacy Home term branch is now Bound-only so DASHQ-08 ("search never surfaces Unbound") holds at the data layer for BOTH the legacy Home search (this change) and the new scoped search (Plan 04). The replacement is coordinated with Phase 26 (R-11/ADR-062) — this is NOT an ADR-062 reversal; retrieval-by-browse via `listUnbound` (`UnboundContactsScreen`) stays available.
- **Not-Contacted control gap (D-14):** Retiring the standalone Never Contacted screen leaves a one-phase window with no user-facing chip for the Not-Contacted population (the DATA surface exists after Phase 25; the visible chip lands Phase 26). `navigate('NeverContacted')` call sites re-point to `Home` (a live target, no crash). Owner-accepted; `countNeverContacted` stays for Digest.
- **Birthday coverage gap (D-06):** Removing the banner while "Your Week" is unplanned leaves upcoming birthdays with no at-a-glance surface — reachable only via the Birthdays population (30-day, Plan 02) until the deferred "Your Week" phase. No birthday read was added to Digest; the banner was NOT folded into Digest. Noted, not silently dropped.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1–4 deviations; no bugs, missing functionality, blockers, or architectural changes surfaced. (The `export const BASE_WHERE` change is a plan-directed test-enablement, documented under Decisions, not a deviation.)

## Verification Gate Results

Run from the repo root (the phase's three integration gates + the plan's prohibition greps):

- `npx tsc --noEmit` — **pass**
- `npm run check:colors` — **pass**
- `npx vitest run` (full suite) — **pass: 232 files, 2238 tests**
- `npx vitest run src/db/dashboard-read.test.ts` — **pass: 49 tests** (incl. the two new D-13 assertions)
- `npx vitest run src/navigation/focused-route-classification.test.ts` — **pass**

Prohibition greps:

- `grep -rn 'searchUnbound' src` → **empty** (replacement deferred to Phase 26)
- `grep -rn 'dashboard-search-row-logic|dashboardSearchRowPresentation|isNeutralDashboardSearchRow' src` → **empty**
- `grep -n 'includeUnboundNeverContacted' src/backup/backup-schema.ts src/db/app-settings-dao.ts` → **present** (portable key + column retained)
- `grep -n 'export async function countNeverContacted' src/db/dashboard-read.ts` → **present**; consumed by `DigestScreen.tsx:100`
- `grep -rn 'name="NeverContacted"|navigate("NeverContacted")|"NeverContacted",' src` → matches ONLY the two benign seed-name fixtures (`queries.test.ts:135`, `contact-status-read.test.ts:160`); no route registration / navigate target / `browseRoutes` literal remains
- `grep -n 'DASHBOARD_BOUND_WHERE' src/db/dashboard-read.ts` → present in the term branch (Branch 1) now
- `src/db/unbound-read.ts` still exports only `listUnbound` / `countUnbound` (+ `UnboundRow`), unchanged

## Issues Encountered

None during planned work. (Two per-task commits initially captured only the `git rm` deletions because passing already-removed paths to `git add` aborts the stage; each was corrected with `git commit --amend` so the final Task 1 and Task 2 commits contain both the deletions and the modified files. Verified via `git show --stat`.)

## Known Stubs

None. No hardcoded empty values flowing to UI, no placeholder copy, no unwired data sources introduced. `listNeverContacted` is intentionally `@deprecated`-but-retained (documented, retired with the legacy path in Phase 26–28), not a stub.

## Next Phase Readiness

- Phase 26 (Dashboard Controls) owns the Not-Contacted population chip that closes the D-14 control gap and the Unbound name-lookup replacement that closes the D-13 retrieval gap (R-11/ADR-062).
- Phase 36 (AI Config) owns the coordinated removal of the `include_unbound_never_contacted` column + portable key alongside the backup-format bump (D-05).
- The deferred "Your Week" phase owns richer birthday presentation (D-06).

## Self-Check: PASSED

- Deleted files confirmed gone: `BirthdayBanner.tsx`, `NeverContactedScreen.tsx`, `NeverContactedScreen.test.tsx`, `dashboard-search-row-logic.ts`, `HomeScreen.test.tsx`.
- Task commits confirmed present: `0948395`, `ad7cc6d`, `41916e1`.

---
*Phase: 25-dashboard-data-state-foundation*
*Completed: 2026-09-04*
