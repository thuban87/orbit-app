---
phase: 29
slug: orrery-camera-scale-exploration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-06
---

# Phase 29 — Validation Strategy

Per-phase validation contract for execution. Research and planning are not implementation evidence. The planner must replace the provisional slice map below with its final task IDs and dependency order before plan verification.

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

Provisional slices; final planner updates task IDs, wave assignments, threats and exact commands.

| Slice | Requirements | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|---|---|
| Explicit System snapshot | ORRC-11, ORRC-12, ORRC-15 | Pending plan IDs | Bound/archive/default never-contacted boundaries; bound identifiers; coherent sun membership | SQL/unit | `npm test -- orrery-system orrery-read` | New tests required | Pending |
| Durable preferences | ORRC-05, ORRC-13 | Pending plan IDs | Closed values, serialized writes, additive migration, portable allowlist without premature emission | SQL/unit | `npm test -- orrery-preferences app-settings full-chain` | New tests required | Pending |
| World/projection | ORRC-01, ORRC-02, ORRC-03, ORRC-04, ORRC-06 | Pending plan IDs | Finite bounded math, null neutral progress, deterministic identity/layout | Unit | `npm test -- orrery-world orrery-camera orrery-label` | New tests required | Pending |
| Camera/hit/gesture | ORRC-02, ORRC-07, ORRC-09, ORRC-10 | Pending plan IDs | Current-frame hits; cancellation does not write or navigate | Unit | `npm test -- orrery-camera orrery-hit orrery-gesture` | New tests required | Pending |
| Guarded reorder | ORRC-10 | Pending plan IDs | Complete contacted permutation, current-sun/order validation, atomic rollback, no recency writes | SQL/unit | `npm test -- ring-seq ring-reorder` | Existing plus new tests | Pending |
| Satellite context | ORRC-14, ORRC-15 | Pending plan IDs | Live eligible relationships only, no satellite contact actions | SQL/unit | `npm test -- orrery-satellite relationships` | Existing plus new tests | Pending |
| Session/error/motion | ORRC-08, ORRC-11, ORRC-13, ORRC-16 | Pending plan IDs | Generation guards, disposal, no durable camera, live reduced-motion cancellation | Unit | `npm test -- orrery-session orrery-preferences use-reduced-motion` | Existing plus new tests | Pending |

## Wave 0 Requirements

No new framework or package is required. Add tests with their owning implementation tasks before consumers depend on the new behavior; do not create empty test stubs solely to satisfy the map.

- World and project/inverse round trips, minimum spacing, neutral progress, deterministic nudges, depth bounds and Home framing.
- Current projected hit candidates at intermediate animation fractions, semantic labels and input ownership/cancellation.
- Real-SQL System membership matrix, qualifying sun exactly once, and filtered reorder full-population rollback/stale-sun cases.
- Preference migration from current head and full chain, failed read/write behavior, optional portable keys and unchanged current export.
- Session/departure reason, A→B→A out-of-order reads, same-System refresh versus switch failure, satellite invalidation.
- Live Reduced Motion event before async seed, inactivity cleanup and cancellation during camera recovery.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Billboard/depth/ring agreement | ORRC-02, ORRC-03 | Native Skia rendering | Tilt/yaw through legal range; compare bodies, rings and touch targets during motion; nearer bodies may occlude sun |
| Gesture arbitration | ORRC-02, ORRC-10 | Native gesture recognition | Pan before hold; hold stationary to feedback; drag after activation; second-pointer/cancel/background leaves saved ranks intact |
| Focus/cluster/Profile return | ORRC-07, ORRC-08, ORRC-09 | Navigation and native overlays | Focus distant contact, open Profile, Back; ambiguous targets open nonmodal cluster; Recenter resets all axes, Polaris yaw only |
| UI state contract | ORRC-04 through ORRC-15 | Approved E1–E9 treatments | Cover all 55 UI-SPEC considerations including sun-only, same-System stale data, switch/read/save failures, missing category and removed focus |
| Accessible companion and scaled text | ORRC-15 | TalkBack/focus/layout | Same members once including sun; full wrapping names, separate Focus/Open Profile, parent satellite context, trigger focus restoration |
| Live Reduced Motion and inactivity | ORRC-16 | Native timing/lifecycle | Toggle while inertia/recenter runs; ambient motion stops, manual control stays; blur/background unmounts clock subtree |
| Phone calibration | ORRC-02, ORRC-03, ORRC-04, ORRC-10 | Hardware-dependent feel and rendering | Confirm app package/Metro session with owner before first device use; discover target/serial; make performance claims only on physical phone |

Density/neighbor tuning and large-System performance remain assigned to release hardening. No performance, device, test-pass or owner sign-off is claimed here.

## Validation Sign-Off

- [ ] Final task IDs/waves/threat references mapped after planning
- [ ] All tasks have automated verification or explicit manual-only rationale
- [ ] No three consecutive implementation tasks lack automated feedback
- [ ] Missing tests are created by their owning task before dependent verification
- [ ] No watch-mode commands
- [ ] Feedback latency measured during execution
- [ ] `nyquist_compliant: true` set only after validating the final plan's sampling coverage

**Approval:** Pending plan validation; implementation and device verification pending.
