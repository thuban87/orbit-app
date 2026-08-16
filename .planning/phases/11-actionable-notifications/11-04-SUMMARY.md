---
phase: 11-actionable-notifications
plan: 04
subsystem: database
tags: [sqlite, notifications, decay, birthday, status, read-layer]

# Dependency graph
requires:
  - phase: 08-dashboard
    provides: status.ts PROGRESS_SQL/ROGUE_K query-time engine + listBirthdayCandidates shape
  - phase: 11-actionable-notifications (11-03)
    provides: snooze-dao — the first writer of contacts.snooze_until (the base this read surfaces)
provides:
  - "DECAY_ELIGIBLE_WHERE — the NOTIF-03 decay-eligibility SQL fragment (composed only from status.ts constants)"
  - "listDecayEligibleCandidates(exec) — every schedulable contact (stable/wobble/overdue) with last_contact + interval_days + snooze_until, ORDER BY id"
  - "listBirthdayNotificationCandidates(exec) — every non-archived contact with a birthday, ignoring decay suppressors, ORDER BY id"
affects: [11-10 notification scheduler, 11-05 fire-instant, notification-schedule reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Notification read layer mirrors dashboard-read.ts posture: pure async getAllAsync, reuse status.ts fragments, never re-derive"
    - "Eligibility (unbounded) is split from scheduled (bounded downstream) — H5 pre-scheduling premise"

key-files:
  created:
    - src/services/notifications/decay-suppression.ts
    - src/db/notification-read.ts
    - src/db/notification-read.test.ts
  modified: []

key-decisions:
  - "Followed the PLAN's Cycle-1/2 addenda (H5 + items A/C), NOT the stale 11-PATTERNS §notification-read snippet which still described the pre-H5 bounded predicate (>= WOBBLE_MAX lower bound + snooze exclusion + JS day-of birthday filter)."
  - "WOBBLE_MAX is not imported by decay-suppression.ts — with the lower bound removed it would be a dead import (biome noUnusedImports)."

patterns-established:
  - "Decay eligibility is the FULL non-suppressed set; 11-10 bounds the scheduled subset (HORIZON_DAYS + soonest-N)."
  - "Both reads are ORDER BY id for a deterministic candidate order (11-10 stagger keys on contactId)."

requirements-completed: [NOTIF-03, NOTIF-04]

coverage:
  - id: D1
    description: "DECAY_ELIGIBLE_WHERE composes only status.ts constants (PROGRESS_SQL, ROGUE_K); no WOBBLE_MAX lower bound, no snooze exclusion, no re-typed rogue cutoff"
    requirement: "NOTIF-03"
    verification:
      - kind: unit
        ref: "src/db/notification-read.test.ts#a contact exactly AT the rogue cutoff (progress >= ROGUE_K) is excluded"
        status: pass
    human_judgment: false
  - id: D2
    description: "listDecayEligibleCandidates returns every schedulable contact (stable/wobble/overdue) with last_contact + interval_days + snooze_until; NOTIF-03 suppressors excluded; snooze is a base not a filter"
    requirement: "NOTIF-03"
    verification:
      - kind: unit
        ref: "src/db/notification-read.test.ts#excludes never-contacted, rarely_responds, muted, archived, and rogue; keeps the eligible one"
        status: pass
      - kind: unit
        ref: "src/db/notification-read.test.ts#returns a FUTURE-snoozed contact WITH its future snooze_until"
        status: pass
      - kind: unit
        ref: "src/db/notification-read.test.ts#returns a STABLE contact (not yet due) with last_contact + interval_days + snooze_until"
        status: pass
    human_judgment: false
  - id: D3
    description: "listBirthdayNotificationCandidates returns every non-archived contact with a birthday (any date), ignoring every decay suppressor; excludes null-birthday and archived"
    requirement: "NOTIF-04"
    verification:
      - kind: unit
        ref: "src/db/notification-read.test.ts#returns day-of, next-week, and decay-suppressed birthdays; excludes null-birthday and archived"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both reads return rows in ascending id order (deterministic — item C)"
    verification:
      - kind: unit
        ref: "src/db/notification-read.test.ts#returns rows in ascending id order regardless of insertion bucket"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-16
status: complete
---

# Phase 11 Plan 04: Notification Read Layer Summary

**Decay + birthday notification eligibility reads — `DECAY_ELIGIBLE_WHERE` (composed only from status.ts's PROGRESS_SQL/ROGUE_K) and `listDecayEligibleCandidates` / `listBirthdayNotificationCandidates`, giving 11-10 the full unbounded eligible set plus each contact's snooze base to pre-schedule future fires (H5).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-16T16:35:00Z
- **Completed:** 2026-08-16T16:40:00Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- `decay-suppression.ts` exports `DECAY_ELIGIBLE_WHERE`: `last_contact IS NOT NULL AND rarely_responds = 0 AND reminders_off = 0 AND archived_at IS NULL AND (PROGRESS_SQL) < ROGUE_K` — the NOTIF-03 predicate built purely from status.ts constants, with NO lower bound (H5) and NO snooze exclusion.
- `notification-read.ts` exposes `listDecayEligibleCandidates` (returns `id, name, last_contact, interval_days, snooze_until`, ORDER BY id) and `listBirthdayNotificationCandidates` (every non-archived birthday, ignoring decay suppressors, ORDER BY id).
- `notification-read.test.ts` proves the H5 eligibility (stable/wobble/overdue all returned), the snooze-as-base behaviour, every NOTIF-03 exclusion asserted absent, the NOTIF-04 decay-suppressor-ignoring birthday rule, the rogue cutoff boundary, and ascending-id ordering on both reads (9 tests).

## Task Commits

Each task was committed atomically:

1. **Task 1: decay-suppression fragment + notification-read read module** - `52aad33` (feat)
2. **Task 2: notification-read.test.ts — suppression + birthday coverage** - `d5fe04e` (test)

_Note: this plan is `type: execute` with tdd="true" tasks; the plan structures implementation (Task 1) then test (Task 2), so commits follow feat→test rather than the RED-first order._

## Files Created/Modified
- `src/services/notifications/decay-suppression.ts` - `DECAY_ELIGIBLE_WHERE` SQL fragment (status.ts constants only, no writes).
- `src/db/notification-read.ts` - `listDecayEligibleCandidates` + `listBirthdayNotificationCandidates` pure async reads.
- `src/db/notification-read.test.ts` - in-memory node:sqlite coverage (9 tests) with status.ts-parity fixtures.

## Decisions Made
- **Followed the PLAN over the stale 11-PATTERNS snippet.** `11-PATTERNS.md §notification-read` still describes the pre-H5 bounded predicate (a `>= WOBBLE_MAX` lower bound, a `snooze_until <= now` exclusion, and a JS `daysUntilBirthday === 0` day-of filter). The plan's REVIEW-CYCLE-1 (H5) and REVIEW-CYCLE-2 (items A/C) addenda explicitly supersede that: eligibility is unbounded (stable/wobble schedulable for future dates), snooze is surfaced as a base rather than an exclusion, and the birthday day-of math is deferred to 11-10. The plan text is authoritative; PATTERNS is the older analog note.
- **`WOBBLE_MAX` deliberately not imported** in `decay-suppression.ts` — the removed lower bound was its only use, so importing it would trip biome `noUnusedImports`. The plan's action note calls this out.
- **Own seed helper in the test** (includes `reminders_off`) rather than reusing dashboard-read.test.ts's helper, which omits that column and so could not exercise the muted-exclusion case.

## Deviations from Plan

None - plan executed exactly as written. (The one judgment call — PLAN over stale PATTERNS — is a documented decision above, not an unplanned change; the plan itself directs this via its H5/item-A/item-C addenda.)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 11-10 (the scheduler) now has its single read source: the full decay-eligible set (with each contact's `last_contact` / `interval_days` / `snooze_until`) and every birthday candidate, both in a deterministic id order.
- The next-occurrence day-of math (`daysUntilBirthday`) and the fire-instant / horizon-cap logic remain 11-05 / 11-10's responsibility — intentionally NOT in this read layer.

## Self-Check: PASSED

All created files verified present on disk; both task commits (`52aad33`, `d5fe04e`) verified in git log. Full suite green (762 tests), tsc clean, biome clean, check:colors clean.

---
*Phase: 11-actionable-notifications*
*Completed: 2026-08-16*
