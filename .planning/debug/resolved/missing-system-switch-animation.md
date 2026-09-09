---
status: resolved
trigger: "There is no animation when switching systems like we had discussed and planned for. There was supposed to be a whole spinning thing and speeding up/slowing down and everything."
created: 2026-09-09T02:08:36Z
updated: 2026-09-09T02:36:30Z
---

## Symptoms

- expected: Switching Orrery Systems on a physical Pixel runs the planned membership-delta-scaled spin-up, shedding/capture, and slowdown sequence; Reduced Motion uses only crossfade/reposition.
- actual: With normal Android animation settings, the selector closes, the Orrery shows a loading state, and the destination scene appears settled with no visible switch animation.
- errors: No runtime exception during switching after the empty-catalog crash fix.
- timeline: Discovered during Phase 30 physical-device UAT; there is no evidence that the live animation path ever worked on device.
- reproduction: Open Orrery on the Pixel, choose a different System such as All Contacts or Favorites, and observe the scene replacement.

## Current Focus

hypothesis: A real System switch clears the prior snapshot during loading, causing OrreryScreen to unmount OrreryWorld; the destination OrreryWorld then initializes from an empty world at completed progress, so no live generation transition can run.
test: Complete — automated lifecycle guardrails passed and the requested release-only artifact is ready for the owner's independent visual evaluation.
expecting: The retained outgoing snapshot keeps OrreryWorld mounted so its existing generation effect can spin and shed/capture into the destination.
next_action: Archive this resolved session and commit its scoped code and documentation records without pushing.
bug_class: bohrbug
known_pattern_candidate: none in .planning/debug/knowledge-base.md
reasoning_checkpoint:
  hypothesis: "createOrrerySystemStore clears snapshot on a different-System loading publication; OrreryScreen keys OrreryWorld existence to that snapshot, so the transition owner unmounts before it can receive the destination generation."
  confirming_evidence:
    - "The new specified-contract test fails before the fix with snapshot:null during a pending All Contacts→Favorites load."
    - "OrreryScreen conditionally renders OrreryWorld only when scene=state.snapshot is truthy."
    - "A newly mounted OrreryWorld initializes beginWorldTransition([], destinationWorld, destinationGeneration) and progress=1, then its generation effect returns as already current."
  falsification_test: "If retaining the source snapshot through the pending load still causes OrreryWorld to remount, or a renderer-level test shows the generation effect cannot transition from the retained source to the destination, this hypothesis is false."
  fix_rationale: "Keeping the last ready snapshot only for the duration of an in-flight load preserves the single render-loop owner and supplies its outgoing world; explicitly clearing it on different-System failure preserves the established no-stale-wrong-System error contract."
  blind_spots: "The JS test proves lifecycle continuity but cannot judge the Skia animation's visual feel; the owner will verify the release APK on the Pixel."
  candidate_causes:
    - "code: store loading publication clears the only scene reference, unmounting the transition owner"
    - "config/environment: Android Reduced Motion could suppress spin, but the report reproduces with normal animation settings and cannot explain the loading unmount"
    - "data: identical memberships yield zero intensity, but All Contacts→Favorites has nonzero turnover and the owner also observes no base shed/capture"
  and_gate: "no — the code lifecycle break alone prevents every renderer transition; config and data can modulate a functioning transition but are not required for this failure"
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-09-09T02:14:30Z
  checked: .planning/debug/knowledge-base.md
  found: No semantic/keyword match for a missing live Orrery generation transition.
  implication: Investigate this as a new lifecycle defect.
- timestamp: 2026-09-09T02:14:30Z
  checked: OrreryScreen render branch and orrery-system-store select loading publication
  found: A different-System select publishes snapshot=null, and OrreryScreen renders OrreryWorld only when scene=state.snapshot is truthy.
  implication: Every real switch unmounts the sole transition owner before the destination generation arrives.
- timestamp: 2026-09-09T02:14:30Z
  checked: OrreryWorld transition initialization and generation effect
  found: A fresh destination mount initializes beginWorldTransition([], destinationWorld, destinationGeneration) with progress=1; its effect returns because the initialized transition generation already equals the scene generation.
  implication: The destination mount cannot see outgoing bodies, starts fully settled, and has sin(pi)=0 spin regardless of switchIntensity.
- timestamp: 2026-09-09T02:14:30Z
  checked: Common bug patterns and classification
  found: The symptom matches a deterministic State Management invalid transition/Async initialization-order pattern and reproduces for every different-System selection.
  implication: Classified as a Bohrbug; no coverage spectrum is available because existing tests all pass and omit the pending-switch continuity contract.
- timestamp: 2026-09-09T02:17:15Z
  checked: New focused regression test in orrery-system-store.test.ts
  found: RED as expected; during a pending different-System load the actual snapshot is null instead of the prior All Contacts snapshot.
  implication: The exact lifecycle defect is reproducible without Skia or device timing; oracle type is specified from the planned single-owner outgoing-to-incoming transition contract.
- timestamp: 2026-09-09T02:17:15Z
  checked: git history and blame
  found: The snapshot-clearing behavior originated in the pre-animation System store commit 1d4bbe0; phase commit 3834fd3 added transition coordination without changing that loading lifecycle.
  implication: The animation implementation was composed over an incompatible pre-existing store contract, rather than later regressing from a once-working live path.
- timestamp: 2026-09-09T02:21:00Z
  checked: Minimal production fix plus target and adjacent suites
  found: Retaining before.snapshot during loading and clearing it on a failed real switch makes 41 tests across six store/scene/frame/render suites pass; Biome and TypeScript also pass.
  implication: The fix restores transition-owner continuity without weakening async generation, same-System stale, or failed-switch error behavior.
- timestamp: 2026-09-09T02:26:00Z
  checked: Fix-acceptance revert-and-reconfirm
  found: With only the production hunk reverted, the agent-authored test failed because pending switch snapshot was null; after reapplying the hunk, all 10 store tests passed.
  implication: The production lifecycle change, not an incidental test edit, is necessary and sufficient for the automated reproduction.
- timestamp: 2026-09-09T02:26:00Z
  checked: Full test suite and color/static gates
  found: 2675 tests passed; the only 3 failures are the pre-existing orrery-preferences migration assertions expecting TARGET_VERSION 22 while the working tree is already at 23. Biome, TypeScript, color check, and git diff --check passed.
  implication: No adjacent regression is attributable to this fix; the owner-owned migration-test drift remains outside this debug scope.
- timestamp: 2026-09-09T02:33:34Z
  checked: Release-only Android build on droid via docs/runbooks/desktop-build-pipeline.md
  found: Clean source sync, npm ci, Expo prebuild, embedded Metro bundle, and gradlew assembleRelease completed successfully in 10m12s. Artifact is C:\Users\bwales\projects\orbit-app\android\app\build\outputs\apk\release\app-release.apk, 193548099 bytes, SHA-256 a2e44c3865e2df46c91e34d96aed06a055f58e28cfd8f167725cc3871c4a3e29.
  implication: A standalone release artifact containing the lifecycle fix is ready on droid for the owner's physical Pixel verification; no debug APK was built or installed.
- timestamp: 2026-09-09T02:36:30Z
  checked: Resolution boundary requested by the owner
  found: The owner requested only a release rebuild and will perform the visual evaluation independently; they explicitly asked not to wait for or re-request device testing.
  implication: The debug session closes on the accepted automated guardrail plus successful release artifact, while visual feel remains the owner's post-handoff evaluation.

## Eliminated

- hypothesis: Android Reduced Motion is unexpectedly enabled and suppresses the spin.
  evidence: It cannot explain OrreryWorld unmounting on every different-System loading publication or the missing base shed/capture; the owner reproduced with normal animation settings.
  timestamp: 2026-09-09T02:17:15Z
- hypothesis: The chosen Systems have identical membership, correctly producing zero switch intensity.
  evidence: All Contacts→Favorites has membership turnover, and a zero intensity should still leave the base 260ms entering/leaving transition; both are absent after the remount.
  timestamp: 2026-09-09T02:17:15Z

## Resolution

root_cause: "The System store publishes snapshot=null while a different System loads, which unmounts OrreryWorld—the sole owner of the outgoing world and transition shared values—so the destination remount begins already settled and cannot run shedding, capture, or spin."
fix: "Retain the last ready snapshot while any System load is pending so OrreryWorld remains mounted; on a generic different-System load failure, explicitly clear that retained snapshot and publish error."
verification:
  target_test: { result: pass }
  mutation_check: { result: skipped, reason_if_skipped: "No Stryker dependency or configuration exists; revert-and-reconfirm directly killed the snapshot=null mutant at the fix site.", mutant_killed: null }
  no_op_deletion: { result: pass, deletion_justified_by_rca: false }
  adjacent_tests: { result: pass, suites_run: ["orrery-system-store", "orrery-switch-animation", "orrery-render", "orrery-worklet-boundary", "orrery-frame", "orrery-scene", "Biome", "TypeScript", "check:colors"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  full_suite: { result: pre_existing_failure, passed: 2675, failed: 3, reason: "orrery-preferences tests assert TARGET_VERSION 22 while current workspace target is 23" }
  guardrail_verdict: accepted
oracle_type: specified
files_changed:
  - src/stores/orrery-system-store.ts
  - src/stores/orrery-system-store.test.ts

## Prevention

- code branch: The pre-existing System store treated a different-System loading state as having no displayable snapshot. Phase 30 later composed a single-owner transition over that state contract, but no test asserted that the owner survived from source publication through destination publication.
- environment/data branch: Reduced Motion and membership overlap legitimately modulate the effect and could resemble a weak transition, but neither can restore an owner that React unmounted. The deterministic lifecycle test therefore isolates continuity independently of device settings and member sets.
- why_not_caught: Pure transition math, renderer wiring, type checking, and code review all passed because no integration gate covered the store's pending-switch snapshot together with OrreryScreen's conditional OrreryWorld mount.
- recurrence_guard: The regression test `keeps the prior world mounted while a different System loads, then clears it if the switch fails` in `src/stores/orrery-system-store.test.ts` now locks both transition-owner continuity and failed-switch cleanup; revert-and-reconfirm proved it fails against the former behavior.
