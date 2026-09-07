---
phase: 29-orrery-camera-scale-exploration
plan: "09"
subsystem: ui
tags: [orrery, sqlite, gestures, reorder, tdd]
requires:
  - phase: 29-08
    provides: Coherent System snapshots, current-frame interaction and camera ownership
provides:
  - Locked filtered contacted permutations with order, sun, UID and live membership checks
  - Test-local exact SQLite local-day override with native date delegation
  - Prolonged stationary hold, transient radial preview and success-only guarded release
affects: [29-10, 29-11, 29-12]
tech-stack:
  added: []
  patterns: [snapshot-bound rank requests, transaction-time cancellation, shared-value reorder preview]
key-files:
  created:
    - src/db/__testkit__/sqlite-local-day.ts
    - src/logic/orrery-reorder-logic.ts
    - src/logic/orrery-reorder-logic.test.ts
  modified:
    - src/db/ring-seq-dao.ts
    - src/db/ring-seq-dao.test.ts
    - src/logic/ring-reorder-logic.ts
    - src/logic/ring-reorder-logic.test.ts
    - src/components/orrery/use-orrery-camera.ts
    - src/components/orrery/OrreryWorld.tsx
    - src/components/orrery/orrery-render.test.tsx
    - src/screens/OrreryScreen.tsx
key-decisions:
  - Production delayed gestures use commitRingReorder; the legacy complete-population rewrite retains its original guards and remains test-only at call sites.
  - A logical current-generation callback is checked inside the transaction and after scoped writes, allowing queued or mid-write cancellation to roll back.
requirements-completed: []
requirements-progressed: [ORRC-10]
coverage:
  - id: D1
    description: Filtered contacted reorder preserves hidden slots and rejects stale order, sun, identities and membership
    verification:
      - kind: integration
        ref: src/db/ring-seq-dao.test.ts
        status: pass
      - kind: unit
        ref: src/logic/ring-reorder-logic.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Queued midnight invalidation runs actual SQLite membership predicates after mutex acquisition
    verification:
      - kind: integration
        ref: src/db/ring-seq-dao.test.ts#locked filtered reorder
        status: pass
    human_judgment: false
  - id: D3
    description: Registered hold callbacks and inverse-projected release suppress cancelled, ambiguous, neutral and unchanged writes
    verification:
      - kind: unit
        ref: src/logic/orrery-reorder-logic.test.ts
        status: pass
      - kind: integration
        ref: src/components/orrery/orrery-render.test.tsx
        status: pass
    human_judgment: false
  - id: D4
    description: Native stationary hold activation, panning arbitration, haptic feel and ghost-ring feedback
    verification: []
    human_judgment: true
    rationale: Mocked registered callbacks cannot prove Android event arbitration or native visual/haptic behavior; Plan 12 owns device evidence.
duration: 17min
completed: 2026-09-07
status: complete
actuals:
  tokens: 13389
  tasks: 2
  commits: 6
---

# Phase 29 Plan 09: Deliberate Guarded Reorder Summary

**A prolonged stationary hold now previews contacted ring reordering and submits a snapshot-bound filtered permutation through current SQLite order, sun, identity and System guards.**

## Accomplishments

- `mergeVisibleRingOrder` validates unique complete/visible/permuted IDs and replaces only selected slots. Existing immutable clamped permutation math remains and is worklet-compatible.
- `commitRingReorder` enters one existing write transaction, reads the singleton saved sun and exact complete contacted order, compares the full ID/UID fingerprint including a neutral saved sun, then reads current System members on the already-locked executor. Exact eligible ordered membership must still match before a permutation is computed. No caller-supplied arbitrary full replacement order is accepted. The original uniqueness/count/scoped changes===1 guards run in a shared non-mutexed core. No-op requests do not change timestamps or revision; real changes bump revision once. Recency/status/Gravity fields are not written.
- The test-local SQLite fixture overrides only `date('now','localtime')`. Stored dates, modifiers, NULL and every other date call delegate via bound SQL to an untouched second connection; both connections close idempotently. Setter validation uses native SQLite normalization. Tests retain old snapshot requests while the shared mutex is blocked, advance only the local day, then assert the membership SQL runs after lock acquisition at the advanced day and rolls back without changing stored rows or revision.
- World captures a single eligible current-frame target and the original coherent expectation before activation. Native `activateAfterLongPress(850)` arms shared transient state, highlights the body and ghost rail with the accent token, and triggers one haptic acknowledgement. Prehold movement uses the camera. Actual outward drift and finger-to-body offset are removed after inverse projection; nearest eligible radial slots use outer-slot midpoint ties and endpoint clamping. Neutral and ambiguous targets never arm.
- Only successful active `onEnd` dispatches changed order. Finalize clears state only. Second pointer, stale scene generation, inactive camera and lifecycle cleanup cancel the preview. Screen route/AppState/generation checks are repeated inside the queued transaction, including after writes so mid-write cancellation rolls back. Failure exposes the exact approved saved-order feedback and Reload System; a failed reload does not clear that feedback.

## Task Commits

1. Task 29-09-01 RED: `1353e10` — filtered-slot behavior.
2. Task 29-09-01 GREEN: `abdb7e9` — merge helper, lock-time DAO guards and SQLite local-day fixture/tests.
3. Task 29-09-02 RED: `d55af61` — drift-aware projection and release behavior.
4. Task 29-09-02 GREEN: `c53292f` — native adapters, shared preview, feedback and transactional cancellation.

Four task commits plus summary and tracking metadata commits. All local on main with hooks. No tracked deletions, migration, dependency installation, device operation, push, branch switch or worktree. Unrelated baseline edits and native build output remain untouched.

## Exported Contracts

- `RingReorderRequest {system, expectedFullOrderedIds, expectedSavedSunContactId, expectedEligibleVisibleIds, expectedContactIdentities, reorderedVisibleIds}`; all expectations come from the unchanged `OrrerySystemSnapshot`.
- `commitRingReorder(exec, request, now, isCurrent?:()=>boolean):Promise<void>` is the production delayed-gesture entry. `isCurrent` is logical cancellation, not a substitute for live SQL membership. The legacy `rewriteRingSeq(exec, orderedIds, now, excludeContactId)` still exercises the original complete-population contract in its existing tests; no production caller uses it.
- `openSqliteLocalDayFixture(initialLocalDay)` returns `{db,exec,setLocalDay,close}` for Plan 12 integration. It introduces no application clock injection or production testkit import.
- `captureReorder`, `moveReorder`, `releaseReorder`, `previewReorder`; `ReorderDrag` contains generation, captured request, original eligible radii, actual drift, touch offset/origin, transient permutation and active state. `ReorderIntent` contains generation and the complete guarded request.
- `useOrreryCamera` adds `reorder:SharedValue<ReorderDrag|null>`. `createOrreryGestures` accepts an optional reorder adapter with shared drag, expectation/generation, acknowledgement and commit callbacks. Existing non-reorder tracer callers remain compatible.
- `OrreryWorld` now requires `onReorder` and `onReorderActivated`. Preview feeds its existing single authoritative projected frame and preserves the contiguous native body Group batch. Screen owns the haptic bridge and asynchronous DAO feedback.

## Verification

- Both TDD RED commits precede their implementation commits. Task 1 missing helper caused one failing assertion; Task 2 missing production module failed suite loading.
- Task 1 required targeted run: **3 files / 56 tests passed**, exit 0, `/tmp/orbit-29-09-task1.log`.
- Task 2 initial required run: **3 files / 44 tests passed**, exit 0, `/tmp/orbit-29-09-task2.log`; subsequent registered-handler/render run **3 files / 17 tests passed**, exit 0, `/tmp/orbit-29-09-adapter.log`.
- Final full regression: **270 files / 2,539 tests passed**, exit 0, **28.00 seconds**, `/tmp/orbit-29-09-tests-final.log`. Baseline was 269 files / 2,502 tests. No skips. The full suite was rerun after adding the Pan-finalize ordering fix; no source changes followed the final run.
- Final `npx tsc --noEmit`: exit 0, empty `/tmp/orbit-29-09-type-final.log`. `npm run check:colors`: exit 0. Eleven-file targeted Biome: exit 0, no warnings/fixes. `git diff --check`: exit 0.
- Context7 and ctx7 unavailable; consulted installed Gesture Handler Pan API and Android delayed-activation implementation plus official [Pan gesture documentation](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/pan-gesture/). Native Android schedules activation independently of movement; actual device timing remains unverified.

## Deviations from Plan

1. **[Rule 2 — Critical cancellation]** Added the optional `isCurrent` callback at the DAO transaction boundary. A screen-only prequeue check cannot prevent blur/System cancellation while waiting for the shared mutex. Cancellation tests also force it during scoped writes and verify the entire transaction rolls back. Commit `c53292f`.
2. **[Rule 1 — Gesture ordering]** A losing Pan may finalize before the winning hold starts. Pan now cancels only its own active pan state, leaving pending hold ownership available. The registered callback test covers both finalize orderings. Commit `c53292f`.
3. **[Rule 3 — Integration tests]** Extended the existing render contract test for required reorder callbacks and the independent accent ghost layer. Existing sun/body depth assertions remain intact. Commit `c53292f`.

## Native and Cross-Plan Limits

- Native stationary hold activation, preactivation pan, multi-pointer cancellation and haptic/ghost-ring acknowledgment remain pending Plan 12 device verification. WINDOWS entry **53** records this obligation. No native accessibility or performance claim is made.
- ORRC-10 remains pending because later integrated/native coverage is assigned to Plan 12. This summary records implementation progress without prematurely completing the shared requirement.
- SDK advanced to Plan 10 of 12. ROADMAP's SDK scanner again counted `29-PLAN-CHECK.md` as a thirteenth plan; corrected it to 9/12 and removed the generated checkbox. Global progress update reported truncated phase scope and left milestone progress unchanged.
- Lock wait/hold latency remains unmeasured. The existing shared FIFO transaction/mutex semantics are preserved.
- No new placeholder source data, skipped test, network/auth/schema/file-access boundary, or unrun automated verification. Empty transient drag state and empty Skia paths are lifecycle cleanup, not stubs.

## Performance

Approximately 17:07–17:24 UTC, two tasks, eleven source/test files. Estimate-scale actuals: ceil(53,554 realized source/test diff characters / 4) = **13,389**, not harness token usage.

## Self-Check: PASSED

All three new files and all four task commits exist; no tracked files were deleted. Required automated checks pass and source/test changes are committed. Summary is on disk before tracking advances.
