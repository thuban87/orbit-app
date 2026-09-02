---
phase: 11-actionable-notifications
plan: 11
subsystem: ui
tags: [notifications, settings, permissions, expo-notifications, datetimepicker, app-settings]

# Dependency graph
requires:
  - phase: 11-02
    provides: app-settings-dao (getAppSettings / updateAppSettings with 0-23 hour + 0/1 toggle validation)
  - phase: 11-06
    provides: permission.ts (requestNotificationPermission / getNotificationPermission, once-only value-moment ask)
  - phase: 11-10
    provides: reconcileSchedule (self-coordinating full-request diff that re-arms already-pending notifications)
provides:
  - Settings → Notifications section (master + decay + birthday + lock-screen toggles)
  - Value-moment POST_NOTIFICATIONS request wired to the master toggle
  - Non-nagging denial-degraded note (shown once, no re-prompt)
  - User-tunable delivery-hour + quiet-window (start/end) time controls via native time picker
affects: [11-13, notifications, settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settings controls persist via updateAppSettings then fire-and-forget reconcileSchedule(getExecutor())"
    - "OS permission read fresh on focus (never cached); master toggle IS the value-moment affordance"
    - "Sub-controls disabled + dimmed (label textSecondary, no accent track) when master off"

key-files:
  created: []
  modified:
    - src/screens/SettingsScreen.tsx

key-decisions:
  - "Three separate time rows (Reminder time / Quiet hours start / Quiet hours end) per PLAN Task 2, each with its own testID — over the UI-SPEC's single combined 'Quiet hours' display row."
  - "Degraded note derived from (notificationsEnabled === 1 AND OS permission not granted): renders on denial AND when permission is revoked out-of-app; text-only, never re-prompts."
  - "Master toggle reflects persisted notifications_enabled; a denied request never persists enabled, so the switch stays visually off."

patterns-established:
  - "Pattern: persist(patch) helper — updateAppSettings + re-read + fire-and-forget reconcile, one path for every control."
  - "Pattern: single native time picker instance driven by an activePicker discriminant ('delivery' | 'quiet-start' | 'quiet-end')."

requirements-completed: [NOTIF-05]

coverage:
  - id: D1
    description: "Notifications section renders master + decay + birthday + lock-screen toggles with UI-SPEC copy/testIDs; sub-controls disabled+dimmed when master off."
    requirement: "NOTIF-05"
    verification:
      - kind: automated_ui
        ref: "adb uiautomator dump — Pixel UAT (phase gate)"
        status: unknown
    human_judgment: true
    rationale: "On-device Pixel UAT of rendered controls + disabled/dimmed states is the phase gate; not covered by unit tests (screen imports native Switch + datetimepicker)."
  - id: D2
    description: "Flipping master ON requests POST_NOTIFICATIONS at that value moment; denial reverts master to off and shows the degraded note once (no re-prompt)."
    requirement: "NOTIF-05"
    verification:
      - kind: manual_procedural
        ref: "Pixel UAT: master on → system dialog; deny → degraded note + master off; grant → sub-controls enable"
        status: unknown
    human_judgment: true
    rationale: "The OS POST_NOTIFICATIONS dialog + grant/deny degrade path can only be exercised on-device."
  - id: D3
    description: "Delivery-hour + quiet-window (start/end) time controls open a native time picker; the picked hour persists via the validated DAO and reconciles."
    requirement: "NOTIF-05"
    verification:
      - kind: manual_procedural
        ref: "Pixel UAT: tap each time row → picker opens; change hour → persists + reschedules; disabled when master off"
        status: unknown
    human_judgment: true
    rationale: "Native time-picker interaction + persistence + reschedule is UI-observable only on-device."

# Metrics
duration: 12min
completed: 2026-08-16
status: complete
---

# Phase 11 Plan 11: Settings → Notifications Section Summary

**Settings Notifications section — master/decay/birthday/lock-screen toggles, a value-moment POST_NOTIFICATIONS request with a non-nagging denial-degraded note, and user-tunable delivery-hour + quiet-window time controls, all backed by app_settings and firing an immediate reconcile.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-08-16
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added a `settings-notifications-section` at the top of `SettingsScreen`'s scroll content with a master toggle, decay/birthday per-type toggles, and a lock-screen visibility toggle (default off = private), reusing the EditContactScreen Switch token contract verbatim.
- Wired the master toggle as the value-moment permission affordance: flipping ON calls `requestNotificationPermission()`; grant persists `notifications_enabled=1` + reconciles, denial keeps master off and renders the degraded note once (no re-prompt, no danger styling).
- Added the owner's user-tunable delivery-hour and quiet-window (start/end) controls as three tappable rows opening `@react-native-community/datetimepicker` in `mode="time"`; the picked hour persists via the bound-validating DAO then reconciles.
- Every control persists via `updateAppSettings` then fires `reconcileSchedule(getExecutor())` (fire-and-forget) so the schedule re-arms immediately; sub-controls are disabled + dimmed when master is off.

## Task Commits

Each task was committed atomically:

1. **Task 1: Notifications toggles + permission value moment + degraded note** - `91008c4` (feat)
2. **Task 2: Delivery-hour + quiet-window time controls (native time picker)** - `7e474ee` (feat)

## Files Created/Modified
- `src/screens/SettingsScreen.tsx` - Added the Notifications section: four toggles, degraded note, three time-picker rows, the `persist()` + reconcile helper, fresh-on-focus permission read, and supporting styles/format helpers.

## Decisions Made
- **Three time rows, not one combined "Quiet hours" display:** PLAN Task 2 is explicit about three tappable rows with distinct testIDs (`settings-notifications-time`, `-quiet-start`, `-quiet-end`); followed the plan over the UI-SPEC's single combined value display. The quiet-hours helper line is retained.
- **Degraded note is derived, not one-shot state:** shown whenever `notifications_enabled === 1` but the OS permission is not granted (covers both an in-session denial and an out-of-app revocation). It is text-only and never re-prompts, satisfying the non-nagging contract.
- **Master switch tracks persisted state:** a denied request never writes `notifications_enabled=1`, so the switch visually reverts to off with no extra local override.

## Deviations from Plan

None - plan executed exactly as written. (Task 1's action noted that `ensureChannels()` is handled at app init in 11-13, so this plan only persists + reconciles — followed as written.)

## Issues Encountered
None. tsc, `check:colors`, Biome, and the full test suite (832 tests) all pass. Biome reformatted one arrow-function line on first write (auto-applied).

## User Setup Required
None - no external service configuration required. The datetimepicker dependency was already installed and registered in `app.config.ts` (Phase 4).

## Next Phase Readiness
- The in-app control surface for NOTIF-05 is complete and wired to the DAO + reconcile engine.
- **Phase gate — on-device Pixel UAT is outstanding:** the rendered controls, the OS `POST_NOTIFICATIONS` dialog, the grant/deny degrade path, toggle gating of scheduling, and the time-picker persistence + reschedule are UI-observable only and must be verified on the Pixel (all three coverage deliverables are `human_judgment: true`, status `unknown`).

## Self-Check: PASSED

- `src/screens/SettingsScreen.tsx` — present, tsc + check:colors + Biome clean, 832 tests pass.
- Task commits `91008c4` and `7e474ee` — present in git log.

---
*Phase: 11-actionable-notifications*
*Completed: 2026-08-16*
