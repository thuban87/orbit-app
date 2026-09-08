---
status: partial
phase: 29-orrery-camera-scale-exploration
source: [29-VERIFICATION.md, 29-NATIVE-CHECKLIST.md]
started: 2026-09-07T19:01:28.901180+00:00
updated: 2026-09-08T01:45:00+00:00
---

## Current Test

[testing complete — 8 passed, 1 blocked (H6, backup contention → deferred Phase 40)]

## Tests

Nine grouped checks covering the E1–E9 states, N01–N12 workflows and the backup
contention section of [29-NATIVE-CHECKLIST.md](29-NATIVE-CHECKLIST.md). Executed
on the **physical Pixel 6 Pro, release build** (commit `f979263`). Static/observable
states were pre-verified via on-device evidence (screenshots + UI tree); the owner
ran the gesture / haptic / TalkBack / motion / perf layer.

### 1. H1 — World presentation, depth and identity: E1-1..E1-8, E7-1..E7-4, N02, N03
expected: Readable bounded billboards, current-frame hits, complete Unicode identity, neutral never-contacted treatment and reachable focus across empty through large scenes.
result: pass

### 2. H2 — Systems and options: E2-1..E2-8, E3-1..E3-5, N10, N12
expected: Empty choices remain usable; loading, failed reads/saves and retries preserve truthful membership and durable intent; excluded global sun retains actions without joining the companion or gaining moons.
result: pass

### 3. H3 — Companion, clusters and accessibility: E5-1..E5-8, E6-1..E6-8, N03, N04
expected: Full names, complete membership, explicit Focus/Profile actions, complete ambiguous groups, accessible modal isolation and focus restoration; all controls remain reachable at large text sizes.
result: pass

### 4. H4 — Camera, north and controls: E4-1..E4-4, E8-1..E8-6, N01, N06
expected: Pan/pinch/tilt/yaw recognize deliberately; Recenter restores all axes, north changes yaw only, interruption wins, and controls avoid actual shell bounds.
result: pass
note: Initially force-closed on any two-finger gesture (pinch/tilt) — see Gap G-29-crash-camera, resolved in f979263. Passed on re-test; camera smooth on release (debug jank was dev-mode overhead only).

### 5. H5 — Reorder and lifecycle: N05, N07, N08, N11
expected: Stationary prolonged hold visibly and haptically activates; preactivation movement pans; all cancellation paths avoid writes; Profile Back restores memory-only context; fresh visits start Home; background/blur and live Reduced Motion stop prohibited motion.
result: pass
note: Initially force-closed the instant long-press armed the reorder — see Gap G-29-crash-reorder, resolved in f979263. Passed on re-test.

### 6. H6 — Feedback and contention: E9-1..E9-4, N12, and the complete 'Tap a contact during automatic backup' checklist section
expected: Named recovery remains reachable, duplicate retries are suppressed, and genuinely overlapping backup/scene/Quick Log work preserves actions and cancellation without bypassing the FIFO snapshot lock.
result: blocked
blocked_by: third-party
reason: "Automatic backup could not be exercised — the backup folder SAF grant needs reconnecting (Choose folder), so overlap with an interaction could not be forced by hand. Per 29-NATIVE-CHECKLIST, ordinary navigation does not prove snapshot overlap; measured contention is deferred to Phase 40."

### 7. H7 — Relationship satellites: N09, N10, E7-1..E7-4
expected: Off/overview hides moons; eligible inspected parents reveal readable relationship context; linking/hiding/deletion/parent exclusion removes it; parent actions remain separate.
result: pass

### 8. P1 — Plan 29-12 judgment prohibition: Gravity and neutral contacts
expected: Inspect world, focused context, companion and TalkBack: Gravity describes relationship interaction rather than human worth, exposes no raw score, and never-contacted people have neutral treatment rather than decay.
result: pass
note: Covered by the H3 TalkBack pass; corroborated by device evidence — companion/focus render Gravity as relationship language ("Stable · thin gravity"), no raw score exposed.

### 9. P2 — Plan 29-12 judgment prohibition: satellite semantics
expected: Inspect N09/N10 with TalkBack: a satellite conveys only relationship context and has no independent contact membership, health, Gravity, logging, Profile or children.
result: pass
note: Covered by the H3 TalkBack pass and the H7 satellite pass.

## Summary

total: 9
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

- gap_id: G-29-crash-camera
  truth: "Two-finger camera gestures (pinch/zoom, tilt) manipulate the camera without crashing"
  status: resolved
  reason: "User reported: app force-closes on any two-finger gesture on the Orrery. Release-build Hermes crash: TypeError: undefined is not a function at anchorCameraPose -> unprojectToWorldPlane."
  severity: blocker
  test: 4
  root_cause: "Reanimated worklet transform breaks function hoisting on-device: `anchorCameraPose` (worklet) called `unprojectToWorldPlane`, defined LATER in the same module, so it was captured as `undefined` on the UI thread. Node/vitest keeps normal hoisting, so the 2595-test suite never caught it. Same latent defect in frameBodies and tryUnprojectToWorldPlane."
  artifacts:
    - path: "src/logic/orrery-camera-logic.ts"
      issue: "worklet callees (projectWorldPoint, unprojectToWorldPlane) defined below their worklet callers"
  missing:
    - "Move projectWorldPoint + unprojectToWorldPlane above anchorCameraPose/frameBodies/tryUnprojectToWorldPlane"
  resolved_by: f979263
  resolved_at: 2026-09-08

- gap_id: G-29-crash-reorder
  truth: "Long-press-hold on a contact bubble arms reorder (visible + haptic) without crashing"
  status: resolved
  reason: "User reported: long-pressing a contact bubble crashes the app. Release-build Hermes crash: TypeError: undefined is not a function at computeRingReorder -> clampIndex."
  severity: blocker
  test: 5
  root_cause: "Same worklet forward-reference class: `computeRingReorder` (worklet) called `clampIndex`, defined LATER in ring-reorder-logic.ts, captured as `undefined` on the UI thread."
  artifacts:
    - path: "src/logic/ring-reorder-logic.ts"
      issue: "clampIndex worklet defined below its caller computeRingReorder"
  missing:
    - "Move clampIndex above computeRingReorder"
  resolved_by: f979263
  resolved_at: 2026-09-08

## Notes

- **Whole crash class eliminated.** A scan of all 13 orrery worklet files confirms
  zero remaining same-file worklet forward-references after f979263. This class is
  invisible to the vitest suite (Node keeps normal function hoisting), so a
  build/CI guard replaying that scan is recommended to prevent regression.
- **H6 is genuinely blocked, not failed** — backup contention needs the SAF folder
  grant reconnected and is a timing-sensitive overlap the checklist marks as
  deferred to Phase 40.
- Gesture animation "jank" observed on the debug build was dev-mode overhead only;
  release is smooth (owner-confirmed on the physical Pixel).
