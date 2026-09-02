---
phase: 07-conversational-fuel
plan: 01
subsystem: database
tags: [sqlite, fuel, dao, react-native, expo, controlled-component]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "fuel table (migration 1), SqlExecutor + inWriteTransaction, newUid, node:sqlite testkit"
  - phase: 03-touchpoints
    provides: "*Core + mutexed writer split, assertOneChange both-keys scoping, contact-links-dao controlled-list posture"
  - phase: 06-log
    provides: "ContactProfileScreen unified load() + mutation-then-load convention, timeline-read single-read-module model"
provides:
  - "fuel-dao writer: addFuel/addFuelCore, editFuel/editFuelCore, deleteFuel/deleteFuelCore (the *Core primitives Phase-10 multi-attach composes on)"
  - "fuel-read: listFuelForEditor — the single fuel read choke point; the ONLY projection read that surfaces off_limits"
  - "FuelEditor: controlled per-item fuel editor (add/edit/delete across 5 kinds + optional label/url, off_limits marked private)"
  - "Conversational Fuel section mounted on ContactProfileScreen (listFuelForEditor in unified load(); mutation-then-load)"
affects: [08-dashboard, 07-02-ranked-line, 07-03-ai-unconfirmed, 07-04-search, 10-share-capture]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fuel-read as the single projection read choke point (later projections MUST exclude off_limits in-query, never in the UI)"
    - "controlled editor with an uncontrolled defaultValue-per-row commit-on-blur path (avoids the value={row.text} freeze) + a single new-item draft as the only local state"
    - "BLANK→NULL normalization at the one onAdd/onEdit commit boundary (trim().length===0 ? null : v) — no reliance on SQL TRIM"

key-files:
  created:
    - src/db/fuel-dao.ts
    - src/db/fuel-dao.test.ts
    - src/db/fuel-read.ts
    - src/db/fuel-read.test.ts
    - src/components/FuelEditor.tsx
  modified:
    - src/screens/ContactProfileScreen.tsx

key-decisions:
  - "Age, ranked line, AI-unconfirmed state, and search are deferred to Plans 02-04 per the plan objective — Plan 01 renders only add/edit/delete across the 5 kinds + optional label/url."
  - "Blank-optional normalization lives in FuelEditor (the component's onAdd/onEdit boundary); the parent merges the already-normalized partial patch onto the current row before calling editFuel."
  - "The delete confirmation Alert lives in the ContactProfileScreen parent (mirroring the shipped touchpoint doDelete), not inside FuelEditor — the ✕ just calls onDelete(id)."
  - "FuelEditor takes no `now` prop (the plan listed one only for age, which is Plan 02); the parent mints localDateTime() at each write instead."

patterns-established:
  - "Pattern 1: fuel-read is the single user-facing/projection read path; purge-dao's maintenance count/delete are explicitly exempt (not consolidated)."
  - "Pattern 2: uncontrolled existing-row inputs (defaultValue keyed by row id, commit on onEndEditing) + a single controlled new-item draft — the only implementable controlled-parent immediate-write shape."

requirements-completed: [FUEL-01, FUEL-02]

coverage:
  - id: D1
    description: "fuel-dao writer — add/edit/delete, 9 columns verbatim, NULL optionals, all 5 kinds, both-keys scoped edit/delete, created_at preserved on edit, addFuelCore composes in an open transaction"
    requirement: "FUEL-01"
    verification:
      - kind: unit
        ref: "src/db/fuel-dao.test.ts (8 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "fuel-read listFuelForEditor — all 5 kinds incl off_limits, newest-first (created_at DESC, id DESC), cross-contact isolation, empty→[]"
    requirement: "FUEL-02"
    verification:
      - kind: unit
        ref: "src/db/fuel-read.test.ts (3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "FuelEditor + Conversational Fuel section on ContactProfileScreen — add one item of each kind, edit in place, delete (permanent, confirmed); off_limits editable and marked private"
    requirement: "FUEL-01"
    verification:
      - kind: automated_ui
        ref: "npx tsc --noEmit && npm run check:colors && npx biome check src/ — all clean"
        status: pass
    human_judgment: true
    rationale: "The .tsx is a thin renderer (the -logic/.test convention proves correctness in the DAO node tests); add/edit/delete UX, the off_limits marker, and the delete Alert are device-UAT on the Pixel (phase gate), not asserted by a node test."

# Metrics
duration: 8 min
completed: 2026-08-15
status: complete
---

# Phase 7 Plan 1: Conversational Fuel (writer + read + editor) Summary

**Per-item conversational fuel end-to-end: a mutexed `*Core`+public fuel-dao writer, the single `listFuelForEditor` read choke point (the only read that surfaces off_limits), and a controlled `FuelEditor` mounted on the contact profile — add/edit/delete across all 5 kinds + optional label/url, off_limits editable and marked private. No new migration.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-15T18:48:00Z
- **Completed:** 2026-08-15T18:56:00Z
- **Tasks:** 3
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `fuel-dao.ts` — the mutexed add/edit/delete writer with the `*Core` (non-mutexed) + public (mutexed) split every later fuel write and Phase-10 multi-attach will compose on; both-keys scoping (id AND contact_id) with `assertOneChange` rollback; created_at preserved on edit; 9 columns `?`-bound with no identifier interpolation.
- `fuel-read.ts` — `listFuelForEditor`, the single projection read choke point, the ONLY read that includes off_limits (editable on profile); purge-dao's maintenance count/delete documented as explicitly exempt.
- `FuelEditor.tsx` — a controlled per-item list (no DB import): a single new-item draft as the only local state, uncontrolled existing-row inputs (defaultValue keyed by row id, commit on blur), immediate kind-picker commit, BLANK→NULL normalization at the commit boundary, and the off_limits "private" marker.
- Mounted the "Conversational Fuel" section on `ContactProfileScreen` — `listFuelForEditor` added to the unified `load()` Promise.all; add/edit/delete route through fuel-dao then `await load()`; permanent-delete Alert reuses the shipped "no undo, no backup" copy.

## Task Commits

Each task was committed atomically (TDD RED→GREEN for Tasks 1-2):

1. **Task 1: fuel-dao writer** — `ad66761` (test, RED), `fcbeb18` (feat, GREEN)
2. **Task 2: fuel-read listFuelForEditor** — `a22d59f` (test, RED), `f96112f` (feat, GREEN)
3. **Task 3: FuelEditor + ContactProfileScreen mount** — `f2c2825` (feat)

## Files Created/Modified
- `src/db/fuel-dao.ts` — FuelKind/FuelSource/NewFuelItem/EditFuelInput types; addFuel/addFuelCore, editFuel/editFuelCore, deleteFuel/deleteFuelCore; scoped assertOneChange.
- `src/db/fuel-dao.test.ts` — node:sqlite proof (8 tests): verbatim insert, NULL optionals, 5 kinds, scoped edit/delete, preserved created_at, core-in-transaction.
- `src/db/fuel-read.ts` — FuelItem interface; listFuelForEditor (choke-point read, off_limits included).
- `src/db/fuel-read.test.ts` — node:sqlite proof (3 tests): all kinds incl off_limits newest-first, cross-contact isolation, empty→[].
- `src/components/FuelEditor.tsx` — controlled repeatable fuel list; KindPicker (Modal+FlatList), DraftRow, FuelRow; off_limits marker; no DAO import.
- `src/screens/ContactProfileScreen.tsx` — Conversational Fuel section; listFuelForEditor in load(); doAddFuel/doEditFuel/doDeleteFuel wired to fuel-dao then load().

## Decisions Made
- Deferred age, ranked line, AI-unconfirmed state, and search to Plans 02-04 (per the plan objective "slice 1 of 4"). Plan 01 renders only the thinnest add/edit/delete path.
- Blank-optional NULL normalization is done in FuelEditor at its onAdd/onEdit boundary; the parent merges the already-normalized partial edit patch onto the current row from `fuel` state before calling editFuel (which does a full kind/label/text/url UPDATE).
- The delete Alert lives in the ContactProfileScreen parent (mirroring the shipped touchpoint doDelete), keeping FuelEditor pure/controlled; the ✕ calls onDelete(id).

## Deviations from Plan

**1. [Scope clarification — not a fix] FuelEditor takes no `now` prop**
- **Found during:** Task 3 (FuelEditor)
- **Issue:** The plan's Task 3 prose listed a `now` prop on FuelEditor, but `now` was only needed for age rendering — which the plan objective explicitly defers to Plans 02-04. An unused prop would also be dead code.
- **Fix:** Omitted the `now` prop; the parent mints `localDateTime()` at each add/edit write (matching the screen's existing convention). No behavior lost this slice.
- **Files modified:** src/components/FuelEditor.tsx
- **Verification:** tsc + biome clean; add/edit/delete round-trip proven in the DAO node tests.
- **Committed in:** f2c2825 (Task 3 commit)

**2. [Housekeeping] biome import/format reflow on already-committed Task-1 files**
- **Found during:** Task 3 verify (full `biome check src/`)
- **Issue:** biome's import-organize + line-wrap touched src/db/fuel-dao.ts and fuel-dao.test.ts (committed in Task 1 before the full-suite biome run).
- **Fix:** Applied the safe format fixes; folded the format-only reflow into the Task 3 commit.
- **Files modified:** src/db/fuel-dao.ts, src/db/fuel-dao.test.ts
- **Verification:** `biome check src/` clean (147 files); full vitest still 540/540.
- **Committed in:** f2c2825 (Task 3 commit)

---

**Total deviations:** 2 (1 scope clarification, 1 housekeeping) — no auto-fixes to production behavior were required.
**Impact on plan:** None. The writer/read behavior matches the plan exactly; the only adjustment is deferring a prop that belonged to a later slice.

## Issues Encountered
None — all three tasks executed as written. RED→GREEN cycles behaved as expected (both test suites failed with "cannot find module" before implementation, passed after).

## Verification Results
- `npx vitest run src/db/fuel-dao.test.ts` — 8/8 pass.
- `npx vitest run src/db/fuel-read.test.ts` — 3/3 pass.
- `npx vitest run` (full suite) — 540/540 pass (46 files).
- `npx tsc --noEmit` — clean (exit 0).
- `npm run check:colors` — green (exit 0; zero net-new token, no raw hex).
- `npx biome check src/` — clean (147 files, no fixes applied).
- `git status src/db/migrations/` — no change (no new migration; migration 1 untouched).
- Single-writer invariant: fuel-dao/fuel-read do not appear among `last_contact` writers — recency-dao remains the sole writer, untouched.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Ready for 07-02** (the ranked fuel line). fuel-read is the choke point 07-02's `getRankedFuel` extends; it MUST exclude off_limits (and, per UI-SPEC, unconfirmed `source='ai'`) in-query.
- **Phase gate outstanding:** on-device UAT on the Pixel (add one item of each kind, edit, delete; confirm off_limits editable + marked private) runs after all 4 plans per docs/runbooks/desktop-build-pipeline.md — deferred by design, not a blocker for 07-02.

## Self-Check: PASSED

- All 5 created files present on disk; SUMMARY present.
- All 5 task commits (ad66761, fcbeb18, a22d59f, f96112f, f2c2825) found in git log.

---
*Phase: 07-conversational-fuel*
*Completed: 2026-08-15*
