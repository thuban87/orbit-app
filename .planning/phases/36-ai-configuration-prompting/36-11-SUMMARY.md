---
phase: 36-ai-configuration-prompting
plan: 11
subsystem: auth
tags: [openrouter, oauth, pkce, android, expo-module, localhost]

requires:
  - phase: 36-02
    provides: AI connection persistence and activate-on-success ordering
  - phase: 36-05
    provides: OpenRouter provider and model-catalog integration
provides:
  - One-shot Android loopback OAuth callback listener bound to 127.0.0.1
  - PKCE and state-validated OpenRouter authorization without a backend or manual code entry
  - Physical Pixel evidence closing the final two Phase 36 UAT checks
affects: [ai-configuration, openrouter, android-native-modules]

actuals:
  tokens: 13368
  tasks: 3
  commits: 6

tech-stack:
  added: [local Expo Android module, JVM socket tests]
  patterns: [one-attempt loopback callback owner, credential-free custom-scheme wake, fail-closed callback validation]

key-files:
  created:
    - modules/orbit-openrouter-loopback/android/src/main/java/expo/modules/orbitopenrouterloopback/OrbitOpenRouterLoopbackModule.kt
    - modules/orbit-openrouter-loopback/android/src/test/java/expo/modules/orbitopenrouterloopback/OrbitOpenRouterLoopbackModuleTest.kt
    - modules/orbit-openrouter-loopback/expo-module.config.json
    - modules/orbit-openrouter-loopback/index.ts
  modified:
    - src/ai/openrouter-oauth.ts
    - src/ai/openrouter-oauth.test.ts
    - app.config.ts
    - .planning/phases/36-ai-configuration-prompting/36-UAT.md

key-decisions:
  - "Implemented the owner-approved on-device localhost callback; OpenRouter never receives the unsupported orbit:// callback."
  - "Retained orbit://openrouter-auth only as a credential-free foreground wake after native callback acceptance."

patterns-established:
  - "Loopback OAuth attempts bind 127.0.0.1 on an OS-assigned port and expose only an opaque attempt identifier to JavaScript."
  - "Native and TypeScript layers both validate callback destination and state before a one-time code exchange."

requirements-completed: [AICFG-03, AICFG-04]

coverage:
  - id: D1
    description: OpenRouter authorization completes through a temporary on-device localhost callback with PKCE and exact state validation.
    requirement: AICFG-04
    verification:
      - kind: unit
        ref: "src/ai/openrouter-oauth.test.ts (18 focused tests)"
        status: pass
      - kind: integration
        ref: ":orbit-openrouter-loopback:testDebugUnitTest (6 JVM real-socket tests)"
        status: pass
      - kind: manual_procedural
        ref: "36-UAT.md test 1 on Pixel 6 Pro"
        status: pass
    human_judgment: true
    rationale: Real provider authorization and Chrome-to-app foregrounding required physical-device observation; that check passed.
  - id: D2
    description: Failed or stale attempts cannot activate OpenRouter, while successful key persistence and model selection can.
    requirement: AICFG-03
    verification:
      - kind: unit
        ref: "src/ai/openrouter-oauth.test.ts (failure lifecycle and persistence ordering)"
        status: pass
      - kind: manual_procedural
        ref: "36-UAT.md test 3 on Pixel 6 Pro"
        status: pass
    human_judgment: true
    rationale: Provider-lane activation ordering was confirmed in the physical app; that check passed.

duration: 34min
completed: 2026-09-14
status: complete
---

# Phase 36 Plan 11: OpenRouter Localhost OAuth Summary

**OpenRouter now authorizes through a one-shot, loopback-only Android listener while preserving PKCE, exact state checks, SecureStore-only key persistence, and post-persistence activation ordering.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-09-14T18:09:42Z
- **Completed:** 2026-09-14T18:43:42Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Replaced the rejected live custom-scheme provider callback with an owner-approved `127.0.0.1` callback on a dynamic port, without adding a backend or dependency.
- Added bounded HTTP parsing, exact Host/path/query validation, double state checking, one-attempt ownership, timeout/cancel/destroy cleanup, and credential-free app wake behavior.
- Passed 18 focused TypeScript tests, 6 real-socket JVM tests, a clean Android prebuild/debug build, and the two formerly blocked OpenRouter checks on a physical Pixel 6 Pro.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Define the loopback OAuth contract** - `a43f43c` (test)
2. **Task 1 GREEN: Route OpenRouter OAuth through loopback** - `3257e2a` (feat)
3. **Task 2 RED: Cover loopback failure lifecycle** - `2e8c754` (test)
4. **Task 2 GREEN: Close loopback OAuth failure paths** - `1eba27e` (fix)
5. **Task 3: Correct JVM callback-order assertion** - `9ac1a2f` (test)
6. **Task 3: Close physical-device OpenRouter UAT** - `79eaf41` (test)

## Files Created/Modified

- `modules/orbit-openrouter-loopback/` - Typed local Expo module, Android implementation, manifest/configuration, web failure surface, and real-socket JVM tests.
- `src/ai/openrouter-oauth.ts` - Dynamic localhost callback orchestration, credential-free wake validation, independent callback validation, exchange, persistence, and cleanup.
- `src/ai/openrouter-oauth.test.ts` - Focused success, parser, lifecycle, abort, failure, and key-persistence contract coverage.
- `app.config.ts` - Documents that the retained custom-scheme intent filter is a credential-free wake only.
- `.planning/phases/36-ai-configuration-prompting/36-UAT.md` - Records seven passed checks and zero blocked checks.

## Decisions Made

- Followed the approved localhost replacement exactly. No additional product, risk, or architectural decision was introduced.
- Kept OAuth state and verifier attempt-local and erased JavaScript references during terminal cleanup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the JVM happy-path assertion to match canonical callback reconstruction**

- **Found during:** Task 3 native JVM execution
- **Issue:** The test expected incoming `code,state` query ordering, while the module intentionally reconstructs the independently validated callback in canonical `state,code` order.
- **Fix:** Updated the assertion without weakening validation or changing production behavior.
- **Files modified:** `modules/orbit-openrouter-loopback/android/src/test/java/expo/modules/orbitopenrouterloopback/OrbitOpenRouterLoopbackModuleTest.kt`
- **Verification:** Reran the native JVM suite; 6 tests passed with zero failures/errors.
- **Committed in:** `9ac1a2f`

---

**Total deviations:** 1 auto-fixed (1 Rule 1)
**Impact on plan:** Test-only expectation correction; no scope or runtime behavior changed.

## Issues Encountered

- The first droid source transfer included tracked debug APKs and timed out. Repeating the documented tar-over-SSH transfer with generated APKs excluded delivered the same current source and allowed the clean build to proceed.
- The clean droid build completed successfully in 10m12s across 878 Gradle tasks. The autolinked native module JVM report contained 6 tests, zero failures, and zero errors.

## User Setup Required

None - the existing signed-in OpenRouter account was used for the approved physical-device check, and the app requires no callback server or manual code configuration.

## TDD Gate Compliance

- RED commits: `a43f43c`, `2e8c754`
- GREEN commits: `3257e2a`, `1eba27e`
- Focused TypeScript result: 18 passed
- Native JVM result: 6 passed, 0 failures/errors

## Security and Privacy Evidence

- The native listener bound only to the device loopback interface and closed on success, cancellation, timeout, and module destruction.
- The visible wake URI carried no credentials. Sanitized authorization-window scans found zero callback `code` or `state` parameters in Orbit UI, the Metro pane, or logcat.
- No SecureStore value was dumped and no AI generation request was made.

## Known Stubs

None. Empty-string initializers found by the stub scan are transient test captures, parser guards, or deliberate in-memory secret cleanup; none flow to rendered placeholder UI.

## Next Phase Readiness

Phase 36 now has seven passed UAT checks and zero blocked checks. OpenRouter is a working user-owned connection lane on the physical Android target.

## Self-Check: PASSED

- All 12 created/modified plan files exist.
- All six task commits exist in repository history.
- Focused TypeScript, type-check, JVM, clean debug build, and required physical-device evidence passed.

---
*Phase: 36-ai-configuration-prompting*
*Completed: 2026-09-14*
