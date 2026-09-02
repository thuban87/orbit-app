---
phase: 21-interaction-assist-reach-out
plan: 02
subsystem: interaction-assist-ui
tags: [react-native, zustand, expo-sms, native-handoff, widget-refresh]
requires:
  - phase: 21-interaction-assist-reach-out
    provides: durable assist queue, confirmation writes, and pure reach-route derivation
provides:
  - Shared write-before-launch Call/Text/Email handoff service
  - App-return pending-assist store and app-global confirmation overlay
  - Profile Reach out entry derived from loaded actionable contact methods
affects: [compose-send, endpoint-selector, assist-settings, device-uat]
actuals:
  tokens: 7599.25
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns: [native-launch-as-attestation, appstate-return-refresh, shell-overlay]
key-files:
  created:
    - src/services/reach-out/handoff.ts
    - src/stores/assist-store.ts
    - src/components/ReachOutRouter.tsx
    - src/components/AssistConfirmation.tsx
    - src/components/AssistBanner.tsx
  modified:
    - App.tsx
    - src/screens/ContactProfileScreen.tsx
key-decisions:
  - "Only thrown native-launch errors fail an assist; resolved OS calls never imply delivery or contact."
  - "The profile derives routes from its existing method-groups read, while the assist setting is read defensively from the migration-014 column."
  - "The confirmation surface is an absolute shell overlay so Android Back remains available to navigation."
patterns-established:
  - "All Reach Out callers use performReachOut with a canonical contact-method value."
  - "Foreground confirmation queue reads are separate from the once-per-launch sweep."
requirements-completed: [IAS-01, IAS-02, IAS-03, IAS-04]
coverage:
  - id: D1
    description: Shared native handoff writes a pending assist before launch, retains SMS body text, and marks failures only after a thrown launch.
    requirement: IAS-03
    verification:
      - kind: unit
        ref: npx vitest run src/services/reach-out/handoff.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Durable eligible-assist queue refreshes after real background-to-active returns and exposes its newest named item.
    requirement: IAS-02
    verification:
      - kind: unit
        ref: npx vitest run src/stores/assist-store.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Theme-clean profile Reach out entry, route chooser, and app-global confirmation overlay are wired into the foreground shell.
    requirement: IAS-01
    verification:
      - kind: integration
        ref: npx tsc --noEmit && npm run check:colors
        status: pass
    human_judgment: true
    rationale: Native intent launch, Android Back behavior, and visual layout require device UAT in Plan 06.
duration: 6min
completed: 2026-08-31
status: complete
---

# Phase 21 Plan 02: Reach Out Router and Assist Banner Summary

**Profile-driven Call/Text/Email handoff with durable pending confirmations, a non-modal app-global banner, and widget refresh after logged contact.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-31T22:10:00Z
- **Completed:** 2026-08-31T22:16:26Z
- **Tasks:** 3/3
- **Files modified:** 9

## Accomplishments

- Added the one shared native handoff helper: it creates a pending assist before launch, carries an optional SMS body, and marks failure only when the OS launch throws.
- Added a SQLite-backed Zustand queue that refreshes on every real foreground return, plus a non-modal shell banner for attestation-only Yes, No answer, or Don't log outcomes.
- Mounted the banner after the root navigator and exposed a reachable-only profile "Reach out" entry from the already-loaded primary phone/email methods.

## Task Commits

1. **Task 1: Native handoff service + assist-store** — `8baad37`
2. **Task 2: ReachOutRouter + AssistConfirmation + AssistBanner components** — `16cc323`, `aea3d79`
3. **Task 3: Mount the banner app-globally + profile Reach out entry** — `b260194`

## Files Created/Modified

- `src/services/reach-out/handoff.ts` — shared Call/Text/Email OS-launch ordering and failure handling.
- `src/stores/assist-store.ts` — eligible queue state plus foreground-return AppState subscription.
- `src/components/ReachOutRouter.tsx` — themed channel chooser using canonical method values.
- `src/components/AssistConfirmation.tsx` and `src/components/AssistBanner.tsx` — attestation controls and shell overlay with widget freshness publishing.
- `App.tsx` — ready-gated initial queue refresh, AppState cleanup, and app-global banner mount.
- `src/screens/ContactProfileScreen.tsx` — synchronous reach-route derivation from loaded methods and setting-aware router launch.

## Decisions Made

- A resolved SMS or URL-opening result is treated only as a successfully requested OS handoff, never as delivery or an interaction.
- The banner owns database writes and widget invalidation; the confirmation component remains presentational.
- The profile uses the pure route projection over its existing method groups, avoiding another method query or route-loading state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Applied repository formatting required by the verification gate.**

- **Found during:** Tasks 1 and 3
- **Issue:** New imports and nearby existing long expressions failed Biome's required formatting/import-order checks.
- **Fix:** Ran the repository formatter on the task files.
- **Files modified:** `src/services/reach-out/handoff.ts`, `src/stores/assist-store.ts`, `src/stores/assist-store.test.ts`, `App.tsx`, `src/screens/ContactProfileScreen.tsx`
- **Verification:** Focused Biome checks, TypeScript, and color checks passed.
- **Committed in:** `8baad37`, `b260194`

**2. [Rule 1 - Bug] Removed a structural-check false positive from the banner comment.**

- **Found during:** Task 2 acceptance checks
- **Issue:** The non-modal banner's explanatory comment contained the forbidden structural identifier, causing the plan's grep gate to report a match.
- **Fix:** Reworded the comment without changing runtime behavior.
- **Files modified:** `src/components/AssistBanner.tsx`
- **Verification:** The banner grep now returns no matches; focused Biome passes.
- **Committed in:** `aea3d79`

**Total deviations:** 2 auto-fixed (1 Rule 3, 1 Rule 1).

## Issues Encountered

Vitest emits its existing Vite native-config deprecation warning; the focused suite completed successfully with 6 passing tests.

## User Setup Required

None - native handoff uses permissionless user-initiated OS intents and no external service configuration.

## Next Phase Readiness

Plan 03 can reuse `performReachOut` for Compose Send and add multi-endpoint selection without duplicating assist timing or failure semantics. Device UAT remains required for native apps, Android Back behavior, and visual overlay states.

## Self-Check: PASSED

- All seven shipped source files exist at their recorded paths.
- Commits `8baad37`, `16cc323`, `aea3d79`, and `b260194` exist in git history.
