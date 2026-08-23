---
phase: 15-weekly-digest
plan: 03
subsystem: infra
tags: [expo-notifications, weekly-trigger, launch-sweep, sqlite, defer-one, android-channels]

# Dependency graph
requires:
  - phase: 15-weekly-digest (15-01/15-02)
    provides: migration005 digest_enabled column + getAppSettings.digestEnabled read
  - phase: 11-notify
    provides: reconcile-engine pattern, launch-sweep registry, notification-ids/channels, app_settings.deliveryHour
provides:
  - digest-schedule service (scheduleDigest, reconcileDigestSchedule, registerDigestScheduleSweep, DIGEST_WEEKDAY)
  - digest:weekly singleton WEEKLY trigger under its OWN defer-one coordinator + OWN launch-sweep hook
  - digest-v1 LOW/PRIVATE channel + frozen DIGEST_TITLE/DIGEST_BODY copy
  - App.tsx ready-gated registration of the digest sweep
  - stateful expo-notifications double (schedule/cancel mutate the backing store)
affects: [15-04, 15-05, 15-06, weekly-digest-screen, settings-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Separate-service composition: a new notification type gets its OWN reconcile + OWN sweep hook, never folded into the decay/birthday engine (isOwnedIdentifier stays decay:/birthday: only)."
    - "Module-level defer-one coordinator (running/pending do-while) mirrored verbatim per independent scheduler so a stale overlapping pass never re-arms a just-cancelled trigger."
    - "Stateful expo double: schedule/cancel mutate the getAll backing store so two-pass idempotence is a real convergence proof."

key-files:
  created:
    - src/services/notifications/digest-schedule.ts
    - src/services/notifications/digest-schedule.test.ts
  modified:
    - src/services/notifications/notification-ids.ts
    - src/services/notifications/channels.ts
    - src/services/notifications/channels.test.ts
    - __mocks__/expo-notifications.ts
    - src/services/notifications/notification-schedule.test.ts
    - App.tsx

key-decisions:
  - "Digest is its OWN service + OWN launch-sweep hook (never folded into reconcileSchedule) — enforces the recorded T-15-06 non-clobber decision."
  - "DIGEST_WEEKDAY=1 (Sunday) is the single top-of-file tunable; delivery HOUR reuses the shared app_settings.deliveryHour."
  - "digest-v1 channel is LOW/PRIVATE with frozen generic copy that names no one — lock-screen safe (T-15-04)."
  - "reconcileDigestSchedule carries its own defer-one coordinator (H2), proven by a deterministic deferred-barrier test (M4), not a timing test."

patterns-established:
  - "Per-scheduler defer-one: each independent reconcile owns its own running/pending flags + __reset test hook."
  - "Drift detection on a singleton WEEKLY trigger via existing weekday/hour vs desired, cancel+reschedule under the same id."

requirements-completed: [DGST-01]

coverage:
  - id: D1
    description: "reconcileDigestSchedule schedules exactly one digest:weekly WEEKLY trigger when enabled & absent; two passes converge to one (idempotent)."
    requirement: DGST-01
    verification:
      - kind: unit
        ref: "src/services/notifications/digest-schedule.test.ts#schedule + idempotence"
        status: pass
    human_judgment: false
  - id: D2
    description: "Toggle/master gating: digest toggle OFF or notifications master OFF cancels digest:weekly; toggle ON & absent arms the default-on digest."
    requirement: DGST-01
    verification:
      - kind: unit
        ref: "src/services/notifications/digest-schedule.test.ts#toggle + master gating"
        status: pass
    human_judgment: false
  - id: D3
    description: "A delivery-hour (or weekday) drift cancels + reschedules under the same digest:weekly id; a matching digest is left untouched."
    requirement: DGST-01
    verification:
      - kind: unit
        ref: "src/services/notifications/digest-schedule.test.ts#delivery-hour / weekday drift"
        status: pass
    human_judgment: false
  - id: D4
    description: "Defer-one coordinator (H2/M4): a stale overlapping pass never re-arms a digest the newest settings write just cancelled (deterministic deferred barrier)."
    requirement: DGST-01
    verification:
      - kind: unit
        ref: "src/services/notifications/digest-schedule.test.ts#defer-one coordinator (H2/M4)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The decay/birthday reconcileSchedule NEVER cancels digest:weekly, master-off and master-on with decay/birthday candidates present (T-15-06 non-clobber)."
    requirement: DGST-01
    verification:
      - kind: unit
        ref: "src/services/notifications/notification-schedule.test.ts#stale cancel + full-request diff (T-15-06)"
        status: pass
    human_judgment: false
  - id: D6
    description: "digest-v1 channel created LOW importance / PRIVATE visibility with frozen generic copy; App.tsx registers the digest sweep behind a module guard in the ready effect."
    requirement: DGST-01
    verification:
      - kind: unit
        ref: "src/services/notifications/channels.test.ts#ensureChannels — four versioned channels, LOW/PRIVATE"
        status: pass
    human_judgment: false
  - id: D7
    description: "Weekly Sunday fire + reboot persistence on a real device."
    requirement: DGST-01
    verification: []
    human_judgment: true
    rationale: "AlarmManager WEEKLY delivery and reboot re-arm are OS-timing behaviors not observable in the node suite — device-verified in 15-06."

# Metrics
duration: 10min
completed: 2026-08-23
status: complete
---

# Phase 15 Plan 03: Weekly-Digest Sunday Alarm Summary

**A `digest:weekly` singleton WEEKLY (Sunday) local-notification trigger with its own `reconcileDigestSchedule` defer-one coordinator, its own launch-sweep hook, a LOW/PRIVATE `digest-v1` channel, and frozen generic copy — riding the 11-notify engine without being folded into it.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-23T22:52:32Z
- **Completed:** 2026-08-23T23:02:00Z
- **Tasks:** 3 (Task 2 TDD: RED → GREEN)
- **Files modified:** 6 modified, 2 created

## Accomplishments
- `digest-schedule.ts` — `scheduleDigest`, `reconcileDigestSchedule` (module-level defer-one coordinator mirroring notification-schedule verbatim), `registerDigestScheduleSweep`, `DIGEST_WEEKDAY=1` tunable. Absent&enabled→schedule; present&!enabled→cancel; drift→cancel+reschedule; matching→leave.
- `notification-ids.ts` — `DIGEST_IDENTIFIER` (singleton `digest:weekly`), `DIGEST_CHANNEL` (`digest-v1`), frozen `DIGEST_TITLE`/`DIGEST_BODY`.
- `channels.ts` — `digest-v1` created LOW/PRIVATE in `ensureChannels()` (create-only, versioned id).
- Stateful expo double (M2): schedule/cancel now mutate the `getAll` backing store, making two-pass idempotence a real convergence proof.
- M1 fix: `notification-schedule.test.ts` harness migrated to v5 (append migration005, bump 4→5) so the live reconcile's `getAppSettings` digest_enabled SELECT works; the whole notification suite is green.
- T-15-06 non-clobber strengthened to seed the REAL `DIGEST_IDENTIFIER` and assert `reconcileSchedule` never cancels it (master-off AND master-on with candidates).
- App.tsx wires `registerDigestScheduleSweep(getExecutor)` in the ready effect behind a `digestScheduleRegistered` module guard.

## Task Commits

1. **Task 1: notification-ids + channel + stateful expo-mock** - `affcc3c` (feat)
2. **Task 2: digest-schedule service (RED)** - `19e3d7b` (test)
3. **Task 2: digest-schedule service (GREEN)** - `9abcb54` (feat)
4. **Task 3: App.tsx wiring + non-clobber + M1 v5 harness** - `bd5a3f7` (feat)

## Files Created/Modified
- `src/services/notifications/digest-schedule.ts` - The digest reconcile service, its defer-one coordinator, and its sweep-hook registrar.
- `src/services/notifications/digest-schedule.test.ts` - schedule/idempotence, toggle/master gating, drift, deterministic defer-one barrier, sweep registration (9 tests).
- `src/services/notifications/notification-ids.ts` - DIGEST_IDENTIFIER / DIGEST_CHANNEL / DIGEST_TITLE / DIGEST_BODY.
- `src/services/notifications/channels.ts` - digest-v1 LOW/PRIVATE channel creation.
- `src/services/notifications/channels.test.ts` - fourth-channel assertions (LOW/PRIVATE, idempotent x8).
- `__mocks__/expo-notifications.ts` - WEEKLY trigger type; title/weekday/hour/minute facets; stateful schedule/cancel.
- `src/services/notifications/notification-schedule.test.ts` - v5 harness (M1); real DIGEST_IDENTIFIER non-clobber regression (master-off + master-on).
- `App.tsx` - ready-gated digest sweep registration behind a module guard.

## Decisions Made
None beyond the plan — all recorded decisions (separate service, own sweep hook, defer-one, Sunday tunable, LOW/PRIVATE frozen copy) were followed as specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated channels.test.ts for the new fourth channel**
- **Found during:** Task 1 (channel creation)
- **Issue:** Adding `digest-v1` broke `channels.test.ts`, which asserted "exactly the three versioned channels" and 6-call idempotence — a direct, in-scope consequence of the planned channel addition (the plan listed channels.ts but not its test).
- **Fix:** Updated the count to four, added `DIGEST_CHANNEL` to the id/importance/visibility assertions, and bumped the idempotence assertion to 8 calls / slice(4).
- **Files modified:** src/services/notifications/channels.test.ts
- **Verification:** channels.test.ts 5/5 green; full notification suite 97/97 green.
- **Committed in:** affcc3c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/in-scope test update)
**Impact on plan:** Necessary to keep the suite green after the planned channel addition. No scope creep.

## Issues Encountered
- The barrier defer-one test initially failed on `getAllMock` call count because the test's own final assertion-read of `getAllScheduledNotificationsAsync()` incremented the mock; reordered the count assertion before that read. Resolved within Task 2.
- Biome flagged import ordering on the new module; ran `biome check --write` on the changed files (import-order only, semantically identical) and re-verified green.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The digest now schedules on every real foreground launch and re-arms idempotently; toggle/hour transitions cancel/reschedule correctly; the decay/birthday engine provably leaves it alone.
- Device-observable behavior (actual Sunday-morning fire + reboot persistence) is verified in 15-06 per the phase plan.
- The `{ kind: "digest" }` tap payload is scheduled but its navigation/route target and the digest screen itself are downstream plans (15-04+).

---
*Phase: 15-weekly-digest*
*Completed: 2026-08-23*

## Self-Check: PASSED
- Created files present: digest-schedule.ts, digest-schedule.test.ts, 15-03-SUMMARY.md.
- Task commits present: affcc3c, 19e3d7b, 9abcb54, bd5a3f7.
- Gates: full project suite 1354/1354, notification suite 97/97, `tsc --noEmit` clean, Biome clean.
