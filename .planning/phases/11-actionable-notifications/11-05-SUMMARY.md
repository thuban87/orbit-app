---
phase: 11-actionable-notifications
plan: 05
subsystem: testing
tags: [notifications, scheduling, dates, local-time, pure-logic, vitest]

# Dependency graph
requires:
  - phase: 11-actionable-notifications (11-04)
    provides: listDecayEligibleCandidates / listBirthdayNotificationCandidates — the candidate contacts whose due dates feed this math
provides:
  - "nextAllowedFireInstant(baseDate, deliveryHour, quietStartHour, quietEndHour, staggerMinutes, now) — the exact LOCAL Date a DATE trigger fires on, with quiet-window roll-forward (incl. midnight wrap), past-slot roll, per-contact stagger, and 0–23 hour clamp"
  - "nextNudgeDate(dueDate, now, cadenceDays) — the stateless weekly re-nag day derived purely from the due date (no stored state)"
  - "clampHour(h) — the single 0–23 integer coercion choke point (T-11-05)"
affects: [11-10 notification scheduler, notification-schedule reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure react-native/expo-free scheduling module mirroring src/logic/birthday-logic.ts: node-loadable, never-throws, LOCAL wall-clock Date construction only (never toISOString/UTC)"
    - "Policy numbers (cadence, hours, stagger) live at the call site; this module owns no policy constant"
    - "Component-based day stepping (new Date(y,m,d+n)) not ms arithmetic — DST-safe"

key-files:
  created:
    - src/services/notifications/fire-instant.ts
    - src/services/notifications/fire-instant.test.ts
  modified: []

key-decisions:
  - "nextAllowedFireInstant takes an explicit `now` 6th arg (per PLAN behavior), extending the 5-arg RESEARCH sketch, so the past-slot roll is deterministic and node-testable."
  - "Quiet-window roll target is quietEnd on the correct morning: a wrapping window's EVENING portion (hour >= quietStart) exits the NEXT day; the early-morning portion and any non-wrapping window exit the SAME day."
  - "clampHour: non-finite (NaN/±Infinity) → 0, fractional truncated toward zero (9.5→9), out-of-range clamped to nearest bound — never NaN."
  - "cadenceDays < 1 or non-finite is floored to 1 purely as a loop-safety guard (never a policy number); a MAX_STEPS cap guarantees the never-throw module can never hang."
  - "nextNudgeDate stays STATELESS with no clamp-to-today (11-CONTEXT §Cadence item G DECIDED) — an overdue due date advances by whole cadence weeks to a today-or-future tick."

patterns-established:
  - "The scheduler composes nextNudgeDate() (which day) then nextAllowedFireInstant() (which instant) to produce each notification's DATE trigger."
  - "Every hour argument is clampHour-coerced on read — defense-in-depth over 11-02's write-side bounds check."

requirements-completed: [NOTIF-01]

coverage:
  - id: D1
    description: "nextAllowedFireInstant rolls a quiet-window hit (incl. the 21→08 midnight wrap) to the next allowed morning, rolls a past-today slot to the next day, applies per-contact stagger, and clamps hours to 0–23 (never NaN)"
    requirement: "NOTIF-01"
    verification:
      - kind: unit
        ref: "src/services/notifications/fire-instant.test.ts#nextAllowedFireInstant — delivery slot + quiet-window roll"
        status: pass
    human_judgment: false
  - id: D2
    description: "clampHour coerces every hour arg to an integer in [0,23]; below/above-range, non-integer, and NaN/±Infinity all yield a safe in-range integer"
    requirement: "NOTIF-01"
    verification:
      - kind: unit
        ref: "src/services/notifications/fire-instant.test.ts#clampHour — 0–23 integer coercion (T-11-05 defense-in-depth)"
        status: pass
    human_judgment: false
  - id: D3
    description: "nextNudgeDate derives a today-or-future weekly tick from an overdue due date with no stored state, and returns a local-midnight Date"
    requirement: "NOTIF-01"
    verification:
      - kind: unit
        ref: "src/services/notifications/fire-instant.test.ts#nextNudgeDate — stateless weekly cadence anchored to the due date"
        status: pass
    human_judgment: false

# Metrics
duration: 2min
completed: 2026-08-16
status: complete
---

# Phase 11 Plan 05: Fire-Instant Scheduling Math Summary

**Pure, node-tested `nextAllowedFireInstant` (delivery hour + midnight-wrapping quiet-window roll + per-contact stagger + 0–23 clamp) and stateless `nextNudgeDate` (weekly cadence anchored to the due date) — Orbit's own scheduling logic since Android has no time-of-day/quiet-hours trigger.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-16T21:42:20Z
- **Completed:** 2026-08-16T21:44:38Z
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files modified:** 2 (both created)

## Accomplishments
- `nextAllowedFireInstant` computes the exact LOCAL fire Date: builds the delivery-hour + stagger candidate, rolls a quiet-window hit forward to `quietEnd` on the correct morning (handling the 21→08 midnight-wrapping window explicitly), and rolls a slot already `<= now` to the next day's delivery slot — walking day by day, quiet-respecting each day.
- `clampHour` is the single 0–23 integer coercion choke point (T-11-05): a malformed persisted delivery/quiet hour (out-of-range, fractional, NaN, ±Infinity) can never reach the DATE trigger as a NaN or out-of-range fire time.
- Per-contact `staggerMinutes` offset spreads morning fire instants so Android 15's Notification Cooldown cannot silently mute the 2nd+ nudges of a burst (T-11-COOLDOWN).
- `nextNudgeDate` derives the flat-weekly re-nag day purely from the due date — an overdue contact's next tick advances by whole cadence weeks to today-or-future, with NO stored last-notified state and NO clamp-to-today (11-CONTEXT §Cadence item G, DECIDED — kept stateless).
- Module imports nothing from react-native/expo; all Date construction is LOCAL wall-clock (`new Date(y, m, d, h, min)`), never `toISOString`/UTC.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 (RED): failing tests for fire-instant math** - `8818831` (test)
2. **Task 1 (GREEN): pure fire-instant scheduling math** - `edb34ef` (feat)

No REFACTOR commit — the GREEN implementation was already clean (tsc + biome pass).

## Files Created/Modified
- `src/services/notifications/fire-instant.ts` - Pure scheduling math: exports `clampHour`, `nextAllowedFireInstant`, `nextNudgeDate`; private `clampStagger`, `inQuietWindow`, `allowedSlotForDay` helpers.
- `src/services/notifications/fire-instant.test.ts` - 20 node tests with fixed LOCAL dates: clamp of −1/24/9.5/NaN/±Infinity; 9am allowed under quiet 21→08; 6am → 08:00 same day; 23:00 (and 21:00+stagger→22:30) → next 08:00; non-wrapping [00,08) → 08:00; past-today slot → tomorrow; stagger offsets applied + two-contact distinctness; NaN-hour still finite; nextNudgeDate today/future/overdue/exact-tick/local-midnight cases.

## Decisions Made
- **Explicit `now` parameter (6-arg signature):** The PLAN's `<behavior>` requires the past-slot roll to be deterministic, so `now` is a required 6th argument, extending the 5-arg RESEARCH sketch. A non-Date/invalid `now` is treated as "no past constraint" (never throws).
- **Quiet-roll morning selection:** A wrapping window's evening portion (`hour >= quietStart`) exits the NEXT morning at `quietEnd`; the early-morning portion and any non-wrapping window exit the SAME morning. The window is the half-open interval `[quietStart, quietEnd)`; equal bounds = empty (never quiet).
- **Loop safety without owning policy:** `cadenceDays < 1`/non-finite is floored to 1 only as a loop guard (the module owns no cadence number — the caller passes it), and a `MAX_STEPS` cap on both day-stepping loops guarantees the never-throw contract can never hang on pathologic input.
- **Stateless cadence preserved:** No clamp-to-today and no stored state in `nextNudgeDate`, per the DECIDED 11-CONTEXT item G (the naive clamp would re-fire daily on every reconcile, violating the flat-weekly cadence and anti-nag mandate).

## Deviations from Plan

None - plan executed exactly as written. (The 6-arg `now` signature is the PLAN's own `<behavior>` spec, not a deviation from it; it differs only from the abbreviated RESEARCH code sketch.)

## Issues Encountered
- Biome flagged the `inQuietWindow` signature for multi-line formatting; applied `biome check --write` and re-ran the suite (still green) before committing GREEN. No logic change.

## Verification
- `npx vitest run src/services/notifications/fire-instant.test.ts` — 20/20 pass.
- Full suite `vitest run` — 62 files / 782 tests pass (no regressions).
- `npx tsc --noEmit` — no fire-instant errors.
- `biome check` on both files — clean.
- No `react-native`/`expo` import in `fire-instant.ts`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 11-10's notification scheduler can now compose `nextNudgeDate()` → `nextAllowedFireInstant()` to mint each contact's DATE trigger, keying `staggerMinutes` on contactId (candidates already arrive `ORDER BY id` from 11-04).
- No blockers.

## Self-Check: PASSED
- Files verified on disk: `fire-instant.ts`, `fire-instant.test.ts`, `11-05-SUMMARY.md`.
- Commits verified in git log: `8818831` (test/RED), `edb34ef` (feat/GREEN).

---
*Phase: 11-actionable-notifications*
*Completed: 2026-08-16*
