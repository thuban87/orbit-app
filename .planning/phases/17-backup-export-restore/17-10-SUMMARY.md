---
phase: 17-backup-export-restore
plan: 10
subsystem: restore-ui
tags: [react-native, expo-document-picker, restore, reconciliation, privacy]
requires:
  - phase: 17-08
    provides: validated restore candidates and transactional Merge/Replace apply
  - phase: 17-09
    provides: Backup landing and configured automatic-backup destination
provides:
  - validated picker-to-preview flow with opaque in-memory restore tokens
  - destructive Replace confirmation, single-flight apply, and aggregate result route
affects: [17-11 device-uat, backup-restore]
actuals:
  tokens: 10965
  tasks: 2
  commits: 6
tech-stack:
  added: []
  patterns:
    - serializable aggregate route data backed by a process-local validated manifest cache
    - React-local single-flight restore apply state that never survives a cold launch
key-files:
  created:
    - src/screens/RestorePreviewScreen.tsx
    - src/screens/RestoreResultScreen.tsx
    - src/screens/backup-restore-logic.ts
  modified:
    - src/screens/BackupScreen.tsx
    - src/services/backup/backup-service.ts
    - src/navigation/types.ts
    - src/navigation/RootNavigator.tsx
key-decisions:
  - "Restore navigation receives only an opaque token and aggregate preview; content, path, and passphrase never enter route params."
  - "Applying remains React-local and is neither resumed nor re-shown after Android process death."
patterns-established:
  - "Re-check a process-local cache synchronously before rendering a route restored by native navigation."
  - "Create the configured Replace safety snapshot through the restore engine's injected preflight dependency."
requirements-completed: [BKP-04]
coverage:
  - id: D1
    description: Validated aggregate preview cache, encrypted prompt, and pre-preview failure recovery
    requirement: BKP-04
    verification:
      - kind: unit
        ref: src/screens/backup-restore-logic.test.ts
        status: pass
      - kind: integration
        ref: src/services/backup/backup-service.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Restore preview, destructive confirmation, applying treatment, and aggregate result UI
    requirement: BKP-04
    verification:
      - kind: unit
        ref: src/screens/backup-restore-logic.test.ts
        status: pass
      - kind: manual_procedural
        ref: 17-11 device UAT
        status: unknown
    human_judgment: true
    rationale: Android picker, passphrase field, native Alert, navigation, and applying presentation require device verification.
duration: 10min
completed: 2026-08-26
status: complete
---

# Phase 17 Plan 10: Restore UI Summary

**Validated picker-to-preview restore flow with opaque cache tokens, guarded Merge/Replace apply, and privacy-preserving aggregate outcomes**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-26T02:44:00Z
- **Completed:** 2026-08-26T02:54:48Z
- **Tasks:** 2/2
- **Files modified:** 8

## Accomplishments

- Added a single-file Android picker path that reads from its cache copy, detects encrypted envelopes only to request a passphrase, and invokes the validated restore service before navigation.
- Added a process-local validated-manifest cache. The serializable route contains only token and aggregate preview data; missing tokens synchronously render a quiet re-selection state.
- Added Merge-by-default preview, destructive Replace confirmation, a navigation-blocking single-flight apply state, engine-provided verified pre-restore snapshots, and static aggregate result routing.
- Kept every pre-commit failure calm and explicit that local data has not changed; no screen lists paths, passphrases, names, or per-record outcomes.

## Task Commits

1. **Task 1: Drive one validated plaintext backup from picker to Merge preview** — `56c8c0a` (RED), `2668347` (GREEN), `7cb0d68` (typed fixture)
2. **Task 2: Confirm Replace-all, apply once, and present aggregate restore result** — `ea7b477` (RED), `d5c544a` (GREEN), `602871e` (aggregate fixture)

## Files Created/Modified

- `src/screens/BackupScreen.tsx` — cached document selection, encrypted passphrase prompt, validation progress, and safe recovery notices.
- `src/screens/RestorePreviewScreen.tsx` — metadata-only preview, Merge/Replace modes, native confirmation, and apply progress.
- `src/screens/RestoreResultScreen.tsx` — committed aggregate result and sole return action.
- `src/screens/backup-restore-logic.ts` — cache, recovery-copy, mode, confirmation, single-flight, and result helpers.
- `src/services/backup/backup-service.ts` — validated private restore candidate with aggregate preview counts while retaining the aggregate-only public preview API.

## Decisions Made

- Restore route parameters contain no content URI, path, callback, manifest, or passphrase; only the validated in-memory cache can supply apply input.
- A missing cache entry never renders route aggregates first. It is treated as process-death expiry and returns the user to fresh selection.
- An interrupted applying state is intentionally not durable. The engine's transaction remains the only commit boundary, while cold launch returns to normal Backup health/data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevented a first-render stale preview for expired route tokens**

- **Found during:** Task 2
- **Issue:** Checking the in-memory token only in an effect could briefly render serializable aggregate preview data before the expiry state was set.
- **Fix:** Initialized expiry from the cache synchronously before the first screen render, then retained the mount-time check for navigation changes.
- **Files modified:** `src/screens/RestorePreviewScreen.tsx`
- **Verification:** `npm test -- src/screens/backup-restore-logic.test.ts`, `npx tsc --noEmit`, and `npm run check:colors`.
- **Committed in:** `d5c544a`

**Total deviations:** 1 auto-fixed (Rule 1 bug)

## Known Stubs

None.

## Next Phase Readiness

Plan 17-11 can exercise the Android picker, encrypted prompt, Replace safety-snapshot disclosure, non-dismissable applying presentation, and final Backup-health refresh on a physical device.

## Self-Check: PASSED

- All restore UI, cache-helper, and test files exist.
- Task commits `56c8c0a`, `2668347`, `7cb0d68`, `ea7b477`, `d5c544a`, and `602871e` exist.
- Focused restore logic and backup-service tests, TypeScript, color, and whitespace checks passed.

---
*Phase: 17-backup-export-restore*
*Completed: 2026-08-26*
