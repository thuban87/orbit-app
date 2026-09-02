---
phase: 11-actionable-notifications
plan: 10
subsystem: notifications
tags: [expo-notifications, scheduling, reconcile, sqlite, decay, birthday, defer-one]

# Dependency graph
requires:
  - phase: 11-01
    provides: expo-notifications test double (seedable getAllScheduledNotificationsAsync)
  - phase: 11-02
    provides: app_settings DAO (getAppSettings) + migration 002
  - phase: 11-04
    provides: notification-read candidates (decay-eligible + birthday) + decay-suppression predicate
  - phase: 11-05
    provides: fire-instant math (nextNudgeDate + nextAllowedFireInstant)
  - phase: 11-06
    provides: channels + notification-ids (identifiers, channels, category, generic body builders, NotificationData/occurrenceKey)
provides:
  - "reconcileSchedule(exec) — the launch/foreground scheduling engine (NOTIF-01 decay + NOTIF-04 birthday half)"
  - "Bounded future pre-scheduling: HORIZON_DAYS window + soonest-N MAX_SCHEDULED_NOTIFICATIONS cap with within-horizon birthdays reserved"
  - "Full-request diff (requestsEqual): fire instant at HOUR granularity + channel + category + data + body + title → cancel+reschedule under same identifier"
  - "Self-coordinating DEFER-ONE reconcile (reconcileRunning/reconcilePending) — coalesces overlapping fire-and-forget callers to one trailing pass"
  - "staggerFor(contactId) deterministic per-contact minute offset"
  - "registerNotificationScheduleSweep(getExec) — one launch-sweep hook; import runs nothing"
affects: [11-09, 11-11, 11-12, 11-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DEFER-ONE re-entrancy coordinator mirrored from launch-sweep for a read-only reconcile"
    - "Full-request (not identifier-presence) diff against the OS scheduled set"
    - "Bounded desired-set selection (horizon filter → soonest-N cap → category reservation)"

key-files:
  created:
    - src/services/notifications/notification-schedule.ts
    - src/services/notifications/notification-schedule.test.ts
  modified: []

key-decisions:
  - "content.title is never minted (body carries identity) but IS a requestsEqual facet, so a real frozen title divergence still forces a refresh"
  - "Master-off short-circuit cancels every owned decay:/birthday: id and returns before any candidate read"
  - "Horizon window computed as now + HORIZON_DAYS*MS_PER_DAY; per-candidate build wrapped in try/catch so one bad row never aborts the reconcile"

patterns-established:
  - "Reconcile passes RE-READ all inputs (settings + candidates + OS set) so the DEFER-ONE trailing pass reflects newest committed state"
  - "Birthday cap reservation: take all within-horizon birthdays first, then fill remaining slots with soonest decay"

requirements-completed: [NOTIF-01, NOTIF-04]

coverage:
  - id: D1
    description: "reconcileSchedule pre-schedules future decay occurrences (stable/wobble/overdue at max(dueDate, snooze_until)) and next day-of birthdays (H5)"
    requirement: "NOTIF-01"
    verification:
      - kind: unit
        ref: "src/services/notifications/notification-schedule.test.ts#future pre-scheduling (H5)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bounded scheduled set — HORIZON_DAYS filter + soonest-N MAX cap with within-horizon birthdays reserved (item A + cycle-3)"
    requirement: "NOTIF-01"
    verification:
      - kind: unit
        ref: "src/services/notifications/notification-schedule.test.ts#horizon + soonest-N cap (item A)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full-request diff (requestsEqual) cancels+reschedules under the same identifier on delivery-hour / channel / body / occurrenceKey change; hour-invariant to stagger; identical requests are no-ops (H3 + items C/F)"
    verification:
      - kind: unit
        ref: "src/services/notifications/notification-schedule.test.ts#stale cancel + full-request diff"
        status: pass
      - kind: unit
        ref: "src/services/notifications/notification-schedule.test.ts#requestsEqual"
        status: pass
    human_judgment: false
  - id: D4
    description: "Self-coordinating DEFER-ONE reconcile — overlapping calls coalesce to one trailing pass reflecting newest state (a snoozed contact ends cancelled, not re-armed) (cycle-3 HIGH / T-11-RACE)"
    verification:
      - kind: unit
        ref: "src/services/notifications/notification-schedule.test.ts#DEFER-ONE coalescing (cycle-3)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Malformed birthday (daysUntilBirthday === null) skipped, not scheduled with an Invalid Date (item E); gating branches cancel stale ids; registerNotificationScheduleSweep pushes one hook and import runs nothing"
    requirement: "NOTIF-04"
    verification:
      - kind: unit
        ref: "src/services/notifications/notification-schedule.test.ts#malformed birthday guard (item E)"
        status: pass
      - kind: unit
        ref: "src/services/notifications/notification-schedule.test.ts#gating"
        status: pass
      - kind: unit
        ref: "src/services/notifications/notification-schedule.test.ts#registerNotificationScheduleSweep"
        status: pass
    human_judgment: false
  - id: D6
    description: "At ~200+ eligible contacts the reconcile schedules at most MAX_SCHEDULED_NOTIFICATIONS (all within HORIZON_DAYS) with none silently dropped by the OS, real morning delivery, quiet-window roll, weekly re-nag replacing the prior shade entry, staggered burst not muted by Android 15 cooldown"
    requirement: "NOTIF-01"
    verification:
      - kind: manual_procedural
        ref: "Pixel on-device UAT (phase gate) — pending set read via getAllScheduledNotificationsAsync"
        status: unknown
    human_judgment: true
    rationale: "OS-runtime behavior (AlarmManager delivery, pending-cap, Android 15 cooldown, quiet-window) cannot be asserted in node; requires on-device Pixel verification per phase gate item A."

# Metrics
duration: 13min
completed: 2026-08-16
status: complete
---

# Phase 11 Plan 10: Notification Scheduling Engine Summary

**`reconcileSchedule` — the launch/foreground reconcile that pre-schedules each eligible contact's next future decay occurrence and every non-archived birthday, bounds the set to a HORIZON_DAYS window + soonest-N cap (birthdays reserved), diffs the FULL request against the OS scheduled set (cancel+reschedule on any mismatch), and self-coordinates overlapping callers via a DEFER-ONE guard.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-16T17:04:17Z
- **Completed:** 2026-08-16T17:17:34Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `notification-schedule.ts`: `reconcileSchedule(exec)` composes notification-read + fire-instant + birthday-logic + app-settings + notification-ids into the single scheduling authority. Future pre-scheduling (H5), HORIZON_DAYS + MAX_SCHEDULED_NOTIFICATIONS cap with birthday reservation (item A + cycle-3), full-request diff (H3 + items C/F), malformed-birthday guard (item E), deterministic `staggerFor(contactId)` (item C), and the launch-sweep registration.
- Cycle-3 HIGH landed: the reconcile is SELF-COORDINATING via a module-level DEFER-ONE guard (`reconcileRunning`/`reconcilePending`) mirroring `launch-sweep.ts:49-90`. Overlapping fire-and-forget callers coalesce to exactly one trailing pass that re-reads the newest committed state — a stale in-flight reconcile can never finish last and re-arm a just-cancelled notification (T-11-RACE).
- Cycle-3 birthday-priority landed: within the soonest-N cap, all within-horizon birthdays are taken first, then decay fills the remaining slots — a one-shot birthday is never evicted by nearer-firing decay reminders.
- 25-case co-located test suite (all green): pre-scheduling, horizon, cap, birthday reservation, stagger-by-id, malformed-birthday skip, stale cancel, timing/body/channel reschedule, hour-granularity invariance, unchanged-request no-op, gating, DEFER-ONE coalescing, sweep registration, and facet-level `requestsEqual`.

## Task Commits

Each task was committed atomically:

1. **Task 1: notification-schedule module (tunables, reconcile diff, sweep registration)** - `c4a9190` (feat)
2. **Task 2: notification-schedule.test.ts (reconcile diff + gating + DEFER-ONE)** - `4ffd32a` (test)

_Note: implemented in plan order (module then test); both tasks carry `tdd="true"` and the feature is proven end-to-end by the Task 2 suite._

## Files Created/Modified
- `src/services/notifications/notification-schedule.ts` - The reconcile engine: `reconcileSchedule`, `registerNotificationScheduleSweep`, `requestsEqual`, `staggerFor`, and tunables `RE_NAG_DAYS` / `STAGGER_MINUTES` / `STAGGER_SLOTS` / `HORIZON_DAYS=35` / `MAX_SCHEDULED_NOTIFICATIONS=48`.
- `src/services/notifications/notification-schedule.test.ts` - 25 unit cases against the in-memory node:sqlite DB + the expo-notifications double.

## Decisions Made
- **`content.title` is never minted** — the generic body (`decayBody`/`birthdayBody`) carries identity, matching notification-ids (no title builder). Title is still a `requestsEqual` facet (both sides `undefined` → equal), so if a real frozen request ever carries a divergent title the diff would force a refresh. No privacy/behavior impact.
- **Master-off is an explicit early return** — cancels every owned `decay:`/`birthday:` id and returns before any candidate read (the normal cancel-stale path would achieve the same, but the early return is clearer and cheaper).
- **Horizon end = `now + HORIZON_DAYS * MS_PER_DAY`** — candidate fire instants are already strictly future (nextAllowedFireInstant rolls past-slots forward), so only the upper bound is load-bearing.

## Deviations from Plan
None - plan executed exactly as written (including the folded "## Cycle-3 Review Fix" — self-coordinating DEFER-ONE reconcile, birthday cap reservation, and the two additional tests).

## Issues Encountered
- **tsc friction with expo's wide `NotificationRequestInput`/trigger union.** The recorded schedule-call arg and the returned scheduled set do not typecheck against `.trigger.date`/`.channelId`/optional `identifier`. Resolved by reading through narrowed local interfaces (`ScheduledEntry` in the module, `RecordedRequest` in the test) via `as unknown as` casts — the module never couples to expo's fragile runtime trigger union. The expo-notifications double (11-01) shares the same singleton the `vi.mock` provides, so `__setScheduled` seeding drives the real reconcile.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The scheduling half of NOTIF-01/NOTIF-04 is complete and unit-proven. In-app callers (11-09 edit-save / profile-snooze / clear, 11-11 settings changes) can call `reconcileSchedule(getExecutor())` fire-and-forget — coordination is internal.
- `data.occurrenceKey` (= `formatLocalDate(fireInstant)`) is minted into every payload for 11-07's per-occurrence action idempotency (`actionUid`).
- **Outstanding phase gate (D6):** on-device Pixel UAT at ~200+ contacts — assert scheduled count == soonest-N and every fire ≤ now+HORIZON_DAYS, plus real morning delivery / quiet-window roll / weekly re-nag replacement / staggered-burst (Android 15 cooldown). Not assertable in node.
- `registerNotificationScheduleSweep` is not yet wired into `App.tsx` (mirrors `registerFieldSweep`, also unwired) — a later launch-wiring plan installs the hook.

## Self-Check: PASSED
- `src/services/notifications/notification-schedule.ts` — FOUND
- `src/services/notifications/notification-schedule.test.ts` — FOUND
- Commit `c4a9190` — FOUND
- Commit `4ffd32a` — FOUND

---
*Phase: 11-actionable-notifications*
*Completed: 2026-08-16*
