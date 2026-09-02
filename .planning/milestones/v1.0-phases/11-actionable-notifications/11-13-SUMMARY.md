---
phase: 11-actionable-notifications
plan: 13
subsystem: infra
tags: [expo-notifications, app-shell, launch-sweep, headless-task, react-navigation]

# Dependency graph
requires:
  - phase: 11-06
    provides: ensureChannels (immutable LOW channels — private/public/birthday)
  - phase: 11-07
    provides: ensureNotificationCategories + headless-task (killed-app action write path)
  - phase: 11-10
    provides: registerNotificationScheduleSweep / reconcileSchedule (the reconcile engine)
  - phase: 11-12
    provides: NotificationResponseGate (warm + cold-start tap routing)
provides:
  - "App.tsx integration wiring: the notification engine now runs as part of the launch/ready lifecycle"
  - "Module-scope silent foreground handler (FOREGROUND_NOTIFICATION_BEHAVIOR)"
  - "Awaited channel/category init before the first cold-start reconcile"
  - "NotificationResponseGate mounted in the ready NavigationContainer"
affects: [phase-11-verification, future-notification-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-scope setNotificationHandler returning a pure, node-tested behavior const (explicit foreground policy, not Expo's default)"
    - "Await immutable channel creation BEFORE installing the sweep trigger that begins scheduling (privacy-landmine avoidance)"
    - "Side-effect module import at App-shell scope to register a headless task that survives process death"

key-files:
  created: []
  modified:
    - App.tsx
    - src/services/notifications/notification-ids.ts
    - src/services/notifications/notification-ids.test.ts
    - .planning/phases/11-actionable-notifications/11-13-PLAN.md

key-decisions:
  - "Foreground policy lives as an exported pure const (FOREGROUND_NOTIFICATION_BEHAVIOR) in notification-ids.ts so it is node-testable without making App.tsx node-loadable (cycle-3 fix)"
  - "On a channel/category init failure the trigger still installs (best-effort) — the calls are idempotent and the reconcile itself guards; item-6 concern is ordering on the success path"
  - "The reconcile is registered as a launch-sweep hook only, never called directly in App.tsx — keeps it unreachable from the headless tap path (T-11-SWEEP)"

patterns-established:
  - "Pattern: explicit, unit-asserted foreground-presentation behavior const returned by the module-scope handler"
  - "Pattern: async bootstrap IIFE inside a ready-gated effect that awaits immutable OS resource creation before starting the scheduler, with a cancelled flag + captured subscription for cleanup"

requirements-completed: [NOTIF-01, NOTIF-02]

coverage:
  - id: D1
    description: "FOREGROUND_NOTIFICATION_BEHAVIOR is silent + no-banner (all four presentation flags false)"
    requirement: "NOTIF-02"
    verification:
      - kind: unit
        ref: "src/services/notifications/notification-ids.test.ts#suppresses banner + shade-list AND stays silent (all four flags false)"
        status: pass
    human_judgment: false
  - id: D2
    description: "App.tsx wires the reconcile sweep, awaits channels/category before the cold-start sweep, imports the headless task at module scope, sets the module-scope silent foreground handler, and mounts NotificationResponseGate — types/lint clean, full suite green"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit && npm run check:colors && npm test (68 files / 833 tests pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The running engine on-device: real delivery on the correct channel, killed-app mark/snooze write, body-tap→Compose→Back→dashboard, birthday day-of, permission grant/deny, lock-screen private/public, quiet-window roll, mute/snooze suppression, foreground silence"
    verification: []
    human_judgment: true
    rationale: "OS-runtime notification behaviour (real FCM-less delivery, headless task in a killed app, channel visibility, foreground presentation) cannot be exercised in the node/vitest harness — the native task runtime and OS shade are absent. Phase-gate Pixel UAT is the proof."

# Metrics
duration: ~18min
completed: 2026-08-16
status: complete
---

# Phase 11 Plan 13: Notification Engine Integration Summary

**App.tsx now wires the notification engine into the launch/ready lifecycle: a ready-gated reconcile sweep, channels + action category AWAITED into existence before the first cold-start schedule, a module-scope silent foreground handler, the headless task imported at module scope, and NotificationResponseGate mounted in the ready NavigationContainer.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-08-16T22:42:00Z
- **Tasks:** 2
- **Files modified:** 4 (App.tsx, notification-ids.ts, notification-ids.test.ts, 11-13-PLAN.md)

## Accomplishments
- Registered `registerNotificationScheduleSweep(getExecutor)` on the launch-sweep registry behind a module guard (`notificationScheduleRegistered`), ready-gated, alongside the field-sweep and photo-reconcile hooks — so the reconcile fires once per real foreground launch, never at import and never on a headless tap.
- Restructured the ready-gated effect so `ensureChannels()` + `ensureNotificationCategories()` are AWAITED to completion inside an async bootstrap IIFE BEFORE `installSweepTrigger(AppState)` fires the cold-start reconcile (item 6 / A1) — no schedule can precede its immutable channel. Subscription captured with a `cancelled` flag so effect cleanup still removes it and skips install after teardown.
- Added a module-scope `Notifications.setNotificationHandler` returning the new `FOREGROUND_NOTIFICATION_BEHAVIOR` const (silent, no-banner — item D), set exactly once at bundle load (not inside a component/effect).
- Added a module-scope side-effect import of `@/services/notifications/headless-task` so its `registerTaskAsync` runs in the headless context.
- Mounted `<NotificationResponseGate isReady={navReady} />` inside the ready NavigationContainer beside `<ShareIntentGate />`, both keyed on the same reactive `navReady` flag.
- **Cycle-3 fix (folded in):** defined the exported pure const `FOREGROUND_NOTIFICATION_BEHAVIOR = { shouldShowBanner:false, shouldShowList:false, shouldPlaySound:false, shouldSetBadge:false }` in `notification-ids.ts` and added a unit assertion that all four flags are `false` — node-testable coverage for the foreground policy without making App.tsx node-loadable.

## Task Commits

Each task was committed atomically (hooks ran; no `--no-verify`):

1. **Task 1: Register the schedule sweep + ensure channels/category + headless import + cycle-3 const/test** - `c2ec0f5` (feat)
2. **Task 2: Mount NotificationResponseGate in the ready NavigationContainer** - `228ec33` (feat)

## Files Created/Modified
- `App.tsx` - Module-scope `expo-notifications` import + `setNotificationHandler`; side-effect import of `headless-task`; `notificationScheduleRegistered` guard; awaited `ensureChannels()`/`ensureNotificationCategories()` before `installSweepTrigger`; `NotificationResponseGate` mount.
- `src/services/notifications/notification-ids.ts` - New exported pure const `FOREGROUND_NOTIFICATION_BEHAVIOR`.
- `src/services/notifications/notification-ids.test.ts` - Unit assertion that all four foreground flags are `false`.
- `.planning/phases/11-actionable-notifications/11-13-PLAN.md` - Artifacts note updated to reflect the new const + test.

## Decisions Made
- **Foreground policy as a shared pure const, not inline in App.tsx.** Keeps the decision unit-testable and prevents App.tsx from needing to be node-loadable. Declared plainly (no `expo-notifications` type import) so `notification-ids.ts` stays react-native/expo-free per its module contract; shape satisfies `NotificationBehavior`'s required keys.
- **Best-effort trigger install on channel-init failure.** The `try/catch` wraps `ensureChannels()`/`ensureNotificationCategories()` (both idempotent) and `installSweepTrigger` runs after — matching the plan's "ONLY AFTER they resolve" success path while logging (not swallowing silently) a genuine init failure.
- **SDK-57 handler keys confirmed against installed typings** (`NotificationBehavior` in `node_modules/expo-notifications/build/Notifications.types.d.ts`): required `shouldShowBanner`, `shouldShowList`, `shouldPlaySound`, `shouldSetBadge`; deprecated `shouldShowAlert` omitted deliberately.

## Deviations from Plan

None - plan executed exactly as written. The cycle-3 fix (FOREGROUND_NOTIFICATION_BEHAVIOR const + test) was pre-specified in the plan's owner-approved addendum and folded into Task 1, not an unplanned deviation.

## Issues Encountered
None. tsc, biome, `check:colors`, and the full suite (68 files / 833 tests) are green.

## User Setup Required
None - no external service configuration required.

## Phase Gate — Pixel UAT (outstanding, human-only)
The whole running engine must be verified on the physical Pixel (desktop-build pipeline → install → drive the app) — the OS-runtime behaviour cannot be exercised in the node/vitest harness:
- Real FCM-less delivery landing on the correct channel; no notification on a wrong/absent channel on a fresh install (item-6 ordering proof).
- Cold start + background→active each run the reconcile once; a headless action tap does NOT run the reconcile.
- Killed-app mark/snooze write (read back via `run-as com.bwales.orbit`).
- Body/action/birthday taps route (warm + cold) with Back → dashboard.
- Foreground silence: a nudge firing while the app is foregrounded shows no banner and plays no sound.
- Birthday day-of, permission grant/deny, lock-screen private/public, quiet-window roll, mute/snooze suppression.

## Next Phase Readiness
- The notification subsystem (11-06 channels, 11-07 category + headless, 11-10 reconcile, 11-12 gate) is now integrated into the app shell and runs on launch.
- Phase 11 code is complete; the phase gate is the on-device Pixel UAT above.

## Self-Check: PASSED

- App.tsx, notification-ids.ts, notification-ids.test.ts, 11-13-PLAN.md — all present and modified.
- Commits `c2ec0f5` and `228ec33` exist in `git log`.

---
*Phase: 11-actionable-notifications*
*Completed: 2026-08-16*
