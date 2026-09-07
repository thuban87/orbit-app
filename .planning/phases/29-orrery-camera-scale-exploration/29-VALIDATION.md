---
phase: 29
slug: orrery-camera-scale-exploration
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-06
---

# Phase 29 — Validation Strategy

Per-phase validation contract for execution. Research and planning are not implementation evidence. Final task IDs, waves, threats and commands are reconciled below. Nyquist compliance records checked design sampling only; all implementation and native checks remain pending, and wave_0_complete remains false.

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | Existing Vitest 4.1.10, Node environment |
| Config file | `vitest.config.ts` |
| SQLite fixture | `src/db/__testkit__/node-sqlite.ts`, real SQLite with foreign keys |
| Quick run command | `npm test -- orrery ring-seq use-reduced-motion` |
| Full suite command | `npm test` |
| Static checks | `npx tsc --noEmit`; `npm run check:colors`; targeted Biome |
| Estimated runtime | Target under 30 seconds for owning task filters; unmeasured during planning |

## Sampling Rate

- After each implementation task: run its owning behavioral tests; typecheck changed contracts.
- After each wave: run relevant Orrery/data regression filters and rendering color checks.
- Before verify-work: run the full suite and required static checks; record existing unrelated failures separately.
- Native rendering, recognition, accessibility and physical-phone performance require their own evidence. Passing Node tests cannot substitute for these checks.

## Per-Task Verification Map

Final map: 12 plans, 12 waves, 28 tasks. Threat IDs below reference the owning plan's complete STRIDE register (ASVS1, high/critical blocking). All checks remain Pending execution. Test-file guards prevent a missing new suite from passing through an incidental existing filename filter.

| Task | Wave | Requirements | Threat refs | Automated command | Status |
|---|---|---|---|---|---|
| 29-01-01 | 1 | ORRC-01, ORRC-02, ORRC-07 | T-29-01-01, T-29-01-02 | `test -f src/services/orrery-scene.test.ts && npm test -- src/services/orrery-scene.test.ts` | Pending |
| 29-01-02 | 1 | ORRC-01, ORRC-02, ORRC-07 | T-29-01-01, T-29-01-02 | `test -f src/logic/orrery-geometry-logic.test.ts && npm test -- orrery-geometry orrery-ring sun-occupant orrery-scene` | Pending |
| 29-02-01 | 2 | ORRC-05, ORRC-13 | T-29-02-01, T-29-02-02 | `test -f src/db/orrery-preferences.test.ts && npm test -- src/db/orrery-preferences.test.ts` | Pending |
| 29-02-02 | 2 | ORRC-05, ORRC-13 | T-29-02-01, T-29-02-02 | `test -f src/stores/orrery-preferences-store.test.ts && npm test -- orrery-preferences` | Pending |
| 29-02-03 | 2 | ORRC-05, ORRC-13 | T-29-02-01, T-29-02-02 | `test -f src/backup/orrery-preferences-portability.test.ts && npm test -- src/backup/orrery-preferences-portability.test.ts` | Pending |
| 29-03-01 | 3 | ORRC-11, ORRC-12, ORRC-15 | T-29-03-01, T-29-03-02 | `test -f src/db/orrery-system-read.test.ts && npm test -- orrery-system-read orrery-read` | Pending |
| 29-03-02 | 3 | ORRC-11, ORRC-12, ORRC-15 | T-29-03-01, T-29-03-02 | `test -f src/stores/orrery-system-store.test.ts && npm test -- src/stores/orrery-system-store.test.ts` | Pending |
| 29-03-03 | 3 | ORRC-11, ORRC-12, ORRC-15 | T-29-03-01, T-29-03-02 | `test -f src/components/orrery/orrery-controls-logic.test.ts && npm test -- orrery-controls-logic orrery-system-store orrery-system-read` | Pending |
| 29-04-01 | 4 | ORRC-02, ORRC-03, ORRC-04, ORRC-05, ORRC-06 | T-29-04-01, T-29-04-02 | `test -f src/logic/orrery-world-logic.test.ts && npm test -- orrery-world-logic orrery-scene impact` | Pending |
| 29-04-02 | 4 | ORRC-02, ORRC-03, ORRC-04, ORRC-05, ORRC-06 | T-29-04-01, T-29-04-02 | `test -f src/logic/orrery-camera-logic.test.ts && npm test -- orrery-camera-logic orrery-world-logic orrery-scene` | Pending |
| 29-05-01 | 5 | ORRC-03, ORRC-06, ORRC-07 | T-29-05-01, T-29-05-02 | `test -f src/logic/orrery-frame.test.ts && npm test -- src/logic/orrery-frame.test.ts src/services/orrery-scene.test.ts` | Pending |
| 29-05-02 | 5 | ORRC-03, ORRC-06, ORRC-07 | T-29-05-01, T-29-05-02 | `test -f src/logic/orrery-label-logic.test.ts && npm test -- orrery-label-logic orrery-frame` | Pending |
| 29-06-01 | 6 | ORRC-04, ORRC-09, ORRC-13, ORRC-15 | T-29-06-01, T-29-06-02 | `test -f src/components/orrery/orrery-obstacle-logic.test.ts && npm test -- src/components/orrery/orrery-obstacle-logic.test.ts` | Pending |
| 29-06-02 | 6 | ORRC-04, ORRC-09, ORRC-13, ORRC-15 | T-29-06-01, T-29-06-02 | `test -f src/components/orrery/orrery-obstacle-logic.test.ts && npm test -- orrery-obstacle-logic orrery-controls-logic` | Pending |
| 29-07-01 | 7 | ORRC-02, ORRC-09, ORRC-10, ORRC-16 | T-29-07-01, T-29-07-02 | `test -f src/logic/orrery-gesture-logic.test.ts && npm test -- orrery-gesture-logic orrery-camera-logic orrery-frame` | Pending |
| 29-07-02 | 7 | ORRC-02, ORRC-09, ORRC-10, ORRC-16 | T-29-07-01, T-29-07-02 | `test -f src/logic/orrery-recovery-logic.test.ts && npm test -- orrery-recovery-logic orrery-gesture-logic` | Pending |
| 29-08-01 | 8 | ORRC-06, ORRC-07, ORRC-15 | T-29-08-01, T-29-08-02 | `test -f src/logic/orrery-focus-logic.test.ts && npm test -- src/logic/orrery-focus-logic.test.ts` | Pending |
| 29-08-02 | 8 | ORRC-06, ORRC-07, ORRC-15 | T-29-08-01, T-29-08-02 | `test -f src/components/orrery/orrery-overlay-logic.test.ts && npm test -- src/components/orrery/orrery-overlay-logic.test.ts src/logic/orrery-focus-logic.test.ts` | Pending |
| 29-08-03 | 8 | ORRC-06, ORRC-07, ORRC-15 | T-29-08-01, T-29-08-02 | `test -f src/components/orrery/orrery-companion-logic.test.ts && npm test -- src/components/orrery/orrery-companion-logic.test.ts` | Pending |
| 29-09-01 | 9 | ORRC-10 | T-29-09-01, T-29-09-02 | `test -f src/logic/ring-reorder-logic.test.ts && test -f src/db/ring-seq-dao.test.ts && test -f src/db/orrery-system-read.test.ts && npm test -- src/logic/ring-reorder-logic.test.ts src/db/ring-seq-dao.test.ts src/db/orrery-system-read.test.ts` | Pending |
| 29-09-02 | 9 | ORRC-10 | T-29-09-01, T-29-09-02 | `test -f src/logic/orrery-reorder-logic.test.ts && npm test -- src/logic/orrery-reorder-logic.test.ts src/logic/orrery-gesture-logic.test.ts src/db/ring-seq-dao.test.ts` | Pending |
| 29-10-01 | 10 | ORRC-14, ORRC-15 | T-29-10-01, T-29-10-02 | `test -f src/db/orrery-satellites-read.test.ts && npm test -- src/db/orrery-satellites-read.test.ts` | Pending |
| 29-10-02 | 10 | ORRC-14, ORRC-15 | T-29-10-01, T-29-10-02 | `test -f src/logic/orrery-satellite-logic.test.ts && npm test -- src/logic/orrery-satellite-logic.test.ts src/db/orrery-satellites-read.test.ts` | Pending |
| 29-11-01 | 11 | ORRC-08, ORRC-11, ORRC-13, ORRC-16 | T-29-11-01, T-29-11-02 | `test -f src/logic/orrery-session-logic.test.ts && npm test -- src/logic/orrery-session-logic.test.ts` | Pending |
| 29-11-02 | 11 | ORRC-08, ORRC-11, ORRC-13, ORRC-16 | T-29-11-01, T-29-11-02 | `test -f src/theme/use-reduced-motion.test.ts && test -f src/logic/orrery-session-logic.test.ts && npm test -- src/theme/use-reduced-motion.test.ts src/logic/orrery-session-logic.test.ts src/logic/orrery-recovery-logic.test.ts` | Pending |
| 29-11-03 | 11 | ORRC-08, ORRC-11, ORRC-13, ORRC-16 | T-29-11-01, T-29-11-02 | `test -f src/components/orrery/orrery-feedback-logic.test.ts && npm test -- src/components/orrery/orrery-feedback-logic.test.ts src/stores/orrery-system-store.test.ts src/stores/orrery-preferences-store.test.ts src/logic/orrery-frame.test.ts` | Pending |
| 29-12-01 | 12 | ORRC-01, ORRC-02, ORRC-03, ORRC-04, ORRC-05, ORRC-06, ORRC-07, ORRC-08, ORRC-09, ORRC-10, ORRC-11, ORRC-12, ORRC-13, ORRC-14, ORRC-15, ORRC-16 | T-29-12-01, T-29-12-02 | `test -f src/services/orrery-exploration.integration.test.ts && test -f src/services/orrery-scene.test.ts && npm test -- src/services/orrery-exploration.integration.test.ts src/services/orrery-scene.test.ts` | Pending |
| 29-12-02 | 12 | ORRC-01, ORRC-02, ORRC-03, ORRC-04, ORRC-05, ORRC-06, ORRC-07, ORRC-08, ORRC-09, ORRC-10, ORRC-11, ORRC-12, ORRC-13, ORRC-14, ORRC-15, ORRC-16 | T-29-12-01, T-29-12-02 | `npm test -- src/services/orrery-exploration.integration.test.ts` | Pending |

## Wave 0 Requirements

No new framework or package is required. Add tests with their owning implementation tasks before consumers depend on the new behavior; do not create empty test stubs solely to satisfy the map.

- World and project/inverse round trips, minimum spacing, neutral progress, deterministic nudges, depth bounds and Home framing.
- Current projected hit candidates at intermediate animation fractions, semantic labels and input ownership/cancellation.
- Real-SQL System membership matrix and read/write core parity; qualifying sun exactly once; global nonmember sun focus/Profile/ambiguity with Favorites/category exclusion while companion stays exact.
- Filtered reorder revalidates the identified System's contacted visible membership, complete order, saved sun and ID/UID fingerprints under one write lock. Cover favorite/category/Charger/snooze/cadence/recency changes with unchanged full order/sun; queued-before-lock mutation; local midnight Snoozed/Needs Attention changes with unchanged dataRevision; reused numeric ID with changed UID; no writes/revision bump on rejection and hidden-slot preservation on success.
- Preference migration from current head and full chain, failed read/write behavior, optional portable keys and unchanged current export.
- Session/departure reason, A→B→A out-of-order reads, same-System refresh versus switch failure, satellite invalidation.
- Live Reduced Motion event before async seed, inactivity cleanup and cancellation during camera recovery.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Billboard/depth/ring agreement | ORRC-02, ORRC-03 | Native Skia rendering | Tilt/yaw through legal range; compare bodies, rings and touch targets during motion; nearer bodies may occlude sun |
| Gesture arbitration | ORRC-02, ORRC-10 | Native gesture recognition | Pan before hold; hold stationary to feedback; drag after activation; second-pointer/cancel/background leaves saved ranks intact; a filtered-membership change before release rejects with committed layout restored and Reload System |
| Focus/cluster/Profile return | ORRC-07, ORRC-08, ORRC-09 | Navigation and native overlays | Focus distant contact, open Profile, Back; ambiguous targets open nonmodal cluster; Recenter resets all axes, Polaris yaw only; excluded global sun retains focus/Profile/Back and mixed-group access without companion insertion |
| UI state contract | ORRC-04 through ORRC-15 | Approved E1–E9 treatments | Cover all 55 UI-SPEC considerations including sun-only, same-System stale data, switch/read/save failures, missing category and removed focus |
| Accessible companion and scaled text | ORRC-15 | TalkBack/focus/layout | Same members once including sun; full wrapping names, separate Focus/Open Profile, parent satellite context, trigger focus restoration |
| Live Reduced Motion and inactivity | ORRC-16 | Native timing/lifecycle | Toggle while inertia/recenter runs; ambient motion stops, manual control stays; blur/background unmounts clock subtree |
| Phone calibration | ORRC-02, ORRC-03, ORRC-04, ORRC-10 | Hardware-dependent feel and rendering | Confirm app package/Metro session with owner before first device use; discover target/serial; make performance claims only on physical phone |

Density/neighbor tuning and large-System performance remain assigned to release hardening. No performance, device, test-pass or owner sign-off is claimed here.

## Validation Sign-Off

- [x] Final task IDs/waves/threat references mapped after planning
- [x] All tasks have automated verification and separate native human-check obligations
- [x] No three consecutive implementation tasks lack automated feedback
- [x] Missing tests are created by their owning task before dependent verification
- [x] No watch-mode commands
- [ ] Feedback latency measured during execution
- [x] `nyquist_compliant: true` records final plan sampling coverage only

**Approval:** Design sampling checked; independent plan verification passed 2026-09-07 (see 29-PLAN-CHECK.md). Implementation and device verification pending. COVERAGE.md maps all 37 probe edges, 55 UI considerations, 16 requirements and D-01 through D-10.
